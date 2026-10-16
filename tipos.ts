// Tipos do contrato entre o app e a planilha (via Apps Script).
// O app nunca recalcula nada: só grava entradas e lê resultados.

export interface Parametros {
  dataBase: string;
  horaReferencia: string;
  folga: number;
  agora: string;
  velUrdideira: number;
  trocaUrdideira: number;
  velEngomadeira: number;
  trocaEngomadeira: number;
  esperaUrdideiraEngomadeira: number;
  esperaEngomadeiraEstoque: number;
  roloMaximo: number;
  roloMinimo: number;
  artigos: string[];
}

export interface Tear {
  grupo: string;
  tear: string;
  fios: string;
  urdume: string;
  codTecido: string;
  artigo: string;
  metrosDia: number;
  metrosUteis: number;
  diasAteAcabar: number;
  paradaSemEstoque: string | null;
  dia: string;
  turno: string;
  rolosRecebidos: number;
  metrosRecebidos: number;
  paradaDepoisEstoque: string | null;
  diasGanhos: number;
  diaDepois: string;
  turnoDepois: string;
}

export interface Partida {
  linha: number;
  artigo: string;
  metragem: number;
  comecouEm: string | null;
  prontoEmManual: string | null;
  inicioUrdir: string | null;
  fimUrdir: string | null;
  inicioEngomar: string | null;
  fimEngomar: string | null;
  qtdRolos: number;
  prontoNoEstoqueEm: string | null;
  aviso: string;
}

export interface Rolo {
  linha: number;
  artigo: string;
  metros: number;
}

export interface ResumoArtigo {
  artigo: string;
  estoqueRolos: number;
  estoqueMetros: number;
  engomandoRolos: number;
  engomandoMetros: number;
  urdideiraRolos: number;
  urdideiraMetros: number;
  teares: number;
  proximoRoloProntoEm: string | null;
}

export interface Distribuicao {
  rolo: number;
  artigo: string;
  metros: number;
  disponivelEm: string | null;
  tear: string;
  origem?: string;
}

export interface Capacidade {
  fatsUsadas: number;
  fatsTotal: number;
  rolosUsados: number;
  rolosTotal: number;
  urdideiraUsadas: number;
  urdideiraTotal: number;
  engomadeiraUsadas: number;
  engomadeiraTotal: number;
}

export interface LeituraAPI {
  versaoApi: string;
  atualizadoEm: string;
  parametros: Parametros;
  teares: Tear[];
  grade: unknown;
  estoque: {
    resumo: ResumoArtigo[];
    avisos: string[];
    urdideira: Partida[];
    engomadeira: Partida[];
    rolos: Rolo[];
  };
  distribuicao: Distribuicao[];
  capacidade: Capacidade;
  avisos: string[];
  /** Última FAT lançada por tear (número do tear → FAT). */
  ultimasFats?: Record<string, { dia: string; tear: number; metros: number; turno: string }>;
  /** Divisão prevista de rolos (aba ROLOS PREVISTOS), calculada pela planilha. */
  rolosPrevistos?: { rolo: number | string; artigo: string; metros: number; origem: string; prontoEm: string | null; partidaLinha?: number | null }[];
}

export type StatusResposta =
  | "gravado"
  | "duplicado"
  | "conflito"
  | "invalido"
  | "sem_permissao"
  | "layout_diferente"
  | "ocupado";

export interface RespostaAPI {
  ok: boolean;
  status: StatusResposta;
  mensagem: string;
  [chave: string]: unknown;
}

export type Acao =
  | "addFat"
  | "addRolos"
  | "baixaRolo"
  | "addPartida"
  | "editPartida"
  | "iniciarPartida"
  | "moverParaEngomadeira"
  | "receberRolos"
  | "importarPontos"
  | "setParametro";

export interface PedidoFila {
  opId: string;
  acao: Acao;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any;
  resumo: string;
  criadoEm: string;
  tentativas: number;
  estado: "pendente" | "enviando" | "erro";
  ultimoErro?: string;
}
