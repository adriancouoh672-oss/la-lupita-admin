// Panadería La Lupita - Admin App Controller (Event-Delegated)
const $ = (selector) => document.querySelector(selector);
const money = (amount) => `$${Number(amount || 0).toFixed(2)}`;

let newProductImage = "";
let editProductId = null;
let editProductImage = "";
let pendingDeleteProductId = null;
let pendingUserTagPhone = "";
let adminToastTimer = null;
let reportPeriod = "today";
let activeAdminChatId = "";

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

function showAdminToast(message) {
  const toast = $("#adminToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(adminToastTimer);
  adminToastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function go(id) {
  if (!id) id = "adminInicio";
  document.querySelectorAll(".mobile-screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  document.querySelectorAll(".nav").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.go === id);
  });
  const app = document.querySelector(".phone-app");
  if (app) {
    app.classList.remove("login-active");
    app.classList.toggle("chat-open", id === "adminChatScreen");
  }
  renderAdmin();
  if (typeof window.refreshCloudData === "function") window.refreshCloudData();
}

function openAdminNotificationRoute(route) {
  const validRoutes = new Set(["adminInicio", "adminCotizaciones", "adminChats", "adminProductos"]);
  if (!validRoutes.has(route)) return;
  localStorage.removeItem("la_lupita_notification_route");
  go(route);
}

function consumeAdminNotificationRoute() {
  const route = localStorage.getItem("la_lupita_notification_route") || "";
  if (route) openAdminNotificationRoute(route);
}

function productVisual(product) {
  if (product.image) return `<img src="${product.image}" alt="${escapeHtml(product.name)}" />`;
  return product.icon || "&#129391;";
}

function renderAdmin() {
  if ($("#editProductModal")?.open) return;
  const db = typeof loadDb === "function" ? loadDb() : {};
  if (!db || !db.products) return;

  renderOrders(db);
  renderProducts(db);
  renderQuotes(db);
  renderUsers(db);
  renderReport(db);
  renderChats(db);
  renderAdminChatModal(db);
  renderAdminPresence(db);
}

function renderOrders(db) {
  const container = $("#adminOrders");
  if (!container) return;
  const orders = Array.isArray(db.orders) ? db.orders : [];
  if (!orders.length) {
    container.innerHTML = `<div class="empty">Todavía no hay pedidos enviados por clientes.</div>`;
    return;
  }
  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  container.innerHTML = sortedOrders.map((order) => {
    const isCompleted = order.status === "Completado";
    const customerName = escapeHtml(order.customer?.name || "Cliente");
    const customerPhone = escapeHtml(order.customer?.phone || "");
    const status = escapeHtml(order.status || "Pendiente");
    const pickup = escapeHtml(order.pickupTime || "");
    return `
      <article class="order-card">
        <strong>Pedido #${escapeHtml(order.id)}</strong>
        <span>${customerName} · ${customerPhone}</span>
        <em class="status-pill ${status.toLowerCase()}">${status} · ${isCompleted ? "Recogido" : `Recoge ${pickup}`}</em>
        <button class="outline small-detail" data-order-detail="${escapeHtml(order.id)}">Ver detalles</button>
      </article>
    `;
  }).join("");
}

function stockState(stock) {
  const amount = Number(stock || 0);
  if (amount <= 0) return "stock-empty";
  if (amount <= 8) return "stock-low";
  return "stock-ok";
}

function renderProducts(db) {
  const container = $("#adminProducts");
  if (!container) return;
  const products = Array.isArray(db.products) ? db.products : [];
  if (!products.length) {
    container.innerHTML = `<div class="empty">No hay productos registrados en el catálogo.</div>`;
    return;
  }
  container.innerHTML = products.map((product) => `
    <article class="admin-product-card ${stockState(product.stock)}">
      <div class="admin-product-head">
        <span class="product-icon">${productVisual(product)}</span>
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${money(product.price)} · ${product.active ? "Activo" : "Oculto"}</small>
        </div>
      </div>
      <div class="stock-box ${stockState(product.stock)}">
        <span>${Number(product.stock) <= 0 ? "Piezas agotadas" : "Piezas disponibles"}</span>
        <strong>${product.stock}</strong>
      </div>
      <div class="stock-actions admin-product-actions">
        <button data-edit-product="${product.id}">Editar</button>
        <button class="${db.dailyProductId === product.id ? "daily-active" : "daily-button"}" data-daily-product="${product.id}">${db.dailyProductId === product.id ? "Del día" : "Pan del día"}</button>
        <button class="${product.active ? "toggle-active" : "toggle-hidden"}" data-toggle-product="${product.id}">${product.active ? "Ocultar" : "Activar"}</button>
        <button class="delete-product" data-delete-product="${product.id}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function renderQuotes(db) {
  const container = $("#adminQuotes");
  if (!container) return;
  const quotes = Array.isArray(db.quotes) ? db.quotes : [];
  if (!quotes.length) {
    container.innerHTML = `<div class="empty">Todavía no hay cotizaciones.</div>`;
    return;
  }
  container.innerHTML = quotes.map((quote) => {
    const isCompleted = quote.status === "Completado";
    const customerName = escapeHtml(quote.customer?.name || "Cliente");
    const customerPhone = escapeHtml(quote.customer?.phone || "");
    const status = escapeHtml(quote.status || "Pendiente");
    const pickup = escapeHtml(quote.pickupTime || "");
    return `
      <article class="order-card">
        <strong>Cotización</strong>
        <span>${customerName} · ${customerPhone}</span>
        <em class="status-pill ${status.toLowerCase()}">${status} · ${pickup}</em>
        <button class="outline small-detail" data-quote-detail="${escapeHtml(quote.id)}">Ver detalles</button>
        <button class="small-action ${isCompleted ? "completed" : ""}" data-complete-quote="${escapeHtml(quote.id)}" ${isCompleted ? "disabled" : ""}>${isCompleted ? "Respondida" : "Marcar respondida"}</button>
      </article>
    `;
  }).join("");
}

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderUsers(db) {
  const container = $("#adminUsers");
  if (!container) return;
  const customers = Array.isArray(db.customers) ? db.customers : [];
  if (!customers.length) {
    container.innerHTML = `<div class="empty">Todavía no hay usuarios registrados.</div>`;
    return;
  }
  const orders = Array.isArray(db.orders) ? db.orders : [];
  const quotes = Array.isArray(db.quotes) ? db.quotes : [];

  container.innerHTML = customers.map((customer) => {
    const userOrders = orders.filter((order) => order.customer?.phone === customer.phone);
    const userQuotes = quotes.filter((quote) => quote.customer?.phone === customer.phone);
    const photo = customer.photo ? `<img src="${customer.photo}" alt="${escapeHtml(customer.name)}" />` : "👤";
    const name = escapeHtml(customer.name);
    const phone = escapeHtml(customer.phone);
    const tag = escapeHtml(customer.tag || "Cliente");

    return `
      <article class="user-card">
        <div class="user-main">
          <span class="profile-photo mini-profile">${photo}</span>
          <div class="user-text">
            <strong>${name}</strong>
            <small>${phone}</small>
            <em>${tag}</em>
          </div>
          <button class="kebab" data-user-menu="${phone}" aria-label="Opciones de usuario">⋮</button>
        </div>
        <div class="user-menu floating-user-menu" id="userMenu-${cleanId(customer.phone)}">
          <button data-user-detail="${phone}">Detalles del perfil</button>
          <button data-user-tag="${phone}">Agregar etiqueta</button>
        </div>
        <footer>${userOrders.length} pedidos · ${userQuotes.length} cotizaciones</footer>
      </article>
    `;
  }).join("");
}

function renderChats(db) {
  const container = $("#adminChatsList");
  if (!container) return;
  const chats = [...(Array.isArray(db.chats) ? db.chats : [])].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  if (!chats.length) {
    container.innerHTML = `<div class="empty">Todavía no hay mensajes de clientes.</div>`;
    return;
  }
  container.innerHTML = chats.map((chat) => {
    const messages = chronologicalMessages(chat.messages);
    const last = messages.at(-1);
    const customers = Array.isArray(db.customers) ? db.customers : [];
    const currentCustomer = customers.find((item) => String(item.phone || "").trim() === String(chat.customer?.phone || "").trim());
    const photo = currentCustomer?.photo || chat.customer?.photo || "";
    const name = currentCustomer?.name || chat.customer?.name || "Cliente";
    const preview = last?.image ? "Foto enviada" : (last?.text || "Sin mensajes");
    const prefix = last?.from === "admin" ? "Tú: " : "";
    const timeStr = last ? new Date(last.createdAt).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) : "";

    return `
      <article class="order-card chat-list-card chat-list-entry">
        <button class="chat-list-open" type="button" data-chat-detail="${escapeHtml(chat.id)}" aria-label="Abrir chat con ${escapeHtml(name)}">
          <span class="chat-list-avatar">${photo ? `<img src="${escapeHtml(photo)}" alt="" />` : '<span class="material-symbols-rounded">person</span>'}</span>
          <span class="chat-list-copy"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(prefix + preview)}</p></span>
          <time>${timeStr}</time>
        </button>
      </article>
    `;
  }).join("");
}

function openAdminChat(id) {
  activeAdminChatId = id;
  renderAdminChatModal(loadDb());
  go("adminChatScreen");
}

function chronologicalMessages(messages) {
  return [...(Array.isArray(messages) ? messages : [])].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id || "").localeCompare(String(b.id || "")));
}

function scrollAdminChatToNewest(container) {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 90);
  });
}

function renderAdminChatModal(db) {
  if (!activeAdminChatId || !$("#adminChatMessages")) return;
  const chats = Array.isArray(db.chats) ? db.chats : [];
  const chat = chats.find((item) => item.id === activeAdminChatId);
  if (!chat) return;

  if ($("#adminChatScreenTitle")) $("#adminChatScreenTitle").textContent = chat.customer?.name || "Cliente";
  renderAdminChatAvatar(chat, db);

  const container = $("#adminChatMessages");
  const renderKey = `${chat.id}:${chat.updatedAt || ""}:${chat.messages?.length || 0}`;
  if (container.dataset.renderKey === renderKey) return;

  const keepAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 48;
  const shouldScrollToNewest = !container.dataset.renderKey || keepAtBottom;
  const messages = chronologicalMessages(chat.messages);

  container.innerHTML = messages.length ? messages.map((message, index) => `
    <div class="chat-bubble ${message.from === "admin" ? "mine" : "theirs"}${index === messages.length - 1 ? " is-new" : ""}">
      ${message.image ? `<button class="chat-image" type="button" data-chat-image="${escapeHtml(message.image)}" data-chat-name="chat-la-lupita-${escapeHtml(message.id)}.jpg" aria-label="Abrir imagen enviada"><img src="${escapeHtml(message.image)}" alt="Imagen enviada" /><span><span class="material-symbols-rounded">fullscreen</span> Ver imagen</span></button>` : ""}
      ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}
      <small>${new Date(message.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</small>
    </div>
  `).join("") : `<div class="empty">Sin mensajes.</div>`;

  container.dataset.renderKey = renderKey;
  if (shouldScrollToNewest) scrollAdminChatToNewest(container);
}

function renderAdminChatAvatar(chat, db) {
  const avatar = $("#adminChatAvatar");
  if (!avatar) return;
  const customers = Array.isArray(db.customers) ? db.customers : [];
  const currentCustomer = customers.find((item) => String(item.phone || "").trim() === String(chat.customer?.phone || "").trim());
  const photo = currentCustomer?.photo || chat.customer?.photo || "";
  const name = currentCustomer?.name || chat.customer?.name || "Cliente";
  const avatarKey = `${chat.customer?.phone || ""}:${photo}`;

  if (avatar.dataset.avatarKey === avatarKey) return;
  avatar.dataset.avatarKey = avatarKey;
  avatar.replaceChildren();

  if (!photo) {
    avatar.innerHTML = '<span class="material-symbols-rounded">person</span>';
    return;
  }
  const image = document.createElement("img");
  image.src = photo;
  image.alt = name;
  image.onerror = () => {
    avatar.innerHTML = '<span class="material-symbols-rounded">person</span>';
  };
  avatar.append(image);
}

function renderAdminPresence(db = loadDb()) {
  const status = $("#adminChatStatus");
  if (!status) return;
  const clientSeen = Number(db?.presence?.cliente || 0);
  status.textContent = Date.now() - clientSeen < 15000 ? "en línea" : "";
}

function markPresence(role, isActive = true) {
  const db = loadDb();
  db.presence ||= {};
  db.presence[role] = isActive ? Date.now() : 0;
  saveDb(db, false, true);
}

function openChatImage(image, filename = "imagen-chat-la-lupita.jpg") {
  if (!image) return;
  if ($("#chatImageViewerImage")) $("#chatImageViewerImage").src = image;
  if ($("#chatImageDownload")) {
    $("#chatImageDownload").href = image;
    $("#chatImageDownload").download = filename;
  }
  $("#chatImageViewer")?.showModal();
}

function closeChatImageViewer() {
  const viewer = $("#chatImageViewer");
  if (!viewer?.open) return;
  viewer.close();
  if ($("#chatImageViewerImage")) $("#chatImageViewerImage").removeAttribute("src");
}

function sendAdminChatMessage(event) {
  if (event) event.preventDefault();
  const input = $("#adminChatInput");
  const text = input ? input.value.trim() : "";
  const image = $("#adminChatImage")?.dataset.image || "";
  if ((!text && !image) || !activeAdminChatId) return;

  const db = loadDb();
  const chat = db.chats.find((item) => item.id === activeAdminChatId);
  if (!chat) return;

  const now = new Date().toISOString();
  chat.messages ||= [];
  chat.messages.push({
    id: typeof nextId === "function" ? nextId("MSG", chat.messages) : `MSG-${Date.now()}`,
    from: "admin",
    text,
    image,
    createdAt: now
  });
  chat.updatedAt = now;
  saveDb(db);

  if (input) input.value = "";
  if ($("#adminChatImage")) {
    $("#adminChatImage").value = "";
    delete $("#adminChatImage").dataset.image;
  }
  renderAdminChatModal(db);
  renderChats(db);
  showAdminToast("Respuesta enviada.");
}

function openUserDetail(phone) {
  const db = loadDb();
  const customer = db.customers.find((item) => item.phone === phone);
  if (!customer) return;
  const orders = db.orders.filter((order) => order.customer?.phone === phone);
  const quotes = db.quotes.filter((quote) => quote.customer?.phone === phone);

  if ($("#userDetailContent")) {
    $("#userDetailContent").innerHTML = `
      <button class="modal-close" id="closeUserDetail">×</button>
      <p class="eyebrow">Detalles del perfil</p>
      <div class="profile-top">
        <div class="profile-photo">${customer.photo ? `<img src="${customer.photo}" alt="${escapeHtml(customer.name)}" />` : "👤"}</div>
        <div>
          <h2>${escapeHtml(customer.name)}</h2>
          <p class="muted">${escapeHtml(customer.phone)}</p>
        </div>
      </div>
      <div class="profile-detail"><span>Etiqueta</span><strong>${escapeHtml(customer.tag || "Cliente")}</strong></div>
      <div class="profile-detail"><span>Pedidos</span><strong>${orders.length}</strong></div>
      <div class="profile-detail"><span>Cotizaciones</span><strong>${quotes.length}</strong></div>
    `;
  }
  $("#userDetailModal")?.showModal();
}

function openUserTag(phone) {
  const db = loadDb();
  const customer = db.customers.find((item) => item.phone === phone);
  if (!customer) return;
  pendingUserTagPhone = phone;
  if ($("#userTagTitle")) $("#userTagTitle").textContent = customer.name;
  if ($("#userTagSelect")) $("#userTagSelect").value = customer.tag || "Cliente";
  $("#userTagModal")?.showModal();
}

function saveUserTag(event) {
  if (event) event.preventDefault();
  if (!pendingUserTagPhone) return;
  const db = loadDb();
  const updatedAt = new Date().toISOString();
  db.customers = db.customers.map((customer) => customer.phone === pendingUserTagPhone ? { ...customer, tag: $("#userTagSelect")?.value || "Cliente", updatedAt } : customer);
  saveDb(db);
  pendingUserTagPhone = "";
  $("#userTagModal")?.close();
  renderAdmin();
  showAdminToast("Etiqueta guardada.");
}

function orderAmount(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return Math.max(0, Number(order.total) || 0);
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.price) || 0), 0);
}

function startOfLocalDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function orderIsInReportPeriod(order, period, now = new Date()) {
  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime()) || createdAt > now) return false;
  const today = startOfLocalDay(now);
  const start = new Date(today);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(start.getDate() - 29);
  return createdAt >= start;
}

function renderReport(db) {
  const report = $("#adminReport");
  if (!report) return;
  const labels = { today: "Hoy", week: "1 semana", month: "1 mes" };
  const now = new Date();
  const selectedOrders = (Array.isArray(db.orders) ? db.orders : []).filter((order) =>
    String(order.status || "").toLowerCase() === "completado" &&
    orderIsInReportPeriod(order, reportPeriod, now)
  );

  const productTotals = {};
  selectedOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item.name || "Producto sin nombre";
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.price) || 0);
      productTotals[name] ||= { qty: 0, total: 0 };
      productTotals[name].qty += quantity;
      productTotals[name].total += quantity * price;
    });
  });

  const totalRevenue = selectedOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const totalQty = Object.values(productTotals).reduce((sum, item) => sum + item.qty, 0);

  if ($("#reportPeriodLabel")) $("#reportPeriodLabel").textContent = labels[reportPeriod] || "Hoy";
  if ($("#reportPeriodTotal")) $("#reportPeriodTotal").textContent = money(totalRevenue);
  if ($("#reportPeriodCount")) $("#reportPeriodCount").textContent = `${totalQty} productos vendidos`;
  document.querySelectorAll("[data-report-period]").forEach((button) => button.classList.toggle("active", button.dataset.reportPeriod === reportPeriod));

  const items = Object.entries(productTotals).sort((a, b) => b[1].qty - a[1].qty);
  report.innerHTML = items.length ? items.map(([name, qty]) => `
    <article class="report-row"><strong>${escapeHtml(name)}</strong><span>${qty.qty} piezas · ${money(qty.total)}</span></article>
  `).join("") : `<div class="empty">Aún no hay ventas completadas para resumir.</div>`;
}

function openOrderDetail(id) {
  const db = loadDb();
  const order = db.orders.find((item) => item.id === id);
  if (!order) return;
  const isCompleted = order.status === "Completado";
  const itemsHtml = (order.items || []).map((item) => `<li>${item.quantity} x ${escapeHtml(item.name)} (${money(item.quantity * item.price)})</li>`).join("");

  if ($("#orderDetailContent")) {
    $("#orderDetailContent").innerHTML = `
      <button class="modal-close" id="closeOrderDetail">×</button>
      <p class="eyebrow">Detalles del pedido</p>
      <h2>Pedido #${escapeHtml(order.id)}</h2>
      <p class="muted">${escapeHtml(order.customer?.name || "Cliente")} · ${escapeHtml(order.customer?.phone || "")}</p>
      <ul class="order-items detail-items">${itemsHtml}</ul>
      <div class="profile-detail"><span>Hora de recoger</span><strong>${escapeHtml(order.pickupTime || "")}</strong></div>
      <div class="profile-detail"><span>Total</span><strong>${money(order.total)}</strong></div>
      <div class="profile-detail order-status-detail ${isCompleted ? "status-completed" : "status-pending"}"><span>Estado</span><strong>${escapeHtml(order.status)}</strong></div>
      <button class="small-action ${isCompleted ? "completed" : ""}" id="detailCompleteOrder" ${isCompleted ? "disabled" : ""}>
        ${isCompleted ? "Completado" : "Marcar completado"}
      </button>
    `;
  }
  $("#orderDetailModal")?.showModal();
}

function openQuoteDetail(id) {
  const db = loadDb();
  const quote = db.quotes.find((item) => item.id === id);
  if (!quote) return;

  if ($("#quoteDetailContent")) {
    $("#quoteDetailContent").innerHTML = `
      <button class="modal-close" id="closeQuoteDetail">×</button>
      <p class="eyebrow">Detalles de cotización</p>
      <h2>Cotización</h2>
      <p class="muted">${escapeHtml(quote.customer?.name || "Cliente")} · ${escapeHtml(quote.customer?.phone || "")}</p>
      <div class="quote-spec-card quote-detail-spec">
        <b>Especificaciones</b>
        <p><strong>${escapeHtml(quote.product || "")}</strong></p>
        <p>${escapeHtml(quote.notes || "")}</p>
      </div>
      <div class="profile-detail"><span>Hora</span><strong>${escapeHtml(quote.pickupTime || "")}</strong></div>
      <div class="profile-detail"><span>Estado</span><strong>${escapeHtml(quote.status || "")}</strong></div>
      ${quote.image ? `<button class="quote-image detail-quote-image quote-image-open" id="openQuoteImage" type="button" aria-label="Abrir imagen de referencia"><img src="${escapeHtml(quote.image)}" alt="Referencia de cotización" /><span class="quote-image-open-icon material-symbols-rounded">open_in_full</span></button>` : `<div class="empty">Sin imagen de referencia.</div>`}
    `;
  }
  $("#quoteDetailModal")?.showModal();
}

function updateOrderStatus(id, status) {
  const db = loadDb();
  db.orders = db.orders.map((order) => order.id === id ? { ...order, status, updatedAt: new Date().toISOString() } : order);
  saveDb(db);
  renderAdmin();
  showAdminToast("Estado del pedido actualizado.");
}

function updateQuoteStatus(id, status) {
  const db = loadDb();
  db.quotes = db.quotes.map((quote) => quote.id === id ? { ...quote, status, updatedAt: new Date().toISOString() } : quote);
  saveDb(db);
  renderAdmin();
  showAdminToast("Cotización actualizada.");
}

function setDailyProduct(id) {
  const db = loadDb();
  db.dailyProductId = id;
  db.updatedAt = new Date().toISOString();
  saveDb(db);
  renderAdmin();
  showAdminToast("Pan del día actualizado.");
}

function toggleProduct(id) {
  const db = loadDb();
  db.products = db.products.map((product) => product.id === id ? { ...product, active: !product.active, updatedAt: new Date().toISOString() } : product);
  saveDb(db);
  renderAdmin();
  showAdminToast("Disponibilidad del producto actualizada.");
}

function openDeleteProduct(id) {
  const db = loadDb();
  const product = db.products.find((item) => item.id === id);
  if (!product) return;
  pendingDeleteProductId = id;
  if ($("#deleteProductText")) $("#deleteProductText").textContent = `¿Seguro que quieres eliminar "${product.name}" del catálogo?`;
  $("#deleteProductModal")?.showModal();
}

function deleteProduct() {
  if (!pendingDeleteProductId) return;
  const db = loadDb();
  db.products = db.products.filter((product) => product.id !== pendingDeleteProductId);
  saveDb(db);
  pendingDeleteProductId = null;
  $("#deleteProductModal")?.close();
  renderAdmin();
  showAdminToast("Producto eliminado.");
}

function readImage(input, callback, options = {}) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSize = options.maxSize || 1000;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", options.quality || 0.78));
    };
    image.onerror = () => callback(reader.result);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function saveProduct() {
  const name = $("#productName")?.value.trim();
  const category = $("#productCategory")?.value || "dulce";
  const price = Number($("#productPrice")?.value || 0);
  const stock = Number($("#productStock")?.value || 0);
  const desc = $("#productDesc")?.value.trim();

  if (!name || !price || !desc) {
    showAdminToast("Completa nombre, precio y descripción.");
    return;
  }
  const db = loadDb();
  db.products.push({
    id: Date.now(),
    name,
    category,
    price,
    stock,
    icon: typeof iconForProduct === "function" ? iconForProduct({ name, category }) : "&#129391;",
    image: newProductImage,
    desc,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveDb(db);

  if ($("#productName")) $("#productName").value = "";
  if ($("#productPrice")) $("#productPrice").value = "";
  if ($("#productStock")) $("#productStock").value = "";
  if ($("#productImage")) $("#productImage").value = "";
  if ($("#productDesc")) $("#productDesc").value = "";
  if ($("#productImagePreview")) $("#productImagePreview").innerHTML = "+";
  $("#productUploadTile")?.classList.remove("has-image");
  newProductImage = "";

  renderAdmin();
  go("adminProductos");
  showAdminToast("Producto guardado.");
}

function openEditProduct(id) {
  const db = loadDb();
  const product = db.products.find((item) => item.id === id);
  if (!product) return;
  editProductId = id;
  editProductImage = product.image || "";
  if ($("#editTitle")) $("#editTitle").textContent = product.name;
  if ($("#editPrice")) $("#editPrice").value = product.price;
  if ($("#editStock")) $("#editStock").value = product.stock;
  if ($("#editDesc")) $("#editDesc").value = product.desc;
  if ($("#editImage")) $("#editImage").value = "";
  $("#editProductModal")?.showModal();
}

function saveEditProduct(event) {
  if (event) event.preventDefault();
  const db = loadDb();
  db.products = db.products.map((product) => {
    if (product.id !== editProductId) return product;
    return {
      ...product,
      price: Number($("#editPrice")?.value || product.price),
      stock: Math.max(0, Number($("#editStock")?.value || 0)),
      desc: $("#editDesc")?.value.trim() || product.desc,
      image: editProductImage,
      updatedAt: new Date().toISOString()
    };
  });
  saveDb(db);
  $("#editProductModal")?.close();
  renderAdmin();
  showAdminToast("Cambios guardados.");
}

function openAdminMenu() {
  $("#adminMenuModal")?.showModal();
}

function closeAdminMenu() {
  $("#adminMenuModal")?.close();
}

// Global Bulletproof Event Delegation
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!target) return;

  // data-go
  const goBtn = target.closest("[data-go]");
  if (goBtn) {
    event.preventDefault();
    go(goBtn.dataset.go);
    return;
  }

  // menu open
  const menuOpenBtn = target.closest("[data-menu-open]") || target.closest("#adminMenuBtn");
  if (menuOpenBtn) {
    event.preventDefault();
    openAdminMenu();
    return;
  }

  // menu go
  const menuGoBtn = target.closest("[data-menu-go]");
  if (menuGoBtn) {
    event.preventDefault();
    closeAdminMenu();
    go(menuGoBtn.dataset.menuGo);
    return;
  }

  // close admin menu
  if (target.closest("#closeAdminMenu") || target === $("#adminMenuModal")) {
    event.preventDefault();
    closeAdminMenu();
    return;
  }

  // Order Detail
  const orderDetailBtn = target.closest("[data-order-detail]");
  if (orderDetailBtn) {
    event.preventDefault();
    openOrderDetail(orderDetailBtn.dataset.orderDetail);
    return;
  }

  if (target.closest("#closeOrderDetail")) {
    event.preventDefault();
    $("#orderDetailModal")?.close();
    return;
  }

  if (target.closest("#detailCompleteOrder")) {
    event.preventDefault();
    const modalContent = $("#orderDetailContent");
    const match = modalContent?.innerHTML.match(/Pedido #([A-Za-z0-9_-]+)/);
    if (match?.[1]) {
      updateOrderStatus(match[1], "Completado");
      $("#orderDetailModal")?.close();
    }
    return;
  }

  // Product Actions
  const editProductBtn = target.closest("[data-edit-product]");
  if (editProductBtn) {
    event.preventDefault();
    openEditProduct(Number(editProductBtn.dataset.editProduct));
    return;
  }

  const dailyProductBtn = target.closest("[data-daily-product]");
  if (dailyProductBtn) {
    event.preventDefault();
    setDailyProduct(Number(dailyProductBtn.dataset.dailyProduct));
    return;
  }

  const toggleProductBtn = target.closest("[data-toggle-product]");
  if (toggleProductBtn) {
    event.preventDefault();
    toggleProduct(Number(toggleProductBtn.dataset.toggleProduct));
    return;
  }

  const deleteProductBtn = target.closest("[data-delete-product]");
  if (deleteProductBtn) {
    event.preventDefault();
    openDeleteProduct(Number(deleteProductBtn.dataset.deleteProduct));
    return;
  }

  if (target.closest("#saveProduct")) {
    event.preventDefault();
    saveProduct();
    return;
  }

  if (target.closest("#saveEditProduct")) {
    event.preventDefault();
    saveEditProduct(event);
    return;
  }

  if (target.closest("#closeEditProduct")) {
    event.preventDefault();
    $("#editProductModal")?.close();
    return;
  }

  if (target.closest("#confirmDeleteProduct")) {
    event.preventDefault();
    deleteProduct();
    return;
  }

  if (target.closest("#cancelDeleteProduct")) {
    event.preventDefault();
    pendingDeleteProductId = null;
    $("#deleteProductModal")?.close();
    return;
  }

  // Quote Actions
  const quoteDetailBtn = target.closest("[data-quote-detail]");
  if (quoteDetailBtn) {
    event.preventDefault();
    openQuoteDetail(quoteDetailBtn.dataset.quoteDetail);
    return;
  }

  const completeQuoteBtn = target.closest("[data-complete-quote]");
  if (completeQuoteBtn && !completeQuoteBtn.disabled) {
    event.preventDefault();
    updateQuoteStatus(completeQuoteBtn.dataset.completeQuote, "Completado");
    return;
  }

  if (target.closest("#closeQuoteDetail")) {
    event.preventDefault();
    $("#quoteDetailModal")?.close();
    return;
  }

  if (target.closest("#openQuoteImage")) {
    event.preventDefault();
    const img = $("#quoteDetailContent img");
    if (img?.src) openChatImage(img.src, "referencia-cotizacion.jpg");
    return;
  }

  // User Actions
  const userMenuBtn = target.closest("[data-user-menu]");
  if (userMenuBtn) {
    event.preventDefault();
    const phone = userMenuBtn.dataset.userMenu;
    document.querySelectorAll(".user-menu.show").forEach((menu) => {
      if (menu.id !== `userMenu-${cleanId(phone)}`) menu.classList.remove("show");
    });
    const menu = $(`#userMenu-${cleanId(phone)}`);
    menu?.classList.toggle("show");
    return;
  }

  const userDetailBtn = target.closest("[data-user-detail]");
  if (userDetailBtn) {
    event.preventDefault();
    openUserDetail(userDetailBtn.dataset.userDetail);
    return;
  }

  if (target.closest("#closeUserDetail")) {
    event.preventDefault();
    $("#userDetailModal")?.close();
    return;
  }

  const userTagBtn = target.closest("[data-user-tag]");
  if (userTagBtn) {
    event.preventDefault();
    openUserTag(userTagBtn.dataset.userTag);
    return;
  }

  if (target.closest("#saveUserTag")) {
    event.preventDefault();
    saveUserTag(event);
    return;
  }

  if (target.closest("#closeUserTag")) {
    event.preventDefault();
    pendingUserTagPhone = "";
    $("#userTagModal")?.close();
    return;
  }

  // Report Period Tabs
  const reportTab = target.closest("[data-report-period]");
  if (reportTab) {
    event.preventDefault();
    reportPeriod = reportTab.dataset.reportPeriod;
    renderReport(loadDb());
    return;
  }

  // Chat Actions
  const chatDetailBtn = target.closest("[data-chat-detail]");
  if (chatDetailBtn) {
    event.preventDefault();
    openAdminChat(chatDetailBtn.dataset.chatDetail);
    return;
  }

  const chatImageBtn = target.closest("[data-chat-image]");
  if (chatImageBtn) {
    event.preventDefault();
    openChatImage(chatImageBtn.dataset.chatImage, chatImageBtn.dataset.chatName);
    return;
  }

  if (target.closest("#closeChatImageViewer") || target === $("#chatImageViewer")) {
    event.preventDefault();
    closeChatImageViewer();
    return;
  }
});

