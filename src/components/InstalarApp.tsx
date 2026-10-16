import { useEffect, useState } from "react";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
}

/** Botão "instalar app" no Android e instrução para iPhone. */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    const instalado = window.matchMedia("(display-mode: standalone)").matches;
    if (instalado) return;
    setIphone(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (evento) {
    return (
      <button className="botao-secundario mt-6" onClick={() => void evento.prompt().then(() => setEvento(null))}>
        Instalar app no celular
      </button>
    );
  }
  if (iphone) {
    return (
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Para instalar no iPhone: toque em Compartilhar → Adicionar à Tela de Início.
      </p>
    );
  }
  return null;
}
