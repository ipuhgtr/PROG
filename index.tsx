import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ComDados, Titulo } from "@/components/Estados";
import { InstalarApp } from "@/components/InstalarApp";
import { dataHora, fimDeHoje, fimTurnoAtual, hora, numero, turnoLetra } from "@/lib/format";
import type { Distribuicao, LeituraAPI, Tear } from "@/lib/tipos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Previsão de parada — PREP" },
      { name: "description", content: "Quais teares param primeiro e qual rolo vai para cada um." },
      { property: "og:title", content: "Previsão de parada — PREP" },
      { property: "og:description", content: "Quais teares param primeiro e qual rolo vai para cada um." },
    ],
  }),
  component: () => <ComDados>{(d) => <Previsao dados={d} />}</ComDados>,
});

type Nivel = "vermelho" | "amarelo" | "verde";

interface Linha {
  tear: Tear;
  parada: Date | null;
  turno: string;
  nivel: Nivel;
  rolo: Distribuicao | undefined;
}

function Previsao({ dados }: { dados: LeituraAPI }) {
  const [artigo, setArtigo] = useState("");
  const [turno, setTurno] = useState("");
  const [semRolo, setSemRolo] = useState(false);

  const linhas = useMemo<Linha[]>(() => {
    const agora = new Date();
    const fimTurno = fimTurnoAtual(agora).getTime();
    const tresDias = fimDeHoje(agora).getTime() + 3 * 86_400_000;
    return dados.teares
      .map((t) => {
        const iso = t.paradaDepoisEstoque || t.paradaSemEstoque;
        const parada = iso ? new Date(iso) : null;
        const ms = parada?.getTime() ?? Infinity;
        const nivel: Nivel = ms <= fimTurno ? "vermelho" : ms <= tresDias ? "amarelo" : "verde";
        return {
          tear: t,
          parada,
          turno: turnoLetra(t.paradaDepoisEstoque ? t.turnoDepois : t.turno),
          nivel,
          rolo: dados.distribuicao.find((r) => r.tear === t.tear),
        };
      })
      .sort((a, b) => (a.parada?.getTime() ?? Infinity) - (b.parada?.getTime() ?? Infinity));
  }, [dados]);

  const resumo = useMemo(() => {
    const agora = new Date();
    const fimTurno = fimTurnoAtual(agora).getTime();
    const hoje = fimDeHoje(agora).getTime();
    const tres = hoje + 3 * 86_400_000;
    const porArtigo = new Map<string, [number, number, number]>();
    for (const l of linhas) {
      const ms = l.parada?.getTime() ?? Infinity;
      const c = porArtigo.get(l.tear.artigo) ?? [0, 0, 0];
      if (ms <= fimTurno) c[0]++;
      if (ms <= hoje) c[1]++;
      if (ms <= tres) c[2]++;
      porArtigo.set(l.tear.artigo, c);
    }
    return [...porArtigo.entries()].filter(([, c]) => c[2] > 0);
  }, [linhas]);

  const artigos = [...new Set(dados.teares.map((t) => t.artigo))].sort();
  const visiveis = linhas.filter(
    (l) => (!artigo || l.tear.artigo === artigo) && (!turno || l.turno === turno) && (!semRolo || !l.rolo),
  );

  return (
    <div>
      <Titulo>Previsão de parada</Titulo>

      <div className="cartao mb-4">
        <div className="mb-2 grid grid-cols-4 gap-2 text-xs font-semibold text-muted-foreground">
          <span>Artigo</span><span className="text-center">Turno</span><span className="text-center">Hoje</span><span className="text-center">3 dias</span>
        </div>
        {resumo.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tear para nos próximos 3 dias.</p>}
        {resumo.map(([a, c]) => (
          <div key={a} className="grid grid-cols-4 gap-2 border-t border-border py-1.5 text-sm">
            <span className="font-medium">{a}</span>
            <span className={`text-center font-bold ${c[0] ? "text-perigo" : ""}`}>{c[0]}</span>
            <span className="text-center">{c[1]}</span>
            <span className="text-center">{c[2]}</span>
          </div>
        ))}
      </div>

      {dados.avisos.length > 0 && (
        <div className="mb-4 space-y-1 rounded-xl bg-alerta px-3 py-2 text-sm text-alerta-foreground">
          {dados.avisos.map((a) => <p key={a}>{a}</p>)}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <select className="campo" value={artigo} onChange={(e) => setArtigo(e.target.value)} aria-label="Filtrar artigo">
          <option value="">Todos os artigos</option>
          {artigos.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="campo" value={turno} onChange={(e) => setTurno(e.target.value)} aria-label="Filtrar turno">
          <option value="">Todos os turnos</option>
          <option>A</option><option>B</option><option>C</option>
        </select>
        <label className="col-span-2 flex min-h-12 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="h-6 w-6" checked={semRolo} onChange={(e) => setSemRolo(e.target.checked)} />
          Só os que ficam sem rolo
        </label>
      </div>

      <div className="space-y-3">
        {visiveis.map((l) => <CartaoTear key={l.tear.tear} linha={l} />)}
        {visiveis.length === 0 && <p className="text-center text-muted-foreground">Nenhum tear neste filtro.</p>}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">atualizado às {hora(dados.atualizadoEm)}</p>
      <InstalarApp />
    </div>
  );
}

const COR: Record<Nivel, string> = {
  vermelho: "border-l-perigo",
  amarelo: "border-l-alerta",
  verde: "border-l-sucesso",
};

function CartaoTear({ linha: l }: { linha: Linha }) {
  const num = Number(l.tear.tear.replace(/\D/g, "").slice(-3));
  return (
    <div className={`cartao border-l-8 ${COR[l.nivel]}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-bold">Tear {num || l.tear.tear}</span>
        <span className="text-sm font-medium text-muted-foreground">{l.tear.artigo}</span>
      </div>
      <div className="mt-1 text-base">
        Para em <strong>{dataHora(l.parada)}</strong> · turno {l.turno || "—"}
      </div>
      <div className="text-sm text-muted-foreground">{numero(l.tear.metrosUteis)} m úteis restantes</div>
      <div className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm">
        {l.rolo ? (
          <>Rolo {l.rolo.rolo} · {numero(l.rolo.metros)} m · {l.rolo.origem ?? "—"} · pronto {dataHora(l.rolo.disponivelEm)}</>
        ) : (
          <span className="font-semibold text-perigo">Sem rolo previsto</span>
        )}
      </div>
    </div>
  );
}
