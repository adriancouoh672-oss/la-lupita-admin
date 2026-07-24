// Panadería La Lupita - Admin App Controller
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
  if (window.refreshCloudData) window.refreshCloudData();
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

  document.querySelectorAll("[data-order-detail]").forEach((button) => {
    button.onclick = () => openOrderDetail(button.dataset.orderDetail);
  });
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

  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.onclick = () => openEditProduct(Number(button.dataset.editProduct));
  });
  document.querySelectorAll("[data-daily-product]").forEach((button) => {
    button.onclick = () => setDailyProduct(Number(button.dataset.dailyProduct));
  });
  document.querySelectorAll("[data-toggle-product]").forEach((button) => {
    button.onclick = () => toggleProduct(Number(button.dataset.toggleProduct));
  });
  document.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.onclick = () => openDeleteProduct(Number(button.dataset.deleteProduct));
  });
}

function renderQuotes(db) {
  const container = $("#adminCotizaciones");
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

  document.querySelectorAll("[data-complete-quote]").forEach((button) => {
    if (button.disabled) return;
    button.onclick = () => updateQuoteStatus(button.dataset.completeQuote, "Completado");
  });
  document.querySelectorAll("[data-quote-detail]").forEach((button) => {
    button.onclick = () => openQuoteDetail(button.dataset.quoteDetail);
  });
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

  document.querySelectorAll("[data-user-menu]").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".user-menu.show").forEach((menu) => {
        if (menu.id !== `userMenu-${cleanId(button.dataset.userMenu)}`) menu.classList.remove("show");
      });
      const menu = $(`#userMenu-${cleanId(button.dataset.userMenu)}`);
      menu?.classList.toggle("show");
    };
  });
  document.querySelectorAll("[data-user-detail]").forEach((button) => {
    button.onclick = () => openUserDetail(button.dataset.userDetail);
  });
  document.querySelectorAll("[data-user-tag]").forEach((button) => {
    button.onclick = () => openUserTag(button.dataset.userTag);
  });
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

  document.querySelectorAll("[data-chat-detail]").forEach((button) => {
    button.onclick = () => openAdminChat(button.dataset.chatDetail);
  });
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

  $("#adminChatScreenTitle").textContent = chat.customer?.name || "Cliente";
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
  $("#chatImageViewerImage").src = image;
  $("#chatImageDownload").href = image;
  $("#chatImageDownload").download = filename;
  $("#chatImageViewer").showModal();
}

function closeChatImageViewer() {
  const viewer = $("#chatImageViewer");
  if (!viewer?.open) return;
  viewer.close();
  $("#chatImageViewerImage").removeAttribute("src");
}

function sendAdminChatMessage(event) {
  event.preventDefault();
  const input = $("#adminChatInput");
  const text = input.value.trim();
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

  input.value = "";
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
  $("#userDetailModal").showModal();
  $("#closeUserDetail").onclick = () => $("#userDetailModal").close();
}

function openUserTag(phone) {
  const db = loadDb();
  const customer = db.customers.find((item) => item.phone === phone);
  if (!customer) return;
  pendingUserTagPhone = phone;
  $("#userTagTitle").textContent = customer.name;
  $("#userTagSelect").value = customer.tag || "Cliente";
  $("#userTagModal").showModal();
}

function saveUserTag(event) {
  event.preventDefault();
  if (!pendingUserTagPhone) return;
  const db = loadDb();
  const updatedAt = new Date().toISOString();
  db.customers = db.customers.map((customer) => customer.phone === pendingUserTagPhone ? { ...customer, tag: $("#userTagSelect").value, updatedAt } : customer);
  saveDb(db);
  pendingUserTagPhone = "";
  $("#userTagModal").close();
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

  $("#reportPeriodLabel").textContent = labels[reportPeriod] || "Hoy";
  $("#reportPeriodTotal").textContent = money(totalRevenue);
  $("#reportPeriodCount").textContent = `${totalQty} productos vendidos`;
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
  $("#orderDetailModal").showModal();
  $("#closeOrderDetail").onclick = () => $("#orderDetailModal").close();
  $("#detailCompleteOrder").onclick = () => {
    if (order.status === "Completado") return;
    updateOrderStatus(order.id, "Completado");
    $("#orderDetailModal").close();
  };
}

