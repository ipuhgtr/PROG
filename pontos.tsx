import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Calculando, Titulo } from "@/components/Estados";
import { useEnviar } from "@/hooks/useEnviar";
import { enviarAcao } from "@/lib/api";

export const Route = createFileRoute("/pontos")({
  head: () => ({
    meta: [
      { title: "Importar pontos lidos — PREP" },
      { name: "description", content: "Subir arquivo ou colar os pontos lidos do sistema da tecelagem." },
      { property: "og:title", content: "Importar pontos lidos — PREP" },
      { property: "og:description", content: "Subir ou colar os pontos lidos da tecelagem." },
    ],
  }),
  component: Pontos,
});

type Celula = string | number;

/** "392,00" → 392 ; "1.234,5" → 1234.5 */
function numBR(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** dd/MM/yyyy, yyyy-MM-dd ou serial do Excel → yyyy-MM-dd */
function diaISO(v: unknown): string | null {
  if (typeof v === "number" && v > 30000) {
    const d = new Date(Math.round((v - 25569) * 86400_000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = m[3]!.length === 2 ? "20" + m[3] : m[3];
    return `${ano}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const NUMERICAS = [2, 5, 6, 7, 8, 9, 10, 12]; // C, F..K, M

/** Normaliza uma linha A:M. Devolve null se inválida. */
function normalizar(bruta: unknown[]): Celula[] | null {
  if (bruta.length < 13) return null;
  const dia = diaISO(bruta[0]);
  const codind = String(bruta[1] ?? "").trim();
  const tear = String(bruta[3] ?? "").trim();
  if (!dia || !codind || !tear) return null;
  const linha: Celula[] = [];
  for (let i = 0; i < 13; i++) {
    if (i === 0) linha.push(dia);
    else if (NUMERICAS.includes(i)) {
      const n = numBR(bruta[i]);
      if (n === null) return null;
      linha.push(n);
    } else linha.push(String(bruta[i] ?? "").trim());
  }
  if (![1, 2, 3].includes(Number(linha[2]))) return null;
  return linha;
}

function textoParaLinhas(texto: string): unknown[][] {
  const sep = texto.includes("\t") ? "\t" : ";";
  return texto.split(/\r?\n/).map((l) => l.split(sep)).filter((l) => l.some((c) => c.trim()));
}

function Pontos() {
  const { enviar, enviando, calculando } = useEnviar();
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Celula[][] | null>(null);
  const [erros, setErros] = useState(0);
  const [previa, setPrevia] = useState<{ novas: number; existentes: number } | null>(null);
  const [analisando, setAnalisando] = useState(false);

  async function analisar(brutas: unknown[][]) {
    setAnalisando(true);
    setPrevia(null);
    try {
      // ignora cabeçalho (linha sem data válida conta como erro só se não for a primeira)
      const corpo = brutas.length && !diaISO(brutas[0]![0]) ? brutas.slice(1) : brutas;
      const ok: Celula[][] = [];
      let ruins = 0;
      for (const b of corpo) {
        const n = normalizar(b);
        if (n) ok.push(n);
        else ruins++;
      }
      setLinhas(ok);
      setErros(ruins);
      if (ok.length) {
        const r = await enviarAcao(crypto.randomUUID(), "importarPontos", { linhas: ok, simular: true });
        if (r.ok) setPrevia({ novas: Number(r["novas"] ?? 0), existentes: Number(r["existentes"] ?? 0) });
        else toast.error(r.mensagem);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível analisar.");
    } finally {
      setAnalisando(false);
    }
  }

  async function arquivo(f: File) {
    if (/\.xlsx?$/i.test(f.name)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      await analisar(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" }));
    } else {
      await analisar(textoParaLinhas(await f.text()));
    }
  }

  return (
    <div>
      <Titulo>Pontos lidos</Titulo>
      <Calculando ativo={calculando} />
      <div className="cartao space-y-3">
        <label className="botao-secundario cursor-pointer">
          Escolher arquivo (.csv ou .xlsx)
          <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void arquivo(f); e.target.value = ""; }} />
        </label>
        <p className="text-center text-sm text-muted-foreground">ou cole o texto copiado do sistema</p>
        <textarea className="campo min-h-32 py-3 font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="dia	CODIND	turno	tear	grupo	pontos	..." />
        <button className="botao-secundario" disabled={!texto.trim() || analisando} onClick={() => void analisar(textoParaLinhas(texto))}>
          {analisando ? "Analisando..." : "Ver prévia"}
        </button>
      </div>

      {linhas && (
        <div className="cartao mt-4 space-y-3">
          <p className="text-lg font-bold">
            {previa ? `${previa.novas} linhas novas, ${previa.existentes} já existem` : `${linhas.length} linhas válidas`}
            {`, ${erros} com erro`}
          </p>
          <button className="botao-primario" disabled={enviando || !linhas.length || previa?.novas === 0}
            onClick={() => void enviar("importarPontos", { linhas }).then((r) => {
              if (r?.tipo === "ok") { setLinhas(null); setPrevia(null); setTexto(""); }
            })}>
            {enviando ? "Enviando..." : "Gravar na planilha"}
          </button>
        </div>
      )}
    </div>
  );
}
