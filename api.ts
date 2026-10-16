// Cliente da API. O navegador NUNCA fala direto com o Google:
// só chama a URL do Web App (Apps Script) configurada em VITE_API_URL.
// Sem VITE_API_URL, roda o modo demonstração local.
import { apiUrl, modoDemo } from "./config";
import { demoAcao, demoLer } from "./demo";
import type { Acao, LeituraAPI, RespostaAPI } from "./tipos";

const TIMEOUT_MS = 30_000;

export { modoDemo };

export class ErroRede extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRede";
  }
}

async function buscarComTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } catch (e) {
    throw new ErroRede(
      e instanceof DOMException && e.name === "AbortError"
        ? "Tempo esgotado. Verifique a internet."
        : "Sem conexão. Verifique a internet.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET ?action=ler — devolve a leitura completa da planilha. */
export async function lerDados(): Promise<LeituraAPI> {
  if (modoDemo()) {
    await new Promise((r) => setTimeout(r, 300));
    return demoLer();
  }
  const url = `${apiUrl()}?action=ler`;
  const resp = await buscarComTimeout(url, { method: "GET" });
  const corpo = await resp.text();
  let json: LeituraAPI & { erro?: string };
  try {
    json = JSON.parse(corpo);
  } catch {
    throw new Error(`Resposta inválida da planilha (HTTP ${resp.status}).`);
  }
  if (!resp.ok || json.erro) {
    throw new Error(json.erro ?? `Erro ${resp.status} ao ler a planilha.`);
  }
  return json;
}

/** POST { opId, acao, dados } — Content-Type text/plain evita preflight CORS. */
export async function enviarAcao(
  opId: string,
  acao: Acao,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any,
): Promise<RespostaAPI> {
  if (modoDemo()) {
    await new Promise((r) => setTimeout(r, 300));
    return demoAcao(acao, dados);
  }
  const resp = await buscarComTimeout(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ opId, acao, dados }),
  });
  const corpo = await resp.text();
  try {
    return JSON.parse(corpo) as RespostaAPI;
  } catch {
    throw new Error(`Resposta inválida da planilha (HTTP ${resp.status}).`);
  }
}

export function novoOpId(): string {
  return crypto.randomUUID();
}