function openQuoteDetail(id) {
  const db = loadDb();
  const quote = db.quotes.find((item) => item.id === id);
  if (!quote) return;

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
  $("#quoteDetailModal").showModal();
  $("#closeQuoteDetail").onclick = () => $("#quoteDetailModal").close();
  $("#openQuoteImage")?.addEventListener("click", () => openChatImage(quote.image, "referencia-cotizacion.jpg"));
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
  $("#deleteProductText").textContent = `¿Seguro que quieres eliminar "${product.name}" del catálogo?`;
  $("#deleteProductModal").showModal();
}

function deleteProduct() {
  if (!pendingDeleteProductId) return;
  const db = loadDb();
  db.products = db.products.filter((product) => product.id !== pendingDeleteProductId);
  saveDb(db);
  pendingDeleteProductId = null;
  $("#deleteProductModal").close();
  renderAdmin();
  showAdminToast("Producto eliminado.");
}

function readImage(input, callback, options = {}) {
  const file = input.files?.[0];
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
  const category = $("#productCategory")?.value;
  const price = Number($("#productPrice")?.value);
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
  $("#editTitle").textContent = product.name;
  $("#editPrice").value = product.price;
  $("#editStock").value = product.stock;
  $("#editDesc").value = product.desc;
  $("#editImage").value = "";
  $("#editProductModal").showModal();
}

function saveEditProduct(event) {
  event.preventDefault();
  const db = loadDb();
  db.products = db.products.map((product) => {
    if (product.id !== editProductId) return product;
    return {
      ...product,
      price: Number($("#editPrice").value),
      stock: Math.max(0, Number($("#editStock").value)),
      desc: $("#editDesc").value.trim(),
      image: editProductImage,
      updatedAt: new Date().toISOString()
    };
  });
  saveDb(db);
  $("#editProductModal").close();
  renderAdmin();
  showAdminToast("Cambios guardados.");
}

function setupSwipeNavigation(screenOrder) {
  const app = document.querySelector(".phone-app");
  if (!app) return;
  let startX = 0;
  let startY = 0;

  app.addEventListener("touchstart", (event) => {
    if (document.querySelector("dialog[open]")) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });

  app.addEventListener("touchend", (event) => {
    if (!startX || document.querySelector("dialog[open]")) return;
    const activeScreen = document.querySelector(".mobile-screen.active")?.id;
    const index = screenOrder.indexOf(activeScreen);
    if (index < 0) return;

    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;
    startX = 0;
    startY = 0;

    if (Math.abs(diffX) < 70 || Math.abs(diffX) < Math.abs(diffY) * 1.4) return;
    const nextIndex = diffX < 0 ? index + 1 : index - 1;
    if (screenOrder[nextIndex]) go(screenOrder[nextIndex]);
  }, { passive: true });
}

function handleBackNavigation() {
  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    openDialog.close();
    return;
  }
  const activeScreen = document.querySelector(".mobile-screen.active")?.id;
  if (activeScreen && activeScreen !== "adminInicio") go("adminInicio");
}

function setupPhoneBackButton() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin?.addListener) {
    appPlugin.addListener("backButton", () => {
      handleBackNavigation();
    });
  }

  history.replaceState({ screen: "app" }, "");
  history.pushState({ screen: "app-lock" }, "");
  window.addEventListener("popstate", () => {
    handleBackNavigation();
    history.pushState({ screen: "app-lock" }, "");
  });
}

function openAdminMenu() {
  $("#adminMenuModal")?.showModal();
}

function closeAdminMenu() {
  $("#adminMenuModal")?.close();
}

// Global Event Binds
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => go(button.dataset.go));
});

$("#adminMenuBtn")?.addEventListener("click", openAdminMenu);
document.querySelectorAll("[data-menu-open]").forEach((button) => {
  button.addEventListener("click", openAdminMenu);
});

