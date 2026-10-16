import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculando, ComDados, Titulo } from "@/components/Estados";
import { useEnviar } from "@/hooks/useEnviar";
import { dataCurta, hojeISO, numero, turnoAtual } from "@/lib/format";
import type { LeituraAPI } from "@/lib/tipos";

export const Route = createFileRoute("/fat")({
  head: () => ({
    meta: [
      { title: "Lançar FAT — PREP" },
      { name: "description", content: "Lançar metros emendados (FAT) por tear e turno." },
      { property: "og:title", content: "Lançar FAT — PREP" },
      { property: "og:description", content: "Lançar metros emendados (FAT) por tear e turno." },
    ],
  }),
  component: () => <ComDados>{(d) => <Fat dados={d} />}</ComDados>,
});

const TURNOS = ["A", "B", "C", "1", "2", "3"];

function Fat({ dados }: { dados: LeituraAPI }) {
  const { enviar, enviando, calculando } = useEnviar();
  const [dia, setDia] = useState(hojeISO());
  const [tear, setTear] = useState("");
  const [metros, setMetros] = useState("");
  const [turno, setTurno] = useState<string>(turnoAtual());
  const [confirmar, setConfirmar] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);

  const nTear = Number(tear);
  const nMetros = Number(metros.replace(/\./g, "").replace(",", "."));
  const tearOk = Number.isInteger(nTear) && nTear >= 1 && nTear <= 92;
  const metrosOk = nMetros > 0;
  const acimaMax = metrosOk && nMetros > dados.parametros.roloMaximo;
  const ultima = tearOk ? dados.ultimasFats?.[String(nTear)] : undefined;
  const cheia = dados.capacidade.fatsUsadas >= dados.capacidade.fatsTotal;

  async function mandar(substituir: boolean) {
    const r = await enviar("addFat", { dia, tear: nTear, metros: nMetros, turno, substituir }, { manterConflito: true });
    if (!r) return;
    if (r.tipo === "decisao" && r.resposta.status === "conflito") {
      setConflito(r.resposta.mensagem);
      return;
    }
    setConfirmar(false);
    setConflito(null);
    if (r.tipo !== "decisao") {
      setTear("");
      setMetros("");
    }
  }

  const resumo = `Tear ${nTear} · ${numero(nMetros)} m · turno ${turno} · ${dataCurta(dia + "T12:00:00-03:00")}`;

  if (confirmar) {
    return (
      <div>
        <Titulo>Confirmar FAT</Titulo>
        <div className="cartao mb-4 text-center text-xl font-bold">{resumo}</div>
        {conflito ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-alerta px-3 py-2 text-sm font-medium text-alerta-foreground">{conflito}</p>
            <button className="botao-perigo" disabled={enviando} onClick={() => void mandar(true)}>
              Substituir a FAT existente
            </button>
            <button className="botao-secundario" onClick={() => { setConflito(null); setConfirmar(false); }}>
              Não substituir
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button className="botao-primario" disabled={enviando} onClick={() => void mandar(false)}>
              {enviando ? "Enviando..." : "Enviar FAT"}
            </button>
            <button className="botao-secundario" disabled={enviando} onClick={() => setConfirmar(false)}>Voltar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Titulo>Lançar FAT</Titulo>
      <Calculando ativo={calculando} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (tearOk && metrosOk && !cheia) setConfirmar(true);
        }}
      >
        <div>
          <label className="rotulo" htmlFor="tear">Tear (número)</label>
          <input id="tear" className="campo text-xl" inputMode="numeric" value={tear} onChange={(e) => setTear(e.target.value.replace(/\D/g, ""))} />
          {tear && !tearOk && <p className="mt-1 text-sm text-destructive">Tear de 1 a 92.</p>}
          {ultima && (
            <p className="mt-1 text-sm text-muted-foreground">
              Última FAT: {dataCurta(ultima.dia + "T12:00:00-03:00")} · turno {ultima.turno} · {numero(ultima.metros)} m
            </p>
          )}
        </div>
        <div>
          <label className="rotulo" htmlFor="metros">Metros emendados</label>
          <input id="metros" className="campo text-xl" inputMode="decimal" value={metros} onChange={(e) => setMetros(e.target.value)} />
          {acimaMax && <p className="mt-1 text-sm text-alerta-foreground">Atenção: acima do rolo máximo ({numero(dados.parametros.roloMaximo)} m).</p>}
        </div>
        <div>
          <span className="rotulo">Turno</span>
          <div className="grid grid-cols-3 gap-2">
            {TURNOS.map((t) => (
              <button type="button" key={t} onClick={() => setTurno(t)} className={turno === t ? "botao-primario" : "botao-secundario"}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="dia">Dia</label>
          <input id="dia" type="date" className="campo" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        {cheia && <p className="text-sm font-semibold text-destructive">Lista de FATs cheia ({dados.capacidade.fatsTotal}). Avise o administrador.</p>}
        <button className="botao-primario" disabled={!tearOk || !metrosOk || cheia}>Continuar</button>
      </form>
    </div>
  );
}
