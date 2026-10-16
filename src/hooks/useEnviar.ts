// Envio de gravações: gera o opId UMA vez, guarda na fila (IndexedDB),
// envia, e depois de confirmado relê a planilha.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { novoOpId } from "@/lib/api";
import { adicionarNaFila, enviarPedido, removerDaFila, resumoAcao, type ResultadoEnvio } from "@/lib/fila";
import type { Acao, PedidoFila } from "@/lib/tipos";
import { useReleituraPosGravacao } from "./useDados";

export function useEnviar() {
  const reler = useReleituraPosGravacao();
  const emAndamento = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [calculando, setCalculando] = useState(false);

  const enviar = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (acao: Acao, dados: any, opcoes?: { manterConflito?: boolean }): Promise<ResultadoEnvio | null> => {
      if (emAndamento.current) return null; // toque duplo nunca gera dois pedidos
      emAndamento.current = true;
      setEnviando(true);
      try {
        const pedido: PedidoFila = {
          opId: novoOpId(),
          acao,
          dados,
          resumo: resumoAcao(acao, dados),
          criadoEm: new Date().toISOString(),
          tentativas: 0,
          estado: "pendente",
        };
        await adicionarNaFila(pedido);
        const r = await enviarPedido(pedido);
        if (r.tipo === "ok") {
          toast.success(
            r.resposta.status === "duplicado" ? "Já estava gravado na planilha." : r.resposta.mensagem || "Gravado.",
          );
          setCalculando(true);
          void reler()
            .catch(() => undefined)
            .finally(() => setCalculando(false));
        } else if (r.tipo === "rede") {
          toast.warning("Sem conexão. O lançamento ficou em Pendentes e será enviado sozinho.");
        } else {
          const conflito = r.resposta.status === "conflito";
          if (!(conflito && opcoes?.manterConflito)) {
            toast.error(r.resposta.mensagem || "A planilha recusou o lançamento.");
            await removerDaFila(pedido.opId);
          } else {
            await removerDaFila(pedido.opId);
          }
        }
        return r;
      } finally {
        emAndamento.current = false;
        setEnviando(false);
      }
    },
    [reler],
  );

  return { enviar, enviando, calculando };
}
