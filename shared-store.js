const STORE_KEY = "la_lupita_demo_db_cloud_v1";
const DATA_VERSION_KEY = "la_lupita_data_version";
const DATA_VERSION = "2026-07-15-production-reset";
const FIREBASE_CONFIG = window.LA_LUPITA_FIREBASE_CONFIG || {};
const FIREBASE_PATH = window.LA_LUPITA_FIREBASE_PATH || "la-lupita-demo";
let cloudRef = null;
let cloudSaveTimer = null;
let cloudReady = false;
let applyingCloudUpdate = false;
let cloudWritePending = false;
let queuedCloudPayload = null;
let queuedCloudFingerprint = "";

const seedDatabase = {
  bakery: {
    name: "Panadería La Lupita",
    phone: "+529902257205",
    address: "Calle 60 #456, Centro, Merida, Yucatan"
  },
  dailyProductId: 3,
  products: [
    { id: 1, name: "Concha vainilla", category: "dulce", price: 12, icon: "&#129391;", stock: 24, desc: "Pan dulce tradicional con cubierta de vainilla.", active: true },
    { id: 2, name: "Bolillo", category: "salado", price: 4, icon: "&#129366;", stock: 80, desc: "Bolillo fresco para apartar por pieza o por bolsa.", active: true },
    { id: 3, name: "Cuernito", category: "dulce", price: 15, icon: "&#129360;", stock: 18, desc: "Cuernito dorado con sabor mantequilla.", active: true },
    { id: 4, name: "Rebanada de pastel", category: "postres", price: 38, icon: "&#127856;", stock: 10, desc: "Postre para recoger en tienda.", active: true },
    { id: 5, name: "Flan individual", category: "postres", price: 25, icon: "&#127854;", stock: 12, desc: "Flan individual para pedidos pequeños.", active: true },
    { id: 6, name: "Cafe de olla", category: "bebidas", price: 22, icon: "&#9749;", stock: 30, desc: "Bebida caliente para acompañar el pedido.", active: true }
  ],
  orders: [],
  quotes: [],
  customers: [],
  chats: [],
  deletedAccounts: [],
  presence: { cliente: 0, admin: 0 }
};

const ADMIN_DEFAULTS = {
  user: "admin",
  password: "lalupita2026"
};

function iconForProduct(product) {
  const name = product.name.toLowerCase();
  if (name.includes("bolillo") || name.includes("baguette")) return "&#129366;";
  if (name.includes("cuernito") || name.includes("croissant")) return "&#129360;";
  if (name.includes("pastel")) return "&#127856;";
  if (name.includes("flan")) return "&#127854;";
  if (name.includes("cafe") || name.includes("café")) return "&#9749;";
  if (product.category === "salado") return "&#129366;";
  if (product.category === "postres") return "&#127856;";
  if (product.category === "bebidas") return "&#9749;";
  return "&#129391;";
}

