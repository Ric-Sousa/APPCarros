import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AdaptiveUIProvider } from "@/contexts/AdaptiveUIContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// O token antigo ficava no localStorage; agora a sessão usa um cookie httpOnly e o token vive só em memória
try {
  localStorage.removeItem("token");
} catch { /* armazenamento indisponível */ }

// Erros no browser são enviados ao servidor (no máximo 5 por página, para não inundar o registo)
let reported = 0;
function reportError(message: string, stack?: string) {
  if (reported++ >= 5) return;
  const body = JSON.stringify({ message: message.slice(0, 1000), stack: stack?.slice(0, 4000), url: location.href });
  fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
window.addEventListener("error", (e) => reportError(e.message || "Erro", e.error?.stack));
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { message?: string; stack?: string } | undefined;
  reportError(reason?.message ?? String(e.reason), reason?.stack);
});

// Service worker (app instalável, offline e push): em produção; em desenvolvimento só com localStorage "sw-dev" = "1"
const swEnabled = import.meta.env.PROD || (() => { try { return localStorage.getItem("sw-dev") === "1"; } catch { return false; } })();
if (swEnabled && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* sem service worker a app funciona na mesma */ });
  });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AdaptiveUIProvider>
      <App />
    </AdaptiveUIProvider>
  </QueryClientProvider>,
);
