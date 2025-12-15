import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* 🔥 CAPTURA GLOBAL DE ERRORES */
window.addEventListener("error", (event) => {
  console.error("🔥 Global Error:", event.error || event.message, event);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("🔥 Unhandled Promise Rejection:", event.reason);
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
