import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { ErroBoundary } from "@/components/ErroBoundary";
import { Layout } from "@/components/Layout";
import { Configurar } from "@/components/Configurar";
import { precisaConfigurar } from "@/lib/config";
import { iniciarCicloDaFila, processarFila } from "@/lib/fila";
import { registrarServiceWorker } from "@/pwa/registrar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-muted-foreground">Esta tela não existe.</p>
      <Link to="/" className="botao-primario max-w-xs">Voltar para a previsão</Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">Esta tela não carregou</h1>
      <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erro inesperado."}</p>
      <button
        className="botao-primario max-w-xs"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "PREP — Previsão de parada dos teares" },
      { name: "description", content: "Previsão de parada, FAT, estoque de rolos, urdideira e engomadeira ligados à planilha." },
      { name: "theme-color", content: "#0f1b2d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "PREP" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "PREP — Previsão de parada dos teares" },
      { property: "og:description", content: "App da tecelagem e preparação ligado à planilha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // App 100% no aparelho (PIN, fila, cache): só renderiza depois de montar no navegador.
  const [montado, setMontado] = useState(false);
  const [configurar, setConfigurar] = useState(false);

  useEffect(() => {
    setMontado(true);
    setConfigurar(precisaConfigurar());
    registrarServiceWorker();
    iniciarCicloDaFila();
    void processarFila();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErroBoundary>
        {!montado ? (
          <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>
        ) : configurar ? (
          <Configurar aoConcluir={() => setConfigurar(false)} />
        ) : (
          <Layout />
        )}
      </ErroBoundary>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
