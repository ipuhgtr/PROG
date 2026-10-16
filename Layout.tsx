import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Factory,
  Gauge,
  Home,
  Package,
  Settings,
  Upload,
  ListChecks,
} from "lucide-react";
import { useEffect, useState } from "react";
import { listarFila, aoMudarFila } from "@/lib/fila";
import { modoDemo } from "@/lib/config";
import { hora } from "@/lib/format";
import { useDados } from "@/hooks/useDados";

const NAV = [
  { para: "/", rotulo: "Previsão", icone: Home },
  { para: "/fat", rotulo: "FAT", icone: ClipboardList },
  { para: "/estoque", rotulo: "Estoque", icone: Package },
  { para: "/preparacao", rotulo: "Preparação", icone: Factory },
  { para: "/pendentes", rotulo: "Pendentes", icone: ListChecks },
] as const;

export function Layout() {
  const { data } = useDados();
  const [pendentes, setPendentes] = useState(0);
  const [atualizacao, setAtualizacao] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const atualizar = () => void listarFila().then((l) => setPendentes(l.length));
    atualizar();
    return aoMudarFila(atualizar);
  }, []);

  useEffect(() => {
    const aviso = () => setAtualizacao(true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("prep:atualizacao-disponivel", aviso);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("prep:atualizacao-disponivel", aviso);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const itens = NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="seguro-topo sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">PREP</span>
            {modoDemo() && (
              <span className="rounded-full bg-alerta px-2 py-0.5 text-xs font-bold text-alerta-foreground">
                demonstração
              </span>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {data && <div>atualizado às {hora(data.atualizadoEm)}</div>}
          </div>
        </div>
        {!online && (
          <div className="bg-alerta px-4 py-1 text-center text-xs font-semibold text-alerta-foreground">
            Sem internet — mostrando a última leitura salva. Os lançamentos serão enviados quando
            voltar.
          </div>
        )}
        {atualizacao && (
          <button
            className="w-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Nova versão do app disponível — toque para atualizar
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="seguro-base fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg">
          {itens.map(({ para, rotulo, icone: Icone }) => {
            const ativo = caminho === para;
            return (
              <Link
                key={para}
                to={para}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
                  ativo ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icone className="h-6 w-6" />
                {rotulo}
                {para === "/pendentes" && pendentes > 0 && (
                  <span className="absolute right-1/2 top-1 -mr-5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                    {pendentes}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to="/pontos"
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              caminho === "/pontos" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Upload className="h-6 w-6" />
            Pontos
          </Link>
          <Link
            to="/parametros"
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              caminho === "/parametros" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Settings className="h-6 w-6" />
            Parâm.
          </Link>
        </div>
      </nav>
    </div>
  );
}
