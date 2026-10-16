/**
 * PREP — backend do app para a planilha "PROGRAMAÇÃO PREP" (Google Apps Script, Web App).
 *
 * Sem PIN, sem login: quem tem o endereço do app usa. O app NÃO calcula nada:
 * a planilha calcula (fórmulas) e este script só LÊ os resultados e GRAVA as entradas
 * nas mesmas células onde você digitaria à mão.
 *
 *   GET  ?action=ler                 -> JSON completo (ver src/lib/tipos.ts)
 *   POST { opId, acao, dados }       -> { ok, status, mensagem, ... }
 *
 * Células usadas (layout atual da planilha):
 *   PONTOS LIDOS   A:M pontos colados (importarPontos) · O:R FATs (DIA, TEAR, METROS EMENDADO, TURNO), linhas 2–501
 *   PARAM ROLOS    B4 data base, B5 hora ref., B6 folga, B28 agora, B29:B36 parâmetros, A21:A26 artigos
 *   TEARES         linhas 4+ (A:R)
 *   ESTOQUE        resumo A6:I10 · avisos B12 · URDIDEIRA linhas 15–26 · ENGOMADEIRA 30–37 · ROLOS 41–190
 *   DISTRIBUIÇÃO   linhas 6+ (A:G) · ROLOS PREVISTOS linhas 2+ (A:E)
 * Se mudar linhas/colunas da planilha, ajuste as constantes abaixo.
 */

var VERSAO_API = "2.0.0";

var FAT_PRIMEIRA = 2, FAT_ULTIMA = 501;          // PONTOS LIDOS, colunas O:R (as fórmulas só olham até a 501)
var PONTOS_ULTIMA = 3000;                        // PONTOS LIDOS, colunas A:M
var URD = { ini: 15, fim: 26 };
var ENG = { ini: 30, fim: 37 };
var ROLOS = { ini: 41, fim: 190 };

var PARAM_CELULAS = {                            // campo do app -> célula em PARAM ROLOS
  folga: "B6",
  velUrdideira: "B29", trocaUrdideira: "B30",
  velEngomadeira: "B31", trocaEngomadeira: "B32",
  esperaUrdideiraEngomadeira: "B33", esperaEngomadeiraEstoque: "B34",
  roloMaximo: "B35", roloMinimo: "B36"
};

/* ------------------------------ entrada HTTP ------------------------------ */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action !== "ler") return json_({ erro: "Ação desconhecida." });
    return json_(ler_());
  } catch (err) {
    return json_({ erro: "Falha ao ler a planilha: " + err.message });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var travou = false;
  try {
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!corpo.opId) return json_(resp_(false, "invalido", "opId ausente."));
    travou = lock.tryLock(20000);
    if (!travou) return json_(resp_(false, "ocupado", "Planilha ocupada. Tente de novo."));

    // Idempotência: o app reenvia a fila depois de queda de rede; mesmo opId = já gravado.
    var simulacao = corpo.dados && corpo.dados.simular;
    if (!simulacao && buscarOp_(corpo.opId)) return json_(resp_(true, "duplicado", "Já estava gravado."));

    var r = executar_(corpo.acao, corpo.dados || {});
    if (r.ok && r.status === "gravado" && !simulacao) {
      registrarOp_(corpo.opId, corpo.acao, corpo.dados);
      SpreadsheetApp.flush();
    }
    return json_(r);
  } catch (err) {
    var layout = /não encontrada|não existe/.test(err.message);
    return json_(resp_(false, layout ? "layout_diferente" : "invalido", "Erro: " + err.message));
  } finally {
    if (travou) lock.releaseLock();
  }
}

/* --------------------------------- leitura -------------------------------- */

