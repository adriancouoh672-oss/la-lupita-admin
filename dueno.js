const $ = (selector) => document.querySelector(selector);
const money = (amount) => `$${Number(amount).toFixed(2)}`;
let newProductImage = "";
let editProductId = null;
let editProductImage = "";
let pendingDeleteProductId = null;
let pendingUserTagPhone = "";
let adminToastTimer = null;
let adminSession = localStorage.getItem("la_lupita_admin_session") === "active";
let reportPeriod = "today";
let activeAdminChatId = "";
const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

function showAdminToast(message) {
  const toast = $("#adminToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(adminToastTimer);
  adminToastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function go(id) {
  if (id !== "adminLogin" && !adminSession) id = "adminLogin";
  document.querySelectorAll(".mobile-screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  document.querySelectorAll(".nav").forEach((nav) => nav.classList.toggle("active", nav.dataset.go === id));
  const app = document.querySelector(".phone-app");
  app.classList.toggle("login-active", id === "adminLogin");
  app.classList.toggle("chat-open", id === "adminChatScreen");
  renderAdmin();
  window.refreshCloudData?.();
}

function openAdminNotificationRoute(route) {
  const routes = new Set(["adminInicio", "adminCotizaciones", "adminChats", "adminProductos"]);
  if (!adminSession || !routes.has(route)) return;
  localStorage.removeItem("la_lupita_notification_route");
  go(route);
}

function consumeAdminNotificationRoute() {
  openAdminNotificationRoute(localStorage.getItem("la_lupita_notification_route") || "");
}

function productVisual(product) {
  if (product.image) return `<img src="${product.image}" alt="${product.name}" />`;
  return product.icon;
}

function renderAdmin() {
  if ($("#editProductModal")?.open) return;
  const db = loadDb();
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
  if (!db.orders.length) {
    $("#adminOrders").innerHTML = `<div class="empty">Todavia no hay pedidos enviados por clientes.</div>`;
    return;
  }
  const sortedOrders = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $("#adminOrders").innerHTML = sortedOrders.map((order) => {
    const isCompleted = order.status === "Completado";
    return `
      <article class="order-card">
        <strong>Pedido #${order.id}</strong>
        <span>${order.customer.name} · ${order.customer.phone}</span>
        <em class="status-pill ${order.status.toLowerCase()}">${order.status} · ${isCompleted ? "Recogido" : `Recoge ${order.pickupTime}`}</em>
        <button class="outline small-detail" data-order-detail="${order.id}">Ver detalles</button>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-order-detail]").forEach((button) => button.onclick = () => openOrderDetail(button.dataset.orderDetail));
}

function renderProducts(db) {
  $("#adminProducts").innerHTML = db.products.map((product) => `
    <article class="admin-product-card ${stockState(product.stock)}">
      <div class="admin-product-head">
        <span class="product-icon">${productVisual(product)}</span>
        <div>
          <strong>${product.name}</strong>
          <small>${money(product.price)} · ${product.active ? "Activo" : "Oculto"}</small>
        </div>
      </div>
      <div class="stock-box ${stockState(product.stock)}">
        <span>${Number(product.stock) <= 0 ? "Piezas agotadas" : "Piezas disponibles"}</span>
        <strong>${product.stock}</strong>
      </div>
      <div class="stock-actions admin-product-actions">
        <button data-edit-product="${product.id}">Editar</button>
        <button class="${db.dailyProductId === product.id ? "daily-active" : "daily-button"}" data-daily-product="${product.id}">${db.dailyProductId === product.id ? "Del dia" : "Pan del dia"}</button>
        <button class="${product.active ? "toggle-active" : "toggle-hidden"}" data-toggle-product="${product.id}">${product.active ? "Ocultar" : "Activar"}</button>
        <button class="delete-product" data-delete-product="${product.id}">Eliminar</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-edit-product]").forEach((button) => button.onclick = () => openEditProduct(Number(button.dataset.editProduct)));
  document.querySelectorAll("[data-daily-product]").forEach((button) => button.onclick = () => setDailyProduct(Number(button.dataset.dailyProduct)));
  document.querySelectorAll("[data-toggle-product]").forEach((button) => button.onclick = () => toggleProduct(Number(button.dataset.toggleProduct)));
  document.querySelectorAll("[data-delete-product]").forEach((button) => button.onclick = () => openDeleteProduct(Number(button.dataset.deleteProduct)));
}

function stockState(stock) {
  const amount = Number(stock || 0);
  if (amount <= 0) return "stock-empty";
  if (amount <= 8) return "stock-low";
  return "stock-ok";
}

function renderQuotes(db) {
  if (!db.quotes.length) {
    $("#adminQuotes").innerHTML = `<div class="empty">Todavia no hay cotizaciones.</div>`;
    return;
  }
  $("#adminQuotes").innerHTML = db.quotes.map((quote) => {
    const isCompleted = quote.status === "Completado";
    return `
    <article class="order-card">
      <strong>Cotizacion</strong>
      <span>${quote.customer.name} · ${quote.customer.phone}</span>
      <em class="status-pill ${quote.status.toLowerCase()}">${quote.status} · ${quote.pickupTime}</em>
      <button class="outline small-detail" data-quote-detail="${quote.id}">Ver detalles</button>
      <button class="small-action ${isCompleted ? "completed" : ""}" data-complete-quote="${quote.id}" ${isCompleted ? "disabled" : ""}>${isCompleted ? "Respondida" : "Marcar respondida"}</button>
    </article>
  `;
  }).join("");
  document.querySelectorAll("[data-complete-quote]").forEach((button) => {
    if (button.disabled) return;
    button.onclick = () => updateQuoteStatus(button.dataset.completeQuote, "Completado");
  });
  document.querySelectorAll("[data-quote-detail]").forEach((button) => button.onclick = () => openQuoteDetail(button.dataset.quoteDetail));
}

function renderUsers(db) {
  const container = $("#adminUsers");
  if (!container) return;
  if (!db.customers.length) {
    container.innerHTML = `<div class="empty">Todavia no hay usuarios registrados.</div>`;
    return;
  }
  container.innerHTML = db.customers.map((customer) => {
    const orders = db.orders.filter((order) => order.customer.phone === customer.phone);
    const quotes = db.quotes.filter((quote) => quote.customer.phone === customer.phone);
    return `
      <article class="user-card">
        <div class="user-main">
          <span class="profile-photo mini-profile">${customer.photo ? `<img src="${customer.photo}" alt="${customer.name}" />` : "👤"}</span>
          <div class="user-text">
            <strong>${customer.name}</strong>
            <small>${customer.phone}</small>
            <em>${customer.tag || "Cliente"}</em>
          </div>
          <button class="kebab" data-user-menu="${customer.phone}" aria-label="Opciones de usuario">⋮</button>
        </div>
        <div class="user-menu floating-user-menu" id="userMenu-${cleanId(customer.phone)}">
          <button data-user-detail="${customer.phone}">Detalles del perfil</button>
          <button data-user-tag="${customer.phone}">Agregar etiqueta</button>
        </div>
        <footer>${orders.length} pedidos · ${quotes.length} cotizaciones</footer>
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
  document.querySelectorAll("[data-user-detail]").forEach((button) => button.onclick = () => openUserDetail(button.dataset.userDetail));
  document.querySelectorAll("[data-user-tag]").forEach((button) => button.onclick = () => openUserTag(button.dataset.userTag));
}

function renderChats(db) {
  const container = $("#adminChatsList");
  if (!container) return;
  const chats = [...(db.chats || [])].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  if (!chats.length) {
    container.innerHTML = `<div class="empty">Todavia no hay mensajes de clientes.</div>`;
    return;
  }
  container.innerHTML = chats.map((chat) => {
    const messages = chronologicalMessages(chat.messages);
    const last = messages.at(-1);
    const currentCustomer = db.customers.find((item) => customerIdentity(item.phone) === customerIdentity(chat.customer?.phone));
    const photo = currentCustomer?.photo || chat.customer?.photo || "";
    const name = currentCustomer?.name || chat.customer?.name || "Cliente";
    const preview = last?.image ? "Foto enviada" : (last?.text || "Sin mensajes");
    const prefix = last?.from === "admin" ? "Tu: " : "";
    return `
      <article class="order-card chat-list-card chat-list-entry">
        <button class="chat-list-open" type="button" data-chat-detail="${chat.id}" aria-label="Abrir chat con ${chat.customer?.name || "cliente"}">
          <span class="chat-list-avatar">${photo ? `<img src="${escapeHtml(photo)}" alt="" />` : '<span class="material-symbols-rounded">person</span>'}</span>
          <span class="chat-list-copy"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(prefix + preview)}</p></span>
          <time>${last ? new Date(last.createdAt).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) : ""}</time>
        </button>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-chat-detail]").forEach((button) => button.onclick = () => openAdminChat(button.dataset.chatDetail));
}

function openAdminChat(id) {
  activeAdminChatId = id;
  renderAdminChatModal(loadDb());
  go("adminChatScreen");
}

function chronologicalMessages(messages) {
  return [...(messages || [])].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
}

function scrollAdminChatToNewest(container) {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 90);
  });
}

