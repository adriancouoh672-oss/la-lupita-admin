import { getStore, saveStore } from "./store.js";

let activeTab = "orders";
let activeChatId = null;

function showToast(msg) {
  const toast = document.getElementById("toastMessage");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function openModal(html) {
  const backdrop = document.getElementById("modalBackdrop");
  const content = document.getElementById("modalContent");
  if (!backdrop || !content) return;
  content.innerHTML = html;
  backdrop.classList.add("active");
}

function closeModal() {
  const backdrop = document.getElementById("modalBackdrop");
  if (backdrop) backdrop.classList.remove("active");
}

// Navigation & Auth Control
function updateUI() {
  const store = getStore();
  const topHeader = document.getElementById("topHeader");
  const bottomNav = document.getElementById("bottomNav");

  if (!store.adminSession) {
    topHeader.style.display = "none";
    bottomNav.style.display = "none";
    switchScreen("screenLogin");
    return;
  }

  topHeader.style.display = "flex";
  bottomNav.style.display = "flex";

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === activeTab);
  });

  if (activeTab === "orders") {
    switchScreen("screenOrders");
    renderOrders(store);
  } else if (activeTab === "products") {
    switchScreen("screenProducts");
    renderProducts(store);
  } else if (activeTab === "quotes") {
    switchScreen("screenQuotes");
    renderQuotes(store);
  } else if (activeTab === "chats") {
    switchScreen("screenChats");
    renderChats(store);
  } else if (activeTab === "analytics") {
    switchScreen("screenAnalytics");
    renderAnalytics(store);
  } else if (activeTab === "users") {
    switchScreen("screenUsers");
    renderUsers(store);
  }
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen-view").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

// Login logic
function performLogin(user, pass) {
  const store = getStore();
  const loginUser = (user || "").trim().toLowerCase();
  const loginPass = (pass || "").trim();

  if (loginUser === "admin" && loginPass === "lalupita2026") {
    store.adminSession = true;
    saveStore(store);
    showToast("¡Bienvenido al Panel de Administración!");
    updateUI();
  } else {
    document.getElementById("loginError").textContent = "Credenciales incorrectas (Usa: admin / lalupita2026)";
  }
}

// Render Orders
function renderOrders(store) {
  const container = document.getElementById("ordersList");
  if (!container) return;

  if (!store.orders.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:#666;">No hay pedidos registrados aún.</div>`;
    return;
  }

  const sorted = [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  container.innerHTML = sorted.map(order => {
    const isDone = order.status === "Completado";
    const itemsText = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(", ");
    return `
      <div class="card">
        <div class="card-header">
          <strong>Pedido #${order.id}</strong>
          <span class="badge ${isDone ? 'badge-success' : 'badge-pending'}">${order.status}</span>
        </div>
        <p style="font-size:0.9rem; font-weight:700;">👤 ${order.customer?.name || "Cliente"} (${order.customer?.phone || ""})</p>
        <p style="font-size:0.85rem; color:#666; margin:6px 0;">🛒 ${itemsText}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span style="font-size:1.1rem; font-weight:800; color:var(--admin-primary);">$${Number(order.total).toFixed(2)}</span>
          <button class="btn-primary toggle-order-btn" data-id="${order.id}" style="width:auto; padding:6px 14px; font-size:0.8rem;">
            ${isDone ? "Marcar Pendiente" : "Marcar Completado"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".toggle-order-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const order = store.orders.find(o => o.id === id);
      if (order) {
        order.status = order.status === "Completado" ? "Pendiente" : "Completado";
        saveStore(store);
        showToast(`Pedido #${id} actualizado.`);
      }
    };
  });
}