document.querySelectorAll("[data-menu-go]").forEach((button) => {
  button.addEventListener("click", () => {
    closeAdminMenu();
    go(button.dataset.menuGo);
  });
});

const safeBind = (sel, evt, fn) => {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (el) el[evt] = fn;
};

const safeEvt = (sel, evt, fn, opts) => {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (el) el.addEventListener(evt, fn, opts);
};

safeBind("#closeAdminMenu", "onclick", closeAdminMenu);
safeEvt("#adminMenuModal", "click", (event) => {
  if (event.target === $("#adminMenuModal")) closeAdminMenu();
});

safeBind("#adminChatForm", "onsubmit", sendAdminChatMessage);
safeBind("#productImage", "onchange", () => readImage($("#productImage"), (image) => {
  newProductImage = image;
  if ($("#productImagePreview")) $("#productImagePreview").innerHTML = `<img src="${image}" alt="Vista previa" />`;
  $("#productUploadTile")?.classList.add("has-image");
}, { maxSize: 1000, quality: 0.78 }));

safeBind("#editImage", "onchange", () => readImage($("#editImage"), (image) => {
  editProductImage = image;
}, { maxSize: 1000, quality: 0.78 }));

safeBind("#adminChatImage", "onchange", () => readImage($("#adminChatImage"), (image) => {
  if ($("#adminChatImage")) $("#adminChatImage").dataset.image = image;
  showAdminToast("Imagen lista para enviar.");
}, { maxSize: 1000, quality: 0.78 }));

safeEvt("#adminChatMessages", "click", (event) => {
  const image = event.target.closest("[data-chat-image]");
  if (image) openChatImage(image.dataset.chatImage, image.dataset.chatName);
});

safeBind("#closeChatImageViewer", "onclick", closeChatImageViewer);
safeEvt("#chatImageViewer", "click", (event) => {
  if (event.target === $("#chatImageViewer")) closeChatImageViewer();
});

safeBind("#saveProduct", "onclick", saveProduct);
safeBind("#saveEditProduct", "onclick", saveEditProduct);
safeBind("#closeEditProduct", "onclick", (event) => {
  event.preventDefault();
  $("#editProductModal")?.close();
});

safeBind("#confirmDeleteProduct", "onclick", (event) => {
  event.preventDefault();
  deleteProduct();
});

safeBind("#cancelDeleteProduct", "onclick", (event) => {
  event.preventDefault();
  pendingDeleteProductId = null;
  $("#deleteProductModal")?.close();
});

document.querySelectorAll("[data-report-period]").forEach((button) => {
  button.onclick = () => {
    reportPeriod = button.dataset.reportPeriod;
    renderReport(loadDb());
  };
});

safeBind("#saveUserTag", "onclick", saveUserTag);
safeBind("#closeUserTag", "onclick", (event) => {
  event.preventDefault();
  pendingUserTagPhone = "";
  $("#userTagModal")?.close();
});

window.addEventListener("focus", renderAdmin);
window.addEventListener("storage", renderAdmin);
window.addEventListener("la-lupita-db-updated", renderAdmin);
window.addEventListener("la-lupita-notification-route", (event) => openAdminNotificationRoute(event.detail?.route || ""));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) markPresence("admin", false);
  else {
    markPresence("admin");
    if (window.refreshCloudData) window.refreshCloudData();
  }
});

window.addEventListener("pagehide", () => markPresence("admin", false));
setInterval(() => { if (window.refreshCloudData) window.refreshCloudData(); }, 5000);
setInterval(() => { if (!document.hidden) markPresence("admin"); }, 9000);

setupSwipeNavigation(["adminInicio", "adminCotizaciones", "adminChats", "adminProductos"]);
setupPhoneBackButton();

if (window.LaLupitaNotifications) window.LaLupitaNotifications.init("admin");

// Initialize application directly on main screen
go("adminInicio");
markPresence("admin");
consumeAdminNotificationRoute();