function ler_() {
  var ss = planilha_();
  var tz = ss.getSpreadsheetTimeZone();
  var pr = aba_("PARAM ROLOS");
  var P = function (c) { return pr.getRange(c).getValue(); };

  var parametros = {
    dataBase: dia_(P("B4"), tz),
    horaReferencia: hora_(P("B5"), tz),
    folga: num_(P("B6")),
    agora: iso_(P("B28"), tz),
    velUrdideira: num_(P("B29")), trocaUrdideira: num_(P("B30")),
    velEngomadeira: num_(P("B31")), trocaEngomadeira: num_(P("B32")),
    esperaUrdideiraEngomadeira: num_(P("B33")), esperaEngomadeiraEstoque: num_(P("B34")),
    roloMaximo: num_(P("B35")), roloMinimo: num_(P("B36")),
    artigos: pr.getRange("A21:A26").getValues().map(function (r) { return String(r[0]).trim(); }).filter(String)
  };

  var est = aba_("ESTOQUE");
  var estoque = {
    resumo: resumo_(est, tz),
    avisos: avisos_(est.getRange("B12").getValue()),
    urdideira: partidas_(est, URD, "urdideira", tz),
    engomadeira: partidas_(est, ENG, "engomadeira", tz),
    rolos: rolos_(est)
  };

  var previstos = rolosPrevistos_(ss, tz);
  var origem = {};
  previstos.forEach(function (r) { origem[String(r.rolo)] = r.origem; });

  var fats = fats_(ss, tz);
  var capacidade = {
    fatsUsadas: fats.usadas, fatsTotal: FAT_ULTIMA - FAT_PRIMEIRA + 1,
    rolosUsados: estoque.rolos.length, rolosTotal: ROLOS.fim - ROLOS.ini + 1,
    urdideiraUsadas: estoque.urdideira.length, urdideiraTotal: URD.fim - URD.ini + 1,
    engomadeiraUsadas: estoque.engomadeira.length, engomadeiraTotal: ENG.fim - ENG.ini + 1
  };

  return {
    versaoApi: VERSAO_API,
    atualizadoEm: iso_(new Date(), tz),
    parametros: parametros,
    teares: teares_(ss, tz),
    grade: null,
    estoque: estoque,
    distribuicao: distribuicao_(ss, origem, tz),
    capacidade: capacidade,
    avisos: estoque.avisos,
    ultimasFats: fats.ultimas,
    rolosPrevistos: previstos
  };
}

function teares_(ss, tz) {
  var aba = aba_("TEARES");
  var n = Math.max(0, aba.getLastRow() - 3);
  if (!n) return [];
  var v = aba.getRange(4, 1, n, 18).getValues();
  var out = [];
  v.forEach(function (r) {
    if (!r[1] || !r[5] || r[5] === "?" || !(typeof r[6] === "number")) return; // sem artigo/metros-dia: ignora
    out.push({
      grupo: String(r[0]), tear: String(r[1]),
      fios: txt_(r[2]), urdume: txt_(r[3]), codTecido: txt_(r[4]), artigo: String(r[5]),
      metrosDia: num_(r[6]), metrosUteis: num_(r[7]), diasAteAcabar: num_(r[8]),
      paradaSemEstoque: iso_(r[9], tz), dia: ddmm_(r[10], tz), turno: String(r[11] || ""),
      rolosRecebidos: num_(r[12]), metrosRecebidos: num_(r[13]),
      paradaDepoisEstoque: iso_(r[14], tz), diasGanhos: num_(r[15]),
      diaDepois: ddmm_(r[16], tz), turnoDepois: String(r[17] || "")
    });
  });
  return out;
}

function resumo_(est, tz) {
  return est.getRange("A6:I10").getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return {
      artigo: String(r[0]),
      estoqueRolos: num_(r[1]), estoqueMetros: num_(r[2]),
      engomandoRolos: num_(r[3]), engomandoMetros: num_(r[4]),
      urdideiraRolos: num_(r[5]), urdideiraMetros: num_(r[6]),
      teares: num_(r[7]), proximoRoloProntoEm: iso_(r[8], tz)
    };
  });
}

