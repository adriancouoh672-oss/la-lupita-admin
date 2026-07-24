const LaLupitaNotifications = (() => {
  let role = "";
  let customerPhone = "";
  let previousDb = null;
  let permissionGranted = false;
  let routeListenerReady = false;

  const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;
  const notificationId = () => Math.floor(Date.now() % 2147483647);

  async function requestPermission() {
    const localNotifications = plugin();
    if (!localNotifications?.requestPermissions) return false;
    try {
      const result = await localNotifications.requestPermissions();
      permissionGranted = result.display === "granted";
    } catch {
      permissionGranted = false;
    }
    return permissionGranted;
  }

  function openNotificationRoute(route) {
    if (!route) return;
    localStorage.setItem("la_lupita_notification_route", route);
    window.dispatchEvent(new CustomEvent("la-lupita-notification-route", { detail: { route } }));
  }

  function setupRouteListener() {
    const localNotifications = plugin();
    if (routeListenerReady || !localNotifications?.addListener) return;
    routeListenerReady = true;
    localNotifications.addListener("localNotificationActionPerformed", (event) => {
      openNotificationRoute(event.notification?.extra?.route);
    });
  }

  async function notify(title, body, route = "") {
    if (!permissionGranted && !(await requestPermission())) return;
    try {
      await plugin().schedule({
        notifications: [{
          id: notificationId(),
          title,
          body,
          schedule: { at: new Date(Date.now() + 250) },
          extra: { route }
        }]
      });
    } catch {}
  }

  function processAdmin(nextDb) {
    const oldOrderIds = new Set(previousDb.orders.map((item) => item.id));
    const oldQuoteIds = new Set(previousDb.quotes.map((item) => item.id));
    const oldChats = new Map((previousDb.chats || []).map((item) => [item.id, item]));
    const newOrder = nextDb.orders.find((item) => !oldOrderIds.has(item.id));
    const newQuote = nextDb.quotes.find((item) => !oldQuoteIds.has(item.id));
    const chatWithNewCustomerMessage = (nextDb.chats || []).find((chat) => {
      const oldCount = oldChats.get(chat.id)?.messages?.length || 0;
      const message = chat.messages?.[oldCount];
      return message?.from === "cliente";
    });
    if (newOrder) notify("Nuevo pedido", `${newOrder.customer.name} envio el pedido ${newOrder.id}.`, "adminInicio");
    if (newQuote) notify("Nueva cotizacion", `${newQuote.customer.name} envio la cotizacion ${newQuote.id}.`, "adminCotizaciones");
    if (chatWithNewCustomerMessage) notify("Nuevo mensaje", `${chatWithNewCustomerMessage.customer?.name || "Un cliente"} escribio en el chat.`, "adminChats");
  }

  function processCustomer(nextDb) {
    if (!customerPhone) return;
    const oldOrders = new Map(previousDb.orders.map((item) => [item.id, item]));
    const oldChats = new Map((previousDb.chats || []).map((item) => [item.id, item]));
    const completed = nextDb.orders.find((item) =>
      item.customer?.phone === customerPhone &&
      item.status === "Completado" &&
      oldOrders.get(item.id)?.status !== "Completado"
    );
    const chatWithAdminReply = (nextDb.chats || []).find((chat) => {
      if (chat.customer?.phone !== customerPhone) return false;
      const oldCount = oldChats.get(chat.id)?.messages?.length || 0;
      const message = chat.messages?.[oldCount];
      return message?.from === "admin";
    });
    if (completed) notify("Tu pedido esta listo", `El pedido ${completed.id} ya esta listo para recoger.`, "clienteHistorial");
    if (chatWithAdminReply) notify("Nuevo mensaje", "La panaderia respondio tu chat.", "clienteChat");
  }

  function processDb(nextDb) {
    if (!nextDb) return;
    if (!previousDb) {
      previousDb = structuredClone(nextDb);
      return;
    }
    if (role === "admin") processAdmin(nextDb);
    if (role === "cliente") processCustomer(nextDb);
    previousDb = structuredClone(nextDb);
  }

  function init(nextRole, phone = "") {
    role = nextRole;
    customerPhone = phone;
    previousDb = structuredClone(loadDb());
    setupRouteListener();
    requestPermission();
  }

  function setCustomer(phone = "") {
    customerPhone = phone;
  }

  window.addEventListener("la-lupita-db-updated", (event) => processDb(event.detail || loadDb()));
  return { init, setCustomer, requestPermission };
})();

window.LaLupitaNotifications = LaLupitaNotifications;
