// Registro do service worker — único ponto de registro do app.
// Nunca registra em dev, preview do Lovable ou iframe. Suporta ?sw=off.
import { registerSW } from "virtual:pwa-register";

function contextoRecusado(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function desregistrar(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => r.active?.scriptURL.endsWith("/sw.js"))
      .map((r) => r.unregister()),
  );
}

export function registrarServiceWorker(): void {
  if (contextoRecusado()) {
    void desregistrar();
    return;
  }
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Avisa o usuário em vez de recarregar sozinho no meio de um formulário.
      window.dispatchEvent(new CustomEvent("prep:atualizacao-disponivel"));
    },
  });
}