function partidas_(est, bloco, maquina, tz) {
  var n = bloco.fim - bloco.ini + 1;
  var v = est.getRange(bloco.ini, 1, n, 12).getValues();
  var out = [];
  v.forEach(function (r, i) {
    if (r[2] === "" || r[2] === null) return;      // linha vazia (sem metragem)
    var urd = maquina === "urdideira";
    out.push({
      linha: bloco.ini + i,
      artigo: String(r[1] || ""), metragem: num_(r[2]),
      comecouEm: iso_(r[3], tz), prontoEmManual: iso_(r[11], tz),
      inicioUrdir: urd ? iso_(r[4], tz) : null, fimUrdir: urd ? iso_(r[5], tz) : null,
      inicioEngomar: iso_(r[6], tz), fimEngomar: iso_(r[7], tz),
      qtdRolos: num_(r[8]), prontoNoEstoqueEm: iso_(r[9], tz), aviso: String(r[10] || "")
    });
  });
  return out;
}

function rolos_(est) {
  var v = est.getRange(ROLOS.ini, 1, ROLOS.fim - ROLOS.ini + 1, 3).getValues();
  var out = [];
  v.forEach(function (r, i) {
    if (r[1] && typeof r[2] === "number" && r[2] > 0) out.push({ linha: ROLOS.ini + i, artigo: String(r[1]), metros: r[2] });
  });
  return out;
}

function rolosPrevistos_(ss, tz) {
  var aba = aba_("ROLOS PREVISTOS");
  var n = Math.max(0, aba.getLastRow() - 1);
  if (!n) return [];
  var out = [];
  aba.getRange(2, 1, n, 5).getValues().forEach(function (r) {
    if (r[2] && typeof r[3] === "number") {
      out.push({ rolo: r[0], origem: String(r[1] || "").toLowerCase(), artigo: String(r[2]), metros: r[3], prontoEm: iso_(r[4], tz), partidaLinha: null });
    }
  });
  return out;
}

function distribuicao_(ss, origem, tz) {
  var aba = aba_("DISTRIBUIÇÃO");
  var n = Math.max(0, aba.getLastRow() - 5);
  if (!n) return [];
  var out = [];
  aba.getRange(6, 1, n, 7).getValues().forEach(function (r) {
    if (r[5] && typeof r[3] === "number") {
      out.push({ rolo: Number(r[1]), artigo: String(r[2]), metros: r[3], disponivelEm: iso_(r[4], tz), tear: String(r[5]), origem: origem[String(r[1])] });
    }
  });
  return out;
}

/** FATs: colunas O:R de PONTOS LIDOS (linhas 2–501). "Última FAT" de cada tear = a de dia mais recente. */
function fats_(ss, tz) {
  var aba = aba_("PONTOS LIDOS");
  var v = aba.getRange(FAT_PRIMEIRA, 15, FAT_ULTIMA - FAT_PRIMEIRA + 1, 4).getValues();
  var ultimas = {}, usadas = 0;
  v.forEach(function (r) {
    if (r[0] === "" && r[1] === "") return;
    usadas++;
    var tear = String(Number(r[1]));
    var d = r[0] instanceof Date ? r[0].getTime() : 0;
    if (!ultimas[tear] || d >= ultimas[tear]._t) {
      ultimas[tear] = { dia: dia_(r[0], tz), tear: Number(r[1]), metros: num_(r[2]), turno: String(r[3]), _t: d };
    }
  });
  Object.keys(ultimas).forEach(function (k) { delete ultimas[k]._t; });
  return { ultimas: ultimas, usadas: usadas };
}

/* --------------------------------- escrita -------------------------------- */

