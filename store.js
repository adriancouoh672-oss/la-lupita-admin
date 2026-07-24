// Panadería La Lupita - Central Store Module
const STORE_KEY = "la_lupita_store_v2";

const initialStore = {
  bakery: {
    name: "Panadería La Lupita",
    phone: "+52 999 123 4567",
    address: "Calle 60 #456, Centro, Mérida, Yucatán"
  },
  dailyProductId: 1,
  adminSession: false,
  adminUser: "admin",
  adminPass: "lalupita2026",
  products: [
    { id: 1, name: "Concha de Vainilla", category: "dulce", price: 14, icon: "🥐", stock: 24, desc: "Pan dulce tradicional esponjoso con costra azucarada de vainilla.", active: true, image: "assets/logo-lupita-nuevo.jpeg" },
    { id: 2, name: "Bolillo Calientito", category: "salado", price: 5, icon: "🥖", stock: 80, desc: "Bolillo crujiente recién horneado ideal para tortas o acompañar.", active: true, image: "" },
    { id: 3, name: "Cuernito de Mantequilla", category: "dulce", price: 16, icon: "🥐", stock: 18, desc: "Cuernito dorado hojaldrado con intenso sabor a mantequilla.", active: true, image: "" },
    { id: 4, name: "Rebanada de Pastel de Chocolate", category: "postres", price: 42, icon: "🍰", stock: 10, desc: "Pastel suave de chocolate con cobertura cremoso fudge.", active: true, image: "" },
    { id: 5, name: "Flan Napolitano Casero", category: "postres", price: 28, icon: "🍮", stock: 12, desc: "Flan tradicional de leche condensada con caramelo líquido.", active: true, image: "" },
    { id: 6, name: "Café de Olla Tradicional", category: "bebidas", price: 25, icon: "☕", stock: 30, desc: "Café de grano infusionado con canela y piloncillo.", active: true, image: "" }
  ],
  orders: [
    {
      id: "PED-101",
      customer: { name: "María López", phone: "9991234567" },
      items: [
        { id: 1, name: "Concha de Vainilla", quantity: 4, price: 14 },
        { id: 6, name: "Café de Olla Tradicional", quantity: 2, price: 25 }
      ],
      total: 106,
      pickupTime: "18:00",
      status: "Pendiente",
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "PED-102",
      customer: { name: "Carlos Mendoza", phone: "9998765432" },
      items: [
        { id: 2, name: "Bolillo Calientito", quantity: 10, price: 5 }
      ],
      total: 50,
      pickupTime: "19:30",
      status: "Completado",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  quotes: [
    {
      id: "COT-201",
      customer: { name: "Ana Martínez", phone: "9995554433" },
      product: "Pastel de 3 Leches para 30 personas",
      date: "2026-08-15",
      pickupTime: "17:00",
      notes: "Decoración con fresas naturales y letrero de 'Feliz Cumpleaños'",
      image: "",
      status: "Pendiente",
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ],
  customers: [
    { name: "María López", phone: "9991234567", tag: "Cliente frecuente", photo: "", lastLogin: "Hoy" },
    { name: "Carlos Mendoza", phone: "9998765432", tag: "Cliente", photo: "", lastLogin: "Ayer" },
    { name: "Ana Martínez", phone: "9995554433", tag: "VIP", photo: "", lastLogin: "Hoy" }
  ],
  chats: [
    {
      id: "CHAT-901",
      customer: { name: "María López", phone: "9991234567" },
      updatedAt: new Date().toISOString(),
      messages: [
        { id: "M1", from: "cliente", text: "¡Hola! ¿A qué hora tienen conchas recién salidas?", createdAt: new Date(Date.now() - 1800000).toISOString() },
        { id: "M2", from: "admin", text: "¡Hola María! Salen calientitas a las 5:00 p.m.", createdAt: new Date(Date.now() - 900000).toISOString() }
      ]
    }
  ]
};

export function getStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      localStorage.setItem(STORE_KEY, JSON.stringify(initialStore));
      return structuredClone(initialStore);
    }
    const parsed = JSON.parse(raw);
    return { ...initialStore, ...parsed };
  } catch (err) {
    console.error("Store read error:", err);
    return structuredClone(initialStore);
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("lupita-store-change", { detail: store }));
  } catch (err) {
    console.error("Store save error:", err);
  }
}