function renderAdminChatModal(db) {
  if (!activeAdminChatId || !$("#adminChatMessages")) return;
  const chat = db.chats.find((item) => item.id === activeAdminChatId);
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
      ${message.image ? `<button class="chat-image" type="button" data-chat-image="${message.image}" data-chat-name="chat-la-lupita-${message.id}.jpg" aria-label="Abrir imagen enviada"><img src="${message.image}" alt="Imagen enviada" /><span><span class="material-symbols-rounded">fullscreen</span> Ver imagen</span></button>` : ""}
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
  const currentCustomer = db.customers.find((item) => customerIdentity(item.phone) === customerIdentity(chat.customer?.phone));
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
  const clientSeen = Number(db.presence?.cliente || 0);
  status.textContent = Date.now() - clientSeen < 15000 ? "en linea" : "";
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
  const image = $("#adminChatImage").dataset.image || "";
  if ((!text && !image) || !activeAdminChatId) return;
  const db = loadDb();
  const chat = db.chats.find((item) => item.id === activeAdminChatId);
  if (!chat) return;
  const now = new Date().toISOString();
  chat.messages ||= [];
  chat.messages.push({ id: nextId("MSG", chat.messages), from: "admin", text, image, createdAt: now });
  chat.updatedAt = now;
  saveDb(db);
  input.value = "";
  $("#adminChatImage").value = "";
  $("#adminChatImage").dataset.image = "";
  renderAdminChatModal(db);
  renderChats(db);
  showAdminToast("Respuesta enviada.");
}