function executar_(acao, d) {
  var ss = planilha_();
  var tz = ss.getSpreadsheetTimeZone();
  var ok = function (m, extra) { var r = resp_(true, "gravado", m); for (var k in (extra || {})) r[k] = extra[k]; return r; };
  var invalido = function (m) { return resp_(false, "invalido", m); };

  switch (acao) {
    case "addFat": {
      var tear = Number(d.tear), metros = Number(d.metros), turno = String(d.turno || "").toUpperCase();
      var turnoLetra = { "1": "A", "2": "B", "3": "C" }[turno] || turno;
      if (!(tear >= 1) || !(metros > 0) || !d.dia || ["A", "B", "C"].indexOf(turnoLetra) < 0) return invalido("Dados da FAT incompletos.");
      var diaData = Utilities.parseDate(String(d.dia).slice(0, 10), tz, "yyyy-MM-dd");
      var aba = aba_("PONTOS LIDOS");
      var bloco = aba.getRange(FAT_PRIMEIRA, 15, FAT_ULTIMA - FAT_PRIMEIRA + 1, 4);
      var v = bloco.getValues();
      var vazia = -1;
      for (var i = 0; i < v.length; i++) {
        var linha = v[i];
        if (linha[0] === "" && linha[1] === "" && linha[2] === "" && linha[3] === "") { if (vazia < 0) vazia = i; continue; }
        var mesmoDia = linha[0] instanceof Date && dia_(linha[0], tz) === dia_(diaData, tz);
        if (mesmoDia && Number(linha[1]) === tear && String(linha[3]).toUpperCase() === turnoLetra) {
          if (Number(linha[2]) === metros) return resp_(true, "duplicado", "FAT já lançada.");
          if (!d.substituir) return resp_(false, "conflito", "Já existe FAT do tear " + tear + " neste dia e turno com " + Number(linha[2]) + " m.");
          aba.getRange(FAT_PRIMEIRA + i, 17).setValue(metros);
          return ok("FAT substituída.");
        }
      }
      if (vazia < 0) return invalido("Lista de FATs cheia.");
      aba.getRange(FAT_PRIMEIRA + vazia, 15, 1, 4).setValues([[diaData, tear, metros, turnoLetra]]);
      return ok("FAT gravada.");
    }

    case "addRolos": {
      var qtd = Math.max(1, Number(d.quantidade || 1)), m = Number(d.metros);
      if (!d.artigo || !(m > 0)) return invalido("Artigo e metros são obrigatórios.");
      var est = aba_("ESTOQUE");
      var livres = linhasLivresRolos_(est);
      if (livres.length < qtd) return invalido("Lista cheia: só cabem " + livres.length + " rolos.");
      for (var q = 0; q < qtd; q++) est.getRange(livres[q], 2, 1, 2).setValues([[String(d.artigo), m]]);
      return ok(qtd + " rolo(s) adicionados.");
    }

    case "baixaRolo": {
      var e2 = aba_("ESTOQUE");
      var vals = e2.getRange(ROLOS.ini, 2, ROLOS.fim - ROLOS.ini + 1, 2).getValues();
      for (var j = 0; j < vals.length; j++) {
        if (vals[j][0] === d.artigo && Number(vals[j][1]) === Number(d.metros)) {
          e2.getRange(ROLOS.ini + j, 2, 1, 2).clearContent();
          return ok("Baixa registrada.");
        }
      }
      return invalido("Rolo não encontrado.");
    }

    case "addPartida": {
      var b = bloco_(d.maquina), e3 = aba_("ESTOQUE");
      if (!d.artigo || !(Number(d.metragem) > 0)) return invalido("Artigo e metragem são obrigatórios.");
      var lv = linhaLivrePartida_(e3, b);
      if (!lv) return invalido("Fila cheia.");
      e3.getRange(lv, 2, 1, 2).setValues([[String(d.artigo), Number(d.metragem)]]);
      return ok("Partida adicionada.");
    }

    case "iniciarPartida": {
      var b2 = bloco_(d.maquina), e4 = aba_("ESTOQUE");
      if (!linhaValida_(b2, d.linha) || e4.getRange(Number(d.linha), 3).getValue() === "") return invalido("Partida não encontrada.");
      e4.getRange(Number(d.linha), 4).setValue(new Date());
      return ok("Partida iniciada.");
    }

    case "editPartida": {
      var b3 = bloco_(d.maquina), e5 = aba_("ESTOQUE"), ln = Number(d.linha);
      if (!linhaValida_(b3, ln) || e5.getRange(ln, 3).getValue() === "") return invalido("Partida não encontrada.");
      var col = { artigo: 2, metragem: 3, prontoEm: 12 }[d.campo];
      if (!col) return invalido("Campo não editável.");
      var cel = e5.getRange(ln, col);
      if (d.campo !== "prontoEm" && d.valorAnterior != null && String(cel.getValue()) !== String(d.valorAnterior)) {
        return resp_(false, "conflito", "O valor foi alterado por outra pessoa. Atualize e tente de novo.");
      }
      if (d.campo === "prontoEm") { if (d.valor) cel.setValue(new Date(d.valor)); else cel.clearContent(); }
      else cel.setValue(d.campo === "metragem" ? Number(d.valor) : String(d.valor));
      return ok("Partida alterada.");
    }

    case "moverParaEngomadeira": {
      var e6 = aba_("ESTOQUE"), l6 = Number(d.linha);
      if (!linhaValida_(URD, l6)) return invalido("Partida não encontrada.");
      var p = e6.getRange(l6, 2, 1, 2).getValues()[0];
      if (!p[1]) return invalido("Partida não encontrada.");
      var dest = linhaLivrePartida_(e6, ENG);
      if (!dest) return invalido("Engomadeira cheia.");
      e6.getRange(dest, 2, 1, 2).setValues([[p[0], p[1]]]);
      removerPartida_(e6, URD, l6);
      return ok("Passou para a engomadeira.");
    }

    case "receberRolos": {
      var e7 = aba_("ESTOQUE"), l7 = Number(d.linha);
      if (!linhaValida_(ENG, l7)) return invalido("Partida não encontrada.");
      var pe = e7.getRange(l7, 2, 1, 2).getValues()[0];
      if (!pe[1]) return invalido("Partida não encontrada.");
      var metrosRolos = (Array.isArray(d.rolos) ? d.rolos : []).map(Number).filter(function (x) { return x > 0; });
      if (!metrosRolos.length) return invalido("Informe os metros dos rolos.");
      var lvs = linhasLivresRolos_(e7);
      if (lvs.length < metrosRolos.length) return invalido("Lista de rolos cheia: só cabem " + lvs.length + ".");
      metrosRolos.forEach(function (mt, k) { e7.getRange(lvs[k], 2, 1, 2).setValues([[String(pe[0]), mt]]); });
      removerPartida_(e7, ENG, l7);
      return ok("Rolos recebidos no estoque.");
    }

    case "importarPontos": {
      var aP = aba_("PONTOS LIDOS");
      var linhasP = d.linhas || [];
      var chave = function (dia, turno, maq, cod) { return [dia, turno, maq, cod].join("|"); };
      var atuais = aP.getRange(2, 1, PONTOS_ULTIMA - 1, 4).getValues();     // A:D
      var vistos = {}, ultima = 1;
      atuais.forEach(function (r, i) {
        if (r[0] !== "") {
          ultima = i + 2;
          vistos[chave(dia_(r[0], tz), Number(r[2]), String(r[3]).trim(), String(r[1]).trim())] = true;
        }
      });
      var novas = linhasP.filter(function (l) { return !vistos[chave(l[0], Number(l[2]), String(l[3]).trim(), String(l[1]).trim())]; });
      var r2 = { novas: novas.length, existentes: linhasP.length - novas.length };
      if (d.simular) return ok("Prévia.", r2);
      if (ultima + novas.length > PONTOS_ULTIMA) return invalido("A aba PONTOS LIDOS não comporta mais linhas.");
      if (novas.length) {
        var dados = novas.map(function (l) {
          var x = l.slice(0, 13);
          x[0] = Utilities.parseDate(String(l[0]).slice(0, 10), tz, "yyyy-MM-dd");
          return x;
        });
        aP.getRange(ultima + 1, 1, dados.length, 13).setValues(dados);
      }
      return ok(r2.novas + " linhas gravadas, " + r2.existentes + " já existiam.", r2);
    }

    case "setParametro": {
      var cell = PARAM_CELULAS[d.campo];
      if (!cell || isNaN(Number(d.valor))) return invalido("Parâmetro inválido.");
      aba_("PARAM ROLOS").getRange(cell).setValue(Number(d.valor));
      return ok("Parâmetro gravado.");
    }
  }
  return invalido("Ação desconhecida.");
}

