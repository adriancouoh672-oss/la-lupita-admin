// Pega aqui la configuracion web que Firebase te entrega.
// Mientras estos datos sigan en blanco, la app funciona en modo local.
window.LA_LUPITA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDP_iT2RnBpmDx14QglxLORPILX8Ul2ArQ",
  authDomain: "la-lupita-demo.firebaseapp.com",
  databaseURL: "https://la-lupita-demo-default-rtdb.firebaseio.com",
  projectId: "la-lupita-demo",
  storageBucket: "la-lupita-demo.firebasestorage.app",
  messagingSenderId: "270499096000",
  appId: "1:270499096000:web:6ad3b34b7afa4d21d51425"
};

// Carpeta dentro de Firebase donde vivira la base provisional.
window.LA_LUPITA_FIREBASE_PATH = "la-lupita-demo";

// En la version real no queremos depender de WhatsApp.
// Si algun dia se quiere usar como respaldo temporal, cambiar a true.
window.LA_LUPITA_ENABLE_WHATSAPP_FALLBACK = false;