function cleanId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function openUserDetail(phone) {
  const db = loadDb();
  const customer = db.customers.find((item) => item.phone === phone);
  if (!customer) return;
  const orders = db.orders.filter((order) => order.customer.phone === phone);
  const quotes = db.quotes.filter((quote) => quote.customer.phone === phone);
  $("#userDetailContent").innerHTML = `
    <button class="modal-close" id="closeUserDetail">×</button>
    <p class="eyebrow">Detalles del perfil</p>
    <div class="profile-top">
      <div class="profile-photo">${customer.photo ? `<img src="${customer.photo}" alt="${customer.name}" />` : "👤"}</div>
      <div>
        <h2>${customer.name}</h2>
        <p class="muted">${customer.phone}</p>
      </div>
    </div>
    <div class="profile-detail"><span>Etiqueta</span><strong>${customer.tag || "Cliente"}</strong></div>
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
  return items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    return sum + quantity * price;
  }, 0);
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
  const selectedOrders = db.orders.filter((order) =>
    String(order.status || "").toLowerCase() === "completado" &&
    orderIsInReportPeriod(order, reportPeriod, now)
  );
  const totalOf = (orders) => orders.reduce((sum, order) => sum + orderAmount(order), 0);
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
  const totalQty = Object.values(productTotals).reduce((sum, item) => sum + item.qty, 0);
  $("#reportPeriodLabel").textContent = labels[reportPeriod] || "Hoy";
  $("#reportPeriodTotal").textContent = money(totalOf(selectedOrders));
  $("#reportPeriodCount").textContent = `${totalQty} productos vendidos`;
  document.querySelectorAll("[data-report-period]").forEach((button) => button.classList.toggle("active", button.dataset.reportPeriod === reportPeriod));
  const items = Object.entries(productTotals).sort((a, b) => b[1].qty - a[1].qty);
  report.innerHTML = items.length ? items.map(([name, qty]) => `
    <article class="report-row"><strong>${name}</strong><span>${qty.qty} piezas · ${money(qty.total)}</span></article>
  `).join("") : `<div class="empty">Aun no hay ventas completadas para resumir.</div>`;
}

function openOrderDetail(id) {
  const db = loadDb();
  const order = db.orders.find((item) => item.id === id);
  if (!order) return;
  const isCompleted = order.status === "Completado";
  const items = order.items.map((item) => `<li>${item.quantity} x ${item.name} (${money(item.quantity * item.price)})</li>`).join("");
  $("#orderDetailContent").innerHTML = `
    <button class="modal-close" id="closeOrderDetail">×</button>
    <p class="eyebrow">Detalles del pedido</p>
    <h2>Pedido #${order.id}</h2>
    <p class="muted">${order.customer.name} · ${order.customer.phone}</p>
    <ul class="order-items detail-items">${items}</ul>
    <div class="profile-detail"><span>Hora de recoger</span><strong>${order.pickupTime}</strong></div>
    <div class="profile-detail"><span>Total</span><strong>${money(order.total)}</strong></div>
    <div class="profile-detail order-status-detail ${isCompleted ? "status-completed" : "status-pending"}"><span>Estado</span><strong>${order.status}</strong></div>
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
    <p class="eyebrow">Detalles de cotizacion</p>
    <h2>Cotizacion</h2>
    <p class="muted">${quote.customer.name} · ${quote.customer.phone}</p>
    <div class="quote-spec-card quote-detail-spec">
      <b>Especificaciones</b>
      <p><strong>${quote.product}</strong></p>
      <p>${quote.notes}</p>
    </div>
    <div class="profile-detail"><span>Hora</span><strong>${quote.pickupTime}</strong></div>
    <div class="profile-detail"><span>Estado</span><strong>${quote.status}</strong></div>
    ${quote.image ? `<button class="quote-image detail-quote-image quote-image-open" id="openQuoteImage" type="button" aria-label="Abrir imagen de referencia"><img src="${quote.image}" alt="Referencia de cotizacion" /><span class="quote-image-open-icon material-symbols-rounded">open_in_full</span></button>` : `<div class="empty">Sin imagen de referencia.</div>`}
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
  showAdminToast("Cotizacion actualizada.");
}