// File inputs change handlers
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "productImage") {
    readImage(target, (image) => {
      newProductImage = image;
      if ($("#productImagePreview")) $("#productImagePreview").innerHTML = `<img src="${image}" alt="Vista previa" />`;
      $("#productUploadTile")?.classList.add("has-image");
    }, { maxSize: 1000, quality: 0.78 });
  } else if (target.id === "editImage") {
    readImage(target, (image) => {
      editProductImage = image;
    }, { maxSize: 1000, quality: 0.78 });
  } else if (target.id === "adminChatImage") {
    readImage(target, (image) => {
      if ($("#adminChatImage")) $("#adminChatImage").dataset.image = image;
      showAdminToast("Imagen lista para enviar.");
    }, { maxSize: 1000, quality: 0.78 });
  }
});

// Chat Form submit
document.addEventListener("submit", (event) => {
  if (event.target.id === "adminChatForm") {
    sendAdminChatMessage(event);
  }
});

window.addEventListener("focus", renderAdmin);
window.addEventListener("storage", renderAdmin);
window.addEventListener("la-lupita-db-updated", renderAdmin);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) markPresence("admin", false);
  else {
    markPresence("admin");
    if (typeof window.refreshCloudData === "function") window.refreshCloudData();
  }
});

window.addEventListener("pagehide", () => markPresence("admin", false));
setInterval(() => { if (typeof window.refreshCloudData === "function") window.refreshCloudData(); }, 5000);
setInterval(() => { if (!document.hidden) markPresence("admin"); }, 9000);

if (window.LaLupitaNotifications) window.LaLupitaNotifications.init("admin");

// Initialize application directly on main screen
go("adminInicio");
markPresence("admin");
consumeAdminNotificationRoute();