function idNumber(id, prefix) {
  const match = String(id || "").match(new RegExp(`^${prefix}-(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function nextId(prefix, collection = []) {
  const existing = new Set(collection.map((item) => String(item?.id || "")));
  const nextNumber = collection.reduce((max, item) => Math.max(max, idNumber(item?.id, prefix)), 0) + 1;
  let candidate = "";
  do {
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    candidate = `${prefix}-${String(nextNumber).padStart(3, "0")}-${token}`;
  } while (existing.has(candidate));
  return candidate;
}

function repairDuplicateIds(collection, prefix) {
  const repaired = [];
  const used = new Set();
  for (const item of Array.isArray(collection) ? collection : []) {
    const currentId = String(item?.id || "");
    if (currentId && !used.has(currentId)) {
      used.add(currentId);
      repaired.push(item);
      continue;
    }
    const replacement = nextId(prefix, [...repaired, ...collection]);
    used.add(replacement);
    repaired.push({ ...item, id: replacement });
  }
  return repaired;
}

function timeValue(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recordTime(record) {
  return timeValue(record?.updatedAt || record?.createdAt || record?.accountCreatedAt);
}

function customerIdentity(value) {
  const text = String(value || "").trim();
  if (text.includes("@")) return text.toLowerCase();
  return text.replace(/\D/g, "") || text;
}

function normalizeCustomerPhone(value) {
  const text = String(value || "").trim();
  return text.includes("@") ? text.toLowerCase() : (text.replace(/\D/g, "") || text);
}

function mergeLatestRecords(remoteItems, localItems, keyFor) {
  const records = new Map();
  for (const record of Array.isArray(remoteItems) ? remoteItems : []) records.set(keyFor(record), record);
  for (const record of Array.isArray(localItems) ? localItems : []) {
    const key = keyFor(record);
    const current = records.get(key);
    if (!current || recordTime(record) > recordTime(current)) records.set(key, record);
  }
  return [...records.values()];
}

function mergeChats(remoteChats, localChats) {
  const chats = new Map();
  for (const chat of Array.isArray(remoteChats) ? remoteChats : []) chats.set(customerIdentity(chat.customer?.phone) || chat.id, chat);
  for (const localChat of Array.isArray(localChats) ? localChats : []) {
    const key = customerIdentity(localChat.customer?.phone) || localChat.id;
    const remoteChat = chats.get(key);
    if (!remoteChat) {
      chats.set(key, localChat);
      continue;
    }
    const useLocal = recordTime(localChat) >= recordTime(remoteChat);
    const preferred = useLocal ? localChat : remoteChat;
    chats.set(key, {
      ...preferred,
      customer: useLocal ? localChat.customer : remoteChat.customer,
      createdAt: remoteChat.createdAt || localChat.createdAt || preferred.updatedAt,
      updatedAt: recordTime(localChat) >= recordTime(remoteChat) ? localChat.updatedAt : remoteChat.updatedAt,
      messages: mergeLatestRecords(remoteChat.messages, localChat.messages, (message) => message.id)
        .sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt))
    });
  }
  return [...chats.values()];
}

function mergeDeletedAccounts(remoteDeleted, localDeleted) {
  const deleted = new Map();
  for (const entry of [...(Array.isArray(remoteDeleted) ? remoteDeleted : []), ...(Array.isArray(localDeleted) ? localDeleted : [])]) {
    const phone = normalizeCustomerPhone(entry?.phone);
    if (!phone) continue;
    const current = deleted.get(phone);
    if (!current || timeValue(entry.deletedAt) > timeValue(current.deletedAt)) deleted.set(phone, { phone, deletedAt: entry.deletedAt });
  }
  return [...deleted.values()];
}

function applyDeletedAccounts(db) {
  const deletedAtByPhone = new Map((db.deletedAccounts || []).map((entry) => [customerIdentity(entry.phone), timeValue(entry.deletedAt)]));
  const wasDeleted = (record, phone = record?.customer?.phone || record?.phone) => {
    const deletedAt = deletedAtByPhone.get(customerIdentity(phone));
    return deletedAt && recordTime(record) <= deletedAt;
  };
  db.customers = db.customers.filter((customer) => !wasDeleted(customer, customer.phone));
  db.orders = db.orders.filter((order) => !wasDeleted(order));
  db.quotes = db.quotes.filter((quote) => !wasDeleted(quote));
  db.chats = db.chats.filter((chat) => !wasDeleted(chat));
}

function mergeDatabases(remoteValue, localValue) {
  const remote = normalizeDb(structuredClone(remoteValue || seedDatabase));
  const local = normalizeDb(structuredClone(localValue || seedDatabase));
  const deletedAccounts = mergeDeletedAccounts(remote.deletedAccounts, local.deletedAccounts);
  const merged = {
    ...remote,
    deletedAccounts,
    products: mergeLatestRecords(remote.products, local.products, (product) => String(product.id)),
    customers: mergeLatestRecords(remote.customers, local.customers, (customer) => customerIdentity(customer.phone)),
    orders: mergeLatestRecords(remote.orders, local.orders, (order) => order.id),
    quotes: mergeLatestRecords(remote.quotes, local.quotes, (quote) => quote.id),
    chats: mergeChats(remote.chats, local.chats),
    presence: {
      cliente: Math.max(Number(remote.presence?.cliente || 0), Number(local.presence?.cliente || 0)),
      admin: Math.max(Number(remote.presence?.admin || 0), Number(local.presence?.admin || 0))
    },
    dailyProductId: recordTime(local) > recordTime(remote) ? local.dailyProductId : remote.dailyProductId
  };
  return normalizeDb(merged);
}

function normalizeDb(db) {
  db.bakery ||= structuredClone(seedDatabase.bakery);
  db.products ||= [];
  db.orders = repairDuplicateIds(db.orders, "PED");
  db.quotes = repairDuplicateIds(db.quotes, "COT");
  db.customers ||= [];
  db.deletedAccounts = mergeDeletedAccounts([], db.deletedAccounts);
  db.chats = repairDuplicateIds(db.chats, "CHAT").map((chat) => ({
    ...chat,
    createdAt: chat.createdAt || chat.updatedAt || new Date(0).toISOString(),
    customer: { ...chat.customer, phone: normalizeCustomerPhone(chat.customer?.phone) },
    messages: repairDuplicateIds(chat.messages, "MSG").sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt) || String(a.id).localeCompare(String(b.id)))
  }));
  db.presence ||= { cliente: 0, admin: 0 };
  db.admin ||= structuredClone(ADMIN_DEFAULTS);
  db.dailyProductId = db.dailyProductId || db.products[0]?.id || seedDatabase.dailyProductId;
  db.products = db.products.map((product) => ({
    ...product,
    icon: product.icon && !/^[A-Z]{2}$/.test(product.icon) && !/[ðâÃÂ]/.test(product.icon) ? product.icon : iconForProduct(product),
    image: product.image || "",
    stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
    active: product.active !== false,
    updatedAt: product.updatedAt || product.createdAt || new Date(0).toISOString()
  }));
  db.customers = db.customers.map((customer) => ({
    ...customer,
    phone: normalizeCustomerPhone(customer.phone),
    accountCreatedAt: customer.accountCreatedAt || customer.updatedAt || new Date(0).toISOString(),
    updatedAt: customer.updatedAt || customer.accountCreatedAt || new Date(0).toISOString()
  }));
  applyDeletedAccounts(db);
  return db;
}

function loadDb() {
  const saved = localStorage.getItem(STORE_KEY);
  if (!saved) {
    const fresh = normalizeDb(structuredClone(seedDatabase));
    saveDb(fresh, false, false);
    return fresh;
  }

  try {
    const db = normalizeDb(JSON.parse(saved));
    saveDb(db, false, false);
    return db;
  } catch {
    const fresh = normalizeDb(structuredClone(seedDatabase));
    saveDb(fresh, false, false);
    return fresh;
  }
}

function resetLocalDataForCurrentVersion() {
  if (localStorage.getItem(DATA_VERSION_KEY) === DATA_VERSION) return;
  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("la_lupita_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
}

function saveDb(db, notify = true, syncRemote = true) {
  const serialized = JSON.stringify(db, null, 2);
  const changed = localStorage.getItem(STORE_KEY) !== serialized;
  if (changed) localStorage.setItem(STORE_KEY, serialized);
  // Firebase confirms the same data periodically. Avoid rebuilding every screen when nothing changed.
  if (notify && changed) window.dispatchEvent(new CustomEvent("la-lupita-db-updated", { detail: db }));
  if (syncRemote && changed) queueCloudSave(db);
}

function hasFirebaseConfig() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL && window.firebase?.database);
}

function startCloudSync() {
  if (!hasFirebaseConfig() || cloudRef) return;
  firebase.initializeApp(FIREBASE_CONFIG);
  cloudRef = firebase.database().ref(FIREBASE_PATH);
  cloudRef.on("value", (snapshot) => {
    const value = snapshot.val();
    if (!value) {
      cloudReady = true;
      if (!cloudWritePending) cloudRef.transaction(() => normalizeDb(structuredClone(seedDatabase)));
      return;
    }
    const originalFingerprint = JSON.stringify(value);
    const normalized = normalizeDb(value);
    const remoteFingerprint = JSON.stringify(normalized);
    cloudReady = true;
    // Do not let an older Firebase response overwrite a quote/order/chat still waiting to upload.
    if (cloudWritePending && remoteFingerprint !== queuedCloudFingerprint) return;
    applyingCloudUpdate = true;
    saveDb(normalized, true, false);
    applyingCloudUpdate = false;
    if (originalFingerprint !== remoteFingerprint) queueCloudSave(normalized);
  });
}

async function refreshCloudData() {
  if (!cloudRef) startCloudSync();
  if (!cloudRef) return loadDb();
  if (cloudWritePending) return loadDb();
  try {
    const snapshot = await cloudRef.once("value");
    const value = snapshot.val();
    if (value && !cloudWritePending) saveDb(normalizeDb(value), true, false);
  } catch {}
  return loadDb();
}

window.refreshCloudData = refreshCloudData;

function queueCloudSave(db) {
  if (applyingCloudUpdate) return;
  queuedCloudPayload = normalizeDb(structuredClone(db));
  queuedCloudFingerprint = JSON.stringify(queuedCloudPayload);
  cloudWritePending = true;
  clearTimeout(cloudSaveTimer);
  if (!cloudRef) startCloudSync();
  if (!cloudRef) return;
  cloudSaveTimer = setTimeout(() => {
    const payload = queuedCloudPayload;
    const fingerprint = queuedCloudFingerprint;
    cloudRef.transaction((remote) => mergeDatabases(remote, payload)).then((result) => {
      if (result.committed && result.snapshot?.val()) saveDb(normalizeDb(result.snapshot.val()), true, false);
    }).catch(() => {}).finally(() => {
      if (queuedCloudFingerprint === fingerprint) cloudWritePending = false;
    });
  }, cloudReady ? 250 : 900);
}

function upsertCustomer(customer) {
  const db = loadDb();
  const now = new Date().toISOString();
  const clean = {
    name: customer.name.trim(),
    phone: normalizeCustomerPhone(customer.phone),
    password: customer.password || "",
    photo: customer.photo || "",
    favorites: Array.isArray(customer.favorites) ? customer.favorites : [],
    tag: customer.tag || "Cliente",
    lastLogin: new Date().toLocaleString("es-MX"),
    accountCreatedAt: now,
    updatedAt: now
  };
  const index = db.customers.findIndex((item) => item.phone === clean.phone);
  if (index >= 0) db.customers[index] = { ...db.customers[index], ...clean, accountCreatedAt: db.customers[index].accountCreatedAt || now, photo: clean.photo || db.customers[index].photo || "" };
  else db.customers.push(clean);
  saveDb(db);
  return index >= 0 ? db.customers[index] : clean;
}

// A new data version starts with no client accounts, messages, orders, or quotes.
// It also prevents a device with old localStorage from restoring removed data.
resetLocalDataForCurrentVersion();
startCloudSync();