function bloco_(maquina) { return maquina === "engomadeira" ? ENG : URD; }
function linhaValida_(b, n) { n = Number(n); return n >= b.ini && n <= b.fim; }

function linhaLivrePartida_(est, b) {
  var v = est.getRange(b.ini, 2, b.fim - b.ini + 1, 2).getValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === "" && v[i][1] === "") return b.ini + i;
  return 0;
}

function linhasLivresRolos_(est) {
  var v = est.getRange(ROLOS.ini, 2, ROLOS.fim - ROLOS.ini + 1, 2).getValues();
  var out = [];
  v.forEach(function (r, i) { if (r[0] === "" && r[1] === "") out.push(ROLOS.ini + i); });
  return out;
}

/** Remove uma partida e sobe as de baixo (a ordem das linhas é a ordem de produção). Colunas B, C, D e L. */
function removerPartida_(est, b, linha) {
  [2, 3, 4, 12].forEach(function (col) {
    var n = b.fim - linha;                       // linhas abaixo da removida
    if (n > 0) {
      var abaixo = est.getRange(linha + 1, col, n, 1).getValues();
      est.getRange(linha, col, n, 1).setValues(abaixo);
    }
    est.getRange(b.fim, col).clearContent();
  });
}

/* ------------------------------- utilitários ------------------------------ */