// Render Products
function renderProducts(store) {
  const container = document.getElementById("productsList");
  if (!container) return;

  container.innerHTML = store.products.map(product => {
    const isDaily = store.dailyProductId === product.id;
    const isLow = product.stock <= 8 && product.stock > 0;
    const isOut = product.stock <= 0;
    return `
      <div class="card">
        <div class="card-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.8rem;">${product.icon || "🥐"}</span>
            <div>
              <strong style="font-size:1rem;">${product.name}</strong>
              <div style="font-size:0.8rem; color:#666;">$${Number(product.price).toFixed(2)} c/u · ${product.active ? 'Activo' : 'Oculto'}</div>
            </div>
          </div>
          ${isDaily ? '<span class="badge badge-info">⭐ Pan del Día</span>' : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f5f7f6; padding:10px 14px; border-radius:12px; margin:10px 0;">
          <span style="font-size:0.85rem; font-weight:700;">Existencias:</span>
          <span style="font-size:1.2rem; font-weight:800; color:${isOut ? '#dc2626' : (isLow ? '#d97706' : '#1e874b')}">
            ${isOut ? "AGOTADO" : `${product.stock} pcs`}
          </span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn-secondary stock-adj-btn" data-id="${product.id}" data-delta="5" style="flex:1; padding:6px; font-size:0.75rem;">+5 Piezas</button>
          <button class="btn-secondary daily-btn" data-id="${product.id}" style="flex:1; padding:6px; font-size:0.75rem;">${isDaily ? "Destacado" : "Hacer del Día"}</button>
          <button class="btn-secondary toggle-act-btn" data-id="${product.id}" style="flex:1; padding:6px; font-size:0.75rem;">${product.active ? "Ocultar" : "Mostrar"}</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".stock-adj-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const delta = Number(btn.dataset.delta);
      const product = store.products.find(p => p.id === id);
      if (product) {
        product.stock += delta;
        saveStore(store);
        showToast(`Stock de ${product.name} actualizado.`);
      }
    };
  });

  document.querySelectorAll(".daily-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      store.dailyProductId = id;
      saveStore(store);
      showToast("Pan del día actualizado.");
    };
  });

  document.querySelectorAll(".toggle-act-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      const product = store.products.find(p => p.id === id);
      if (product) {
        product.active = !product.active;
        saveStore(store);
        showToast("Estado de visibilidad actualizado.");
      }
    };
  });
}

// Render Quotes
function renderQuotes(store) {
  const container = document.getElementById("quotesList");
  if (!container) return;

  if (!store.quotes.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:#666;">No hay cotizaciones pendientes.</div>`;
    return;
  }

  container.innerHTML = store.quotes.map(quote => {
    const isDone = quote.status === "Respondida";
    return `
      <div class="card">
        <div class="card-header">
          <strong>Cotización #${quote.id}</strong>
          <span class="badge ${isDone ? 'badge-success' : 'badge-pending'}">${quote.status}</span>
        </div>
        <p style="font-size:0.9rem; font-weight:700;">👤 ${quote.customer?.name || "Cliente"} (${quote.customer?.phone || ""})</p>
        <p style="font-size:0.85rem; font-weight:700; color:var(--admin-primary); margin:6px 0;">🍰 ${quote.product}</p>
        <p style="font-size:0.82rem; color:#666; background:#f9f9f9; padding:8px; border-radius:8px;">"${quote.notes}"</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span style="font-size:0.8rem; color:#888;">📅 Recoger: ${quote.date || "Fecha a acordar"} ${quote.pickupTime || ""}</span>
          <button class="btn-primary toggle-quote-btn" data-id="${quote.id}" style="width:auto; padding:6px 14px; font-size:0.8rem;">
            ${isDone ? "Marcar Pendiente" : "Marcar Respondida"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".toggle-quote-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const quote = store.quotes.find(q => q.id === id);
      if (quote) {
        quote.status = quote.status === "Respondida" ? "Pendiente" : "Respondida";
        saveStore(store);
        showToast("Cotización actualizada.");
      }
    };
  });
}

// Render Chats
function renderChats(store) {
  const container = document.getElementById("chatsList");
  if (!container) return;

  if (!store.chats.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:30px; color:#666;">No hay chats activos.</div>`;
    return;
  }

  container.innerHTML = store.chats.map(chat => {
    const lastMsg = chat.messages?.[chat.messages.length - 1];
    return `
      <div class="card open-chat-card" data-id="${chat.id}" style="cursor:pointer;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>💬 ${chat.customer?.name || "Cliente"}</strong>
          <span style="font-size:0.75rem; color:#888;">${chat.customer?.phone || ""}</span>
        </div>
        <p style="font-size:0.85rem; color:#555; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${lastMsg ? `${lastMsg.from === 'admin' ? 'Tú: ' : ''}${lastMsg.text}` : 'Sin mensajes'}
        </p>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".open-chat-card").forEach(card => {
    card.onclick = () => {
      activeChatId = card.dataset.id;
      openChatDetail(activeChatId);
    };
  });
}

function openChatDetail(chatId) {
  const store = getStore();
  const chat = store.chats.find(c => c.id === chatId);
  if (!chat) return;

  document.getElementById("chatDetailTitle").textContent = `Chat con ${chat.customer?.name || "Cliente"}`;
  const box = document.getElementById("chatMessagesBox");
  box.innerHTML = (chat.messages || []).map(m => `
    <div style="margin-bottom:8px; text-align:${m.from === 'admin' ? 'right' : 'left'};">
      <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:14px; font-size:0.88rem; background:${m.from === 'admin' ? 'var(--admin-primary)' : '#e4ece8'}; color:${m.from === 'admin' ? '#fff' : '#1f2926'};">
        ${m.text}
      </div>
    </div>
  `).join("");

  box.scrollTop = box.scrollHeight;
  switchScreen("screenChatDetail");
}

// Render Analytics
function renderAnalytics(store) {
  const container = document.getElementById("analyticsContent");
  if (!container) return;

  const totalSales = store.orders
    .filter(o => o.status === "Completado")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const completedCount = store.orders.filter(o => o.status === "Completado").length;

  container.innerHTML = `
    <div class="card" style="background:var(--admin-primary); color:#fff; text-align:center; padding:24px;">
      <span style="font-size:0.85rem; opacity:0.85;">Total Ventas Completadas</span>
      <h2 style="font-size:2.2rem; font-family:'Outfit',sans-serif; margin-top:4px;">$${totalSales.toFixed(2)}</h2>
      <p style="font-size:0.8rem; opacity:0.9; margin-top:6px;">${completedCount} pedidos completados con éxito</p>
    </div>

    <div class="card">
      <h3 style="font-size:1rem; font-family:'Outfit',sans-serif; margin-bottom:10px;">Resumen General</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
        <div style="background:#f5f7f6; padding:12px; border-radius:12px;">
          <span style="font-size:0.75rem; color:#666;">Productos Activos</span>
          <strong style="display:block; font-size:1.4rem; color:var(--admin-primary);">${store.products.filter(p=>p.active).length}</strong>
        </div>
        <div style="background:#f5f7f6; padding:12px; border-radius:12px;">
          <span style="font-size:0.75rem; color:#666;">Clientes Registrados</span>
          <strong style="display:block; font-size:1.4rem; color:var(--admin-primary);">${store.customers.length}</strong>
        </div>
      </div>
    </div>
  `;
}

// Render Users
function renderUsers(store) {
  const container = document.getElementById("usersList");
  if (!container) return;

  container.innerHTML = store.customers.map(c => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>👤 ${c.name}</strong>
        <div style="font-size:0.8rem; color:#666;">📞 ${c.phone}</div>
      </div>
      <span class="badge badge-info">${c.tag || "Cliente"}</span>
    </div>
  `).join("");
}

// Add New Product Modal
function openNewProductModal() {
  openModal(`
    <h3 style="font-family:'Outfit',sans-serif; margin-bottom:14px; color:var(--admin-primary);">Agregar Nuevo Producto</h3>
    <div class="form-group">
      <label>Nombre del Producto</label>
      <input type="text" id="newProdName" class="input-field" placeholder="Ej. Dona de Chocolate" />
    </div>
    <div class="form-group">
      <label>Precio ($)</label>
      <input type="number" id="newProdPrice" class="input-field" placeholder="18" />
    </div>
    <div class="form-group">
      <label>Piezas Iniciales</label>
      <input type="number" id="newProdStock" class="input-field" placeholder="25" />
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="newProdDesc" class="input-field" placeholder="Descripción breve" />
    </div>
    <button class="btn-primary" id="saveNewProdBtn">Guardar Producto</button>
    <button class="btn-secondary" id="closeModalBtn">Cancelar</button>
  `);

  document.getElementById("closeModalBtn").onclick = closeModal;
  document.getElementById("saveNewProdBtn").onclick = () => {
    const name = document.getElementById("newProdName").value.trim();
    const price = Number(document.getElementById("newProdPrice").value);
    const stock = Number(document.getElementById("newProdStock").value || 0);
    const desc = document.getElementById("newProdDesc").value.trim();

    if (!name || !price) {
      showToast("Escribe nombre y precio válido.");
      return;
    }

    const store = getStore();
    store.products.push({
      id: Date.now(),
      name,
      category: "dulce",
      price,
      stock,
      icon: "🍩",
      desc: desc || "Producto recién horneado.",
      active: true,
      image: ""
    });

    saveStore(store);
    closeModal();
    showToast("¡Producto creado con éxito!");
    updateUI();
  };
}

// Event Listeners Initializer
document.addEventListener("DOMContentLoaded", () => {
  // Login handlers
  document.getElementById("loginSubmitBtn").onclick = () => {
    const u = document.getElementById("adminUser").value;
    const p = document.getElementById("adminPass").value;
    performLogin(u, p);
  };

  document.getElementById("loginDemoBtn").onclick = () => {
    performLogin("admin", "lalupita2026");
  };

  document.getElementById("logoutBtn").onclick = () => {
    const store = getStore();
    store.adminSession = false;
    saveStore(store);
    showToast("Sesión cerrada.");
    updateUI();
  };

  // Nav Tab Buttons
  document.querySelectorAll(".nav-item[data-tab]").forEach(item => {
    item.onclick = () => {
      activeTab = item.dataset.tab;
      updateUI();
    };
  });

  // Open New Product
  const openNewProductBtn = document.getElementById("openNewProductBtn");
  if (openNewProductBtn) openNewProductBtn.onclick = openNewProductModal;

  // Chat back button
  const backBtn = document.getElementById("backToChatsBtn");
  if (backBtn) backBtn.onclick = () => {
    activeTab = "chats";
    updateUI();
  };

  // Chat send message
  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn) sendBtn.onclick = () => {
    const input = document.getElementById("chatInputText");
    const text = (input.value || "").trim();
    if (!text || !activeChatId) return;

    const store = getStore();
    const chat = store.chats.find(c => c.id === activeChatId);
    if (chat) {
      chat.messages ||= [];
      chat.messages.push({
        id: "M" + Date.now(),
        from: "admin",
        text,
        createdAt: new Date().toISOString()
      });
      saveStore(store);
      input.value = "";
      openChatDetail(activeChatId);
    }
  };

  // Live Sync Listeners across tabs
  window.addEventListener("lupita-store-change", () => updateUI());
  window.addEventListener("storage", () => updateUI());

  // Initial render
  updateUI();
});
