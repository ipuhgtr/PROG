// Fila local (IndexedDB) de operações pendentes.
// - opId (UUID v4) é gerado UMA vez, quando o usuário toca em enviar.
// - Reenvio automático com espera crescente SÓ para erro de rede, timeout e "ocupado".
// - "invalido", "conflito" e "sem_permissao" não reenviam sozinhos.
// - Um item só sai da fila com resposta "gravado" ou "duplicado".
import { enviarAcao, ErroRede } from "./api";
import type { Acao, PedidoFila, RespostaAPI } from "./tipos";

const DB = "prep-fila";
const LOJA = "pedidos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LOJA, { keyPath: "opId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comLoja<T>(
  modo: IDBTransactionMode,
  fn: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOJA, modo);
    const req = fn(tx.objectStore(LOJA));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function adicionarNaFila(pedido: PedidoFila): Promise<void> {
  await comLoja("readwrite", (loja) => loja.put(pedido));
  avisarMudanca();
}

export async function listarFila(): Promise<PedidoFila[]> {
  const todos = await comLoja("readonly", (loja) =>
    loja.getAll(),
  ).catch(() => [] as PedidoFila[]);
  return (todos as PedidoFila[]).sort((a, b) =>
    a.criadoEm.localeCompare(b.criadoEm),
  );
}

export async function removerDaFila(opId: string): Promise<void> {
  await comLoja("readwrite", (loja) => loja.delete(opId));
  avisarMudanca();
}

async function atualizar(pedido: PedidoFila): Promise<void> {
  await comLoja("readwrite", (loja) => loja.put(pedido));
  avisarMudanca();
}

// Notifica telas (Pendentes, selo no rodapé) sobre mudanças na fila.
const OUVINTES = new Set<() => void>();
export function aoMudarFila(fn: () => void): () => void {
  OUVINTES.add(fn);
  return () => OUVINTES.delete(fn);
}
function avisarMudanca(): void {
  OUVINTES.forEach((fn) => fn());
}

export type ResultadoEnvio =
  | { tipo: "ok"; resposta: RespostaAPI }
  | { tipo: "decisao"; resposta: RespostaAPI }
  | { tipo: "rede" };

/** Envia um pedido. Devolve "ok" (sai da fila), "decisao" (mostra mensagem) ou "rede" (tenta depois). */
export async function enviarPedido(pedido: PedidoFila): Promise<ResultadoEnvio> {
  await atualizar({ ...pedido, estado: "enviando" });
  try {
    const resp = await enviarAcao(pedido.opId, pedido.acao, pedido.dados);
    if (resp.status === "gravado" || resp.status === "duplicado") {
      await removerDaFila(pedido.opId);
      return { tipo: "ok", resposta: resp };
    }
    if (resp.status === "ocupado") {
      await atualizar({ ...pedido, estado: "pendente", tentativas: pedido.tentativas + 1 });
      return { tipo: "rede" };
    }
    // invalido, conflito, sem_permissao, layout_diferente: precisa de decisão
    await atualizar({ ...pedido, estado: "erro", ultimoErro: resp.mensagem });
    return { tipo: "decisao", resposta: resp };
  } catch (e) {
    if (e instanceof ErroRede) {
      await atualizar({
        ...pedido,
        estado: "pendente",
        tentativas: pedido.tentativas + 1,
        ultimoErro: e.message,
      });
      return { tipo: "rede" };
    }
    await atualizar({
      ...pedido,
      estado: "erro",
      ultimoErro: e instanceof Error ? e.message : "Erro inesperado.",
    });
    return { tipo: "decisao", resposta: { ok: false, status: "invalido", mensagem: "Erro inesperado." } };
  }
}

let processando = false;

/** Processa a fila inteira, com espera crescente entre falhas de rede. */
export async function processarFila(): Promise<void> {
  if (processando) return;
  processando = true;
  try {
    const pendentes = (await listarFila()).filter((p) => p.estado !== "erro");
    for (const pedido of pendentes) {
      const r = await enviarPedido(pedido);
      if (r.tipo === "rede") {
        const espera = Math.min(30000, 2000 * 2 ** Math.min(pedido.tentativas, 4));
        await new Promise((res) => setTimeout(res, espera));
        break; // sem rede: para e tenta de novo no próximo ciclo
      }
    }
  } finally {
    processando = false;
  }
}

let cicloIniciado = false;

/** Reenvio automático: ao ficar online e a cada 60 s. */
export function iniciarCicloDaFila(): void {
  if (cicloIniciado) return;
  cicloIniciado = true;
  window.addEventListener("online", () => void processarFila());
  setInterval(() => {
    if (navigator.onLine) void processarFila();
  }, 60_000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumoAcao(acao: Acao, dados: any): string {
  switch (acao) {
    case "addFat":
      return `FAT tear ${dados.tear} · ${dados.metros} m · turno ${dados.turno}`;
    case "addRolos":
      return `${dados.quantidade ?? 1} rolo(s) ${dados.artigo} · ${dados.metros} m`;
    case "baixaRolo":
      return `Baixa rolo ${dados.artigo} · ${dados.metros} m`;
    case "addPartida":
      return `Partida ${dados.artigo} · ${dados.metragem} m (${dados.maquina})`;
    case "editPartida":
      return `Editar partida linha ${dados.linha}`;
    case "iniciarPartida":
      return `Iniciou partida linha ${dados.linha}`;
    case "moverParaEngomadeira":
      return `Partida linha ${dados.linha} → engomadeira`;
    case "receberRolos":
      return `Receber rolos da partida linha ${dados.linha}`;
    case "importarPontos":
      return `Importar ${(dados.linhas as unknown[])?.length ?? 0} linhas de pontos`;
    case "setParametro":
      return `Parâmetro ${dados.campo} = ${dados.valor}`;
    default:
      return acao;
  }
}
