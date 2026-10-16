// Modo demonstração: quando VITE_API_URL está vazio, o app roda com dados
// locais (fixtures + alterações salvas no aparelho), sem falar com a planilha.
import fixtures from "../demo/fixtures.json";
import type { Acao, LeituraAPI, RespostaAPI } from "./tipos";

const CHAVE = "prep.demo.dados";


function carregar(): LeituraAPI {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as LeituraAPI;
  } catch {
    /* ignora */
  }
  return structuredClone(fixtures) as unknown as LeituraAPI;
}

function salvar(dados: LeituraAPI): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* ignora */
  }
}

function agora(): string {
  // ISO com offset -03:00 (America/Bahia)
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().replace("Z", "-03:00");
}

export function demoLer(): LeituraAPI {
  const dados = carregar();
  dados.atualizadoEm = agora();
  return dados;
}

export function demoAcao(
  acao: Acao,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any,
): RespostaAPI {
  const estado = carregar();
  const resp = (r: RespostaAPI): RespostaAPI => {
    if (r.ok) salvar(estado);
    return r;
  };

  switch (acao) {
    case "addFat": {
      const fats = (estado.ultimasFats ??= {});
      const chave = String(Number(dados.tear));
      const anterior = fats[chave];
      if (anterior && anterior.dia === dados.dia && anterior.turno === dados.turno) {
        if (anterior.metros === Number(dados.metros)) {
          return resp({ ok: true, status: "duplicado", mensagem: "FAT já lançada." });
        }
        if (!dados.substituir) {
          return { ok: false, status: "conflito", mensagem: `Já existe FAT do tear ${chave} neste dia e turno com ${anterior.metros} m.` };
        }
      } else {
        estado.capacidade.fatsUsadas += 1;
      }
      fats[chave] = { dia: dados.dia, tear: Number(dados.tear), metros: Number(dados.metros), turno: dados.turno };
      return resp({ ok: true, status: "gravado", mensagem: "FAT gravada (demonstração)." });
    }
    case "addRolos": {
      const artigo = String(dados.artigo ?? "");
      const metros = Number(dados.metros ?? 0);
      const qtd = Math.max(1, Number(dados.quantidade ?? 1));
      const ultima = estado.estoque.rolos.reduce((m, r) => Math.max(m, r.linha), 40);
      for (let i = 0; i < qtd; i++) {
        estado.estoque.rolos.push({ linha: ultima + 1 + i, artigo, metros });
      }
      estado.capacidade.rolosUsados += qtd;
      return resp({ ok: true, status: "gravado", mensagem: `${qtd} rolo(s) adicionados (demonstração).` });
    }
    case "baixaRolo": {
      const idx = estado.estoque.rolos.findIndex(
        (r) => r.artigo === dados.artigo && r.metros === Number(dados.metros),
      );
      if (idx < 0) {
        return resp({ ok: false, status: "invalido", mensagem: "Rolo não encontrado." });
      }
      estado.estoque.rolos.splice(idx, 1);
      estado.capacidade.rolosUsados -= 1;
      return resp({ ok: true, status: "gravado", mensagem: "Baixa registrada (demonstração)." });
    }
    case "addPartida": {
      const maquina = dados.maquina === "engomadeira" ? "engomadeira" : "urdideira";
      const lista = estado.estoque[maquina];
      const ultima = lista.reduce((m, p) => Math.max(m, p.linha), maquina === "urdideira" ? 14 : 29);
      lista.push({
        linha: ultima + 1,
        artigo: String(dados.artigo ?? ""),
        metragem: Number(dados.metragem ?? 0),
        comecouEm: null,
        prontoEmManual: null,
        inicioUrdir: null,
        fimUrdir: null,
        inicioEngomar: null,
        fimEngomar: null,
        qtdRolos: 0,
        prontoNoEstoqueEm: null,
        aviso: "",
      });
      return resp({ ok: true, status: "gravado", mensagem: "Partida adicionada (demonstração)." });
    }
    case "iniciarPartida": {
      const p = estado.estoque[dados.maquina === "engomadeira" ? "engomadeira" : "urdideira"].find((x) => x.linha === Number(dados.linha));
      if (p) p.comecouEm = agora();
      return resp({ ok: true, status: "gravado", mensagem: "Partida iniciada (demonstração)." });
    }
    case "moverParaEngomadeira": {
      const idx = estado.estoque.urdideira.findIndex((x) => x.linha === Number(dados.linha));
      if (idx < 0) return resp({ ok: false, status: "invalido", mensagem: "Partida não encontrada." });
      const [p] = estado.estoque.urdideira.splice(idx, 1);
      if (!p) return resp({ ok: false, status: "invalido", mensagem: "Partida não encontrada." });
      const ultima = estado.estoque.engomadeira.reduce((m, x) => Math.max(m, x.linha), 29);
      estado.estoque.engomadeira.push({ ...p, linha: ultima + 1 });
      return resp({ ok: true, status: "gravado", mensagem: "Passou para a engomadeira (demonstração)." });
    }
    case "receberRolos": {
      const idx = estado.estoque.engomadeira.findIndex((x) => x.linha === Number(dados.linha));
      if (idx < 0) return resp({ ok: false, status: "invalido", mensagem: "Partida não encontrada." });
      const [p] = estado.estoque.engomadeira.splice(idx, 1);
      if (!p) return resp({ ok: false, status: "invalido", mensagem: "Partida não encontrada." });
      const rolos = Array.isArray(dados.rolos) ? (dados.rolos as number[]) : [p.metragem];
      const ultima = estado.estoque.rolos.reduce((m, r) => Math.max(m, r.linha), 40);
      rolos.forEach((metros, i) => {
        estado.estoque.rolos.push({ linha: ultima + 1 + i, artigo: p.artigo, metros: Number(metros) });
      });
      return resp({ ok: true, status: "gravado", mensagem: "Rolos recebidos no estoque (demonstração)." });
    }
    case "importarPontos": {
      const CH = "prep.demo.pontos";
      const vistos = new Set<string>(JSON.parse(localStorage.getItem(CH) ?? "[]"));
      const linhas = (dados.linhas ?? []) as unknown[][];
      const novas = linhas.filter((l) => !vistos.has([l[0], l[2], l[3], l[1]].join("|")));
      const r = { novas: novas.length, existentes: linhas.length - novas.length };
      if (dados.simular) return { ok: true, status: "gravado", mensagem: "Prévia.", ...r };
      novas.forEach((l) => vistos.add([l[0], l[2], l[3], l[1]].join("|")));
      localStorage.setItem(CH, JSON.stringify([...vistos]));
      return resp({ ok: true, status: "gravado", mensagem: `${r.novas} linhas gravadas, ${r.existentes} já existiam (demonstração).`, ...r });
    }
    case "setParametro": {
      const p = estado.parametros as unknown as Record<string, unknown>;
      if (dados.campo in p) p[dados.campo] = Number(dados.valor);
      return resp({ ok: true, status: "gravado", mensagem: "Parâmetro gravado (demonstração)." });
    }
    case "editPartida": {
      const lista = estado.estoque[dados.maquina === "engomadeira" ? "engomadeira" : "urdideira"];
      const p = lista.find((x) => x.linha === Number(dados.linha));
      if (!p) return resp({ ok: false, status: "invalido", mensagem: "Partida não encontrada." });
      if (dados.campo === "metragem") p.metragem = Number(dados.valor);
      if (dados.campo === "artigo") p.artigo = String(dados.valor);
      if (dados.campo === "prontoEm") p.prontoEmManual = dados.valor || null;
      return resp({ ok: true, status: "gravado", mensagem: "Partida alterada (demonstração)." });
    }
      return resp({ ok: true, status: "gravado", mensagem: "Gravado (demonstração)." });
    default:
      return resp({ ok: false, status: "invalido", mensagem: "Ação desconhecida." });
  }
}