function planilha_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(nome) {
  var a = planilha_().getSheetByName(nome);
  if (!a) throw new Error('Aba "' + nome + '" não encontrada');
  return a;
}
function num_(v) { return typeof v === "number" ? v : (v === "" || v === null || isNaN(Number(v)) ? 0 : Number(v)); }
function txt_(v) { return v === "" || v === null || v === undefined ? "" : String(v); }
function iso_(v, tz) {
  return v instanceof Date && !isNaN(v) ? Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") : null;
}
function dia_(v, tz) { return v instanceof Date && !isNaN(v) ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : null; }
function ddmm_(v, tz) { return v instanceof Date && !isNaN(v) ? Utilities.formatDate(v, tz, "dd/MM") : ""; }
function hora_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "HH:mm");
  if (typeof v === "number") { var m = Math.round(v * 1440); return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
  return "";
}
function avisos_(v) {
  var s = String(v || "").trim();
  return !s || /^nenhum/i.test(s) ? [] : s.split(/\s*[;\n]\s*/).filter(String);
}

function buscarOp_(opId) {
  var aba = logAba_(), ult = aba.getLastRow();
  if (ult < 2) return false;
  var ini = Math.max(2, ult - 1999);
  var vals = aba.getRange(ini, 1, ult - ini + 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (vals[i][0] === opId) return true;
  return false;
}
function registrarOp_(opId, acao, dados) {
  logAba_().appendRow([opId, new Date(), acao, JSON.stringify(dados).slice(0, 2000)]);
}
function logAba_() {
  var ss = planilha_(), a = ss.getSheetByName("LOG_API");
  if (!a) { a = ss.insertSheet("LOG_API"); a.appendRow(["opId", "em", "acao", "dados"]); a.hideSheet(); }
  return a;
}

function resp_(ok, status, mensagem) { return { ok: ok, status: status, mensagem: mensagem }; }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
