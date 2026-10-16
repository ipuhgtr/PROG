// Leitura da planilha com cache rotulado.
// O app guarda só UM cache de leitura, sempre com a hora. Depois de uma
// gravação confirmada, ele sempre relê — nunca mostra valor local como
// se fosse da planilha.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { lerDados } from "@/lib/api";
import type { LeituraAPI } from "@/lib/tipos";

const CHAVE_CACHE = "prep.ultimaLeitura";

export function cacheSalvo(): LeituraAPI | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    return bruto ? (JSON.parse(bruto) as LeituraAPI) : null;
  } catch {
    return null;
  }
}

function salvarCache(dados: LeituraAPI): void {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(dados));
  } catch {
    /* ignora */
  }
}

export function useDados() {
  return useQuery({
    queryKey: ["dados"],
    staleTime: 15_000,
    retry: 1,
    queryFn: async () => {
      const dados = await lerDados();
      salvarCache(dados);
      return dados;
    },
    placeholderData: () => cacheSalvo() ?? undefined,
  });
}

/** Depois de gravar: espera ~3 s (a planilha recalcula) e relê.
 *  Se atualizadoEm vier mais antigo que a gravação, tenta de novo até 3 vezes. */
export function useReleituraPosGravacao() {
  const qc = useQueryClient();
  return useCallback(async () => {
    const marco = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 3000));
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const dados = await qc.fetchQuery({
        queryKey: ["dados"],
        queryFn: async () => {
          const d = await lerDados();
          salvarCache(d);
          return d;
        },
        staleTime: 0,
      });
      if (dados.atualizadoEm >= marco || tentativa === 2) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, [qc]);
}