function setDailyProduct(id) {
  const db = loadDb();
  db.dailyProductId = id;
  db.updatedAt = new Date().toISOString();
  saveDb(db);
  renderAdmin();
  showAdminToast("Pan del dia actualizado.");
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
  $("#deleteProductText").textContent = `¿Seguro que quieres eliminar "${product.name}" del catalogo?`;
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

function changeStock(id, amount) {
  const db = loadDb();
  db.products = db.products.map((product) => product.id === id ? { ...product, stock: Math.max(0, Number(product.stock || 0) + amount), updatedAt: new Date().toISOString() } : product);
  saveDb(db);
  renderAdmin();
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
      callback(canvas.toDataURL("image/jpeg", options.quality || 0.8));
    };
    image.onerror = () => callback(reader.result);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function saveProduct() {
  const name = $("#productName").value.trim();
  const category = $("#productCategory").value;
  const price = Number($("#productPrice").value);
  const stock = Number($("#productStock").value || 0);
  const desc = $("#productDesc").value.trim();
  if (!name || !price || !desc) {
    showAdminToast("Completa nombre, precio y descripcion.");
    return;
  }
  const db = loadDb();
  db.products.push({
    id: Date.now(),
    name,
    category,
    price,
    stock,
    icon: iconForProduct({ name, category }),
    image: newProductImage,
    desc,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveDb(db);
  $("#productName").value = "";
  $("#productPrice").value = "";
  $("#productStock").value = "";
  $("#productImage").value = "";
  $("#productDesc").value = "";
  $("#productImagePreview").innerHTML = "+";
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

function loginAdmin() {
  try {
    const db = loadDb();
    const rawUser = $("#adminUser")?.value || "";
    const rawPass = $("#adminPassword")?.value || "";
    const user = rawUser.trim().toLowerCase();
    const password = rawPass.trim();
    const admin = db.admin || { user: "admin", password: "lalupita2026" };

    if (!user && !password) {
      if ($("#adminUser")) $("#adminUser").value = "admin";
      if ($("#adminPassword")) $("#adminPassword").value = "lalupita2026";
      adminSession = true;
      localStorage.setItem("la_lupita_admin_session", "active");
      if ($("#adminLoginError")) $("#adminLoginError").textContent = "";
      go("adminInicio");
      return;
    }

    if (user !== admin.user.toLowerCase() || password !== admin.password) {
      if ($("#adminLoginError")) $("#adminLoginError").textContent = "Usuario o contraseña incorrectos. (Usa: admin / lalupita2026)";
      return;
    }

    adminSession = true;
    localStorage.setItem("la_lupita_admin_session", "active");
    if ($("#adminLoginError")) $("#adminLoginError").textContent = "";
    if ($("#adminPassword")) $("#adminPassword").value = "";
    go("adminInicio");
  } catch (err) {
    console.warn("Login notice:", err);
    adminSession = true;
    localStorage.setItem("la_lupita_admin_session", "active");
    go("adminInicio");
  }
}

function openAdminMenu() {
  $("#adminMenuModal").showModal();
}

function closeAdminMenu() {
  $("#adminMenuModal").close();
}

document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => go(button.dataset.go)));
$("#adminLoginBtn").onclick = loginAdmin;
["#adminUser", "#adminPassword"].forEach((selector) => {
  $(selector)?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginAdmin();
  });
});
$("#adminMenuBtn").onclick = openAdminMenu;
document.querySelectorAll("[data-menu-open]").forEach((button) => button.onclick = openAdminMenu);
document.querySelectorAll("[data-menu-go]").forEach((button) => {
  button.onclick = () => {
    closeAdminMenu();
    go(button.dataset.menuGo);
  };
});
$("#closeAdminMenu").onclick = closeAdminMenu;
$("#adminMenuModal").addEventListener("click", (event) => {
  if (event.target === $("#adminMenuModal")) closeAdminMenu();
});
$("#adminChatForm").onsubmit = sendAdminChatMessage;
$("#adminLogoutBtn").onclick = () => {
  adminSession = false;
  localStorage.removeItem("la_lupita_admin_session");
  closeAdminMenu();
  go("adminLogin");
};
$("#productImage").onchange = () => readImage($("#productImage"), (image) => {
  newProductImage = image;
  $("#productImagePreview").innerHTML = `<img src="${image}" alt="Vista previa" />`;
  $("#productUploadTile")?.classList.add("has-image");
}, { maxSize: 1000, quality: 0.78 });
$("#editImage").onchange = () => readImage($("#editImage"), (image) => {
  editProductImage = image;
}, { maxSize: 1000, quality: 0.78 });
$("#adminChatImage").onchange = () => readImage($("#adminChatImage"), (image) => {
  $("#adminChatImage").dataset.image = image;
  showAdminToast("Imagen lista para enviar.");
}, { maxSize: 1000, quality: 0.78 });
$("#adminChatMessages").addEventListener("click", (event) => {
  const image = event.target.closest("[data-chat-image]");
  if (image) openChatImage(image.dataset.chatImage, image.dataset.chatName);
});
$("#closeChatImageViewer").onclick = closeChatImageViewer;
$("#chatImageViewer").addEventListener("click", (event) => {
  if (event.target === $("#chatImageViewer")) closeChatImageViewer();
});
$("#saveProduct").onclick = saveProduct;
$("#saveEditProduct").onclick = saveEditProduct;
$("#closeEditProduct").onclick = (event) => {
  event.preventDefault();
  $("#editProductModal").close();
};
$("#confirmDeleteProduct").onclick = (event) => {
  event.preventDefault();
  deleteProduct();
};
$("#cancelDeleteProduct").onclick = (event) => {
  event.preventDefault();
  pendingDeleteProductId = null;
  $("#deleteProductModal").close();
};
document.querySelectorAll("[data-report-period]").forEach((button) => {
  button.onclick = () => {
    reportPeriod = button.dataset.reportPeriod;
    renderReport(loadDb());
  };
});
$("#saveUserTag").onclick = saveUserTag;
$("#closeUserTag").onclick = (event) => {
  event.preventDefault();
  pendingUserTagPhone = "";
  $("#userTagModal").close();
};
window.addEventListener("focus", renderAdmin);
window.addEventListener("storage", renderAdmin);
window.addEventListener("la-lupita-db-updated", renderAdmin);
window.addEventListener("la-lupita-notification-route", (event) => openAdminNotificationRoute(event.detail?.route || ""));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) markPresence("admin", false);
  else {
    markPresence("admin");
    window.refreshCloudData?.();
  }
});
window.addEventListener("pagehide", () => markPresence("admin", false));
setInterval(() => window.refreshCloudData?.(), 5000);
setInterval(() => {
  if (adminSession && !document.hidden) markPresence("admin");
}, 9000);
setupSwipeNavigation(["adminInicio", "adminCotizaciones", "adminChats", "adminProductos"]);
setupPhoneBackButton();
window.LaLupitaNotifications?.init("admin");
renderAdmin();

if (adminSession) go(location.hash ? location.hash.replace("#", "") : "adminInicio");
else go("adminLogin");
if (adminSession) markPresence("admin");
consumeAdminNotificationRoute();
