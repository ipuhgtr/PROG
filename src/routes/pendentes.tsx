import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Titulo } from "@/components/Estados";
import { useReleituraPosGravacao } from "@/hooks/useDados";
import { aoMudarFila, enviarPedido, listarFila, removerDaFila } from "@/lib/fila";
import { dataHora } from "@/lib/format";
import type { PedidoFila } from "@/lib/tipos";

export const Route = createFileRoute("/pendentes")({
  head: () => ({
    meta: [
      { title: "Pendentes — PREP" },
      { name: "description", content: "Lançamentos que ainda não foram confirmados pela planilha." },
      { property: "og:title", content: "Pendentes — PREP" },
      { property: "og:description", content: "Lançamentos ainda não confirmados pela planilha." },
    ],
  }),
  component: Pendentes,
});

const ESTADO: Record<PedidoFila["estado"], string> = {
  pendente: "Aguardando envio",
  enviando: "Enviando...",
  erro: "Precisa de atenção",
};

function Pendentes() {
  const [itens, setItens] = useState<PedidoFila[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const reler = useReleituraPosGravacao();
  const carregar = useCallback(() => void listarFila().then(setItens), []);

  useEffect(() => {
    carregar();
    return aoMudarFila(carregar);
  }, [carregar]);

  async function tentar(p: PedidoFila) {
    if (ocupado) return;
    setOcupado(p.opId);
    try {
      const r = await enviarPedido(p);
      if (r.tipo === "ok") {
        toast.success("Gravado na planilha.");
        void reler().catch(() => undefined);
      } else if (r.tipo === "rede") toast.warning("Ainda sem conexão. Vai tentar de novo sozinho.");
      else toast.error(r.resposta.mensagem);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div>
      <Titulo>Pendentes</Titulo>
      {itens.length === 0 && <p className="py-10 text-center text-muted-foreground">Tudo confirmado pela planilha. ✓</p>}
      <div className="space-y-3">
        {itens.map((p) => (
          <div key={p.opId} className="cartao space-y-2">
            <div className="font-semibold">{p.resumo}</div>
            <div className="text-sm text-muted-foreground">
              {ESTADO[p.estado]} · criado {dataHora(p.criadoEm)} · {p.tentativas} tentativa(s)
            </div>
            {p.ultimoErro && <div className="text-sm text-destructive">{p.ultimoErro}</div>}
            <div className="grid grid-cols-2 gap-2">
              <button className="botao-primario min-h-12 text-sm" disabled={!!ocupado} onClick={() => void tentar(p)}>
                {ocupado === p.opId ? "Enviando..." : "Tentar de novo"}
              </button>
              <button className="botao-secundario min-h-12 text-sm" disabled={!!ocupado}
                onClick={() => { if (confirm("Descartar este lançamento? Ele não será gravado.")) void removerDaFila(p.opId); }}>
                Descartar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
