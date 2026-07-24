if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Only chat uses the dynamic visual viewport. Other screens remain stable when the keyboard opens.
function syncAppViewport() {
  const height = Math.round(window.visualViewport?.height || window.innerHeight);
  document.documentElement.style.setProperty("--chat-viewport-height", `${height}px`);
}

syncAppViewport();
window.addEventListener("resize", syncAppViewport);
window.visualViewport?.addEventListener("resize", syncAppViewport);
window.visualViewport?.addEventListener("scroll", syncAppViewport);
