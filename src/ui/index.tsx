/* entry: mounts the terminal shell */
import { render } from "solid-js/web";
import App from "./App";
import "./terminal.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

render(() => <App />, root);

/* PWA offline support (browser only).
 * The production build is one inlined HTML file, so caching the document is
 * enough for offline launches. Skipped in dev (HMR) and in native shells
 * (Tauri: tauri:// protocol, Capacitor: bundle-local, both work offline
 * already without a service worker). */
if (import.meta.env.PROD && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href).catch(() => {
      /* offline install is a bonus — ignore registration failures */
    });
  });
}
