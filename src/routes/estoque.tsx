import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculando, ComDados, Titulo } from "@/components/Estados";
import { useEnviar } from "@/hooks/useEnviar";
import { dataHora, numero } from "@/lib/format";
import type { LeituraAPI, Rolo } from "@/lib/tipos";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque de rolos — PREP" },
      { name: "description", content: "Rolos prontos no estoque por artigo: adicionar e dar baixa." },
      { property: "og:title", content: "Estoque de rolos — PREP" },
      { property: "og:description", content: "Rolos prontos no estoque por artigo." },
    ],
  }),
  component: () => <ComDados>{(d) => <Estoque dados={d} />}</ComDados>,
});

function Estoque({ dados }: { dados: LeituraAPI }) {
  const { enviar, enviando, calculando } = useEnviar();
  const artigos = dados.parametros.artigos;
  const [artigo, setArtigo] = useState(artigos[0] ?? "");
  const [metros, setMetros] = useState("");
  const [qtd, setQtd] = useState("1");
  const [baixa, setBaixa] = useState<Rolo | null>(null);

  const nMetros = Number(metros.replace(/\./g, "").replace(",", "."));
  const nQtd = Math.max(1, Math.floor(Number(qtd) || 1));
  const livres = dados.capacidade.rolosTotal - dados.capacidade.rolosUsados;

  const porArtigo = new Map<string, Rolo[]>();
  for (const r of dados.estoque.rolos) porArtigo.set(r.artigo, [...(porArtigo.get(r.artigo) ?? []), r]);

  return (
    <div>
      <Titulo>Estoque de rolos</Titulo>
      <Calculando ativo={calculando} />

      <div className="mb-4 space-y-2">
        {dados.estoque.resumo.map((r) => (
          <div key={r.artigo} className="cartao">
            <div className="flex justify-between font-bold"><span>{r.artigo}</span><span>{r.teares} teares</span></div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-sm">
              <span>Estoque<br /><b>{r.estoqueRolos}</b> · {numero(r.estoqueMetros)} m</span>
              <span>Engomando<br /><b>{r.engomandoRolos}</b> · {numero(r.engomandoMetros)} m</span>
              <span>Urdideira<br /><b>{r.urdideiraRolos}</b> · {numero(r.urdideiraMetros)} m</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Próximo rolo pronto: {dataHora(r.proximoRoloProntoEm)}</div>
          </div>
        ))}
        {dados.estoque.avisos.map((a) => (
          <p key={a} className="rounded-xl bg-alerta px-3 py-2 text-sm text-alerta-foreground">{a}</p>
        ))}
      </div>

      <form
        className="cartao mb-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!(nMetros > 0) || !artigo || nQtd > livres) return;
          void enviar("addRolos", { artigo, metros: nMetros, quantidade: nQtd }).then((r) => {
            if (r?.tipo !== "decisao") setMetros("");
          });
        }}
      >
        <h2 className="font-bold">Adicionar rolo</h2>
        <select className="campo" value={artigo} onChange={(e) => setArtigo(e.target.value)} aria-label="Artigo">
          {artigos.map((a) => <option key={a}>{a}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rotulo" htmlFor="m">Metros</label>
            <input id="m" className="campo" inputMode="decimal" value={metros} onChange={(e) => setMetros(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="q">Quantos iguais</label>
            <input id="q" className="campo" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        {nMetros > dados.parametros.roloMaximo && (
          <p className="text-sm">Atenção: acima do rolo máximo ({numero(dados.parametros.roloMaximo)} m).</p>
        )}
        {nQtd > livres && <p className="text-sm font-semibold text-destructive">Lista cheia: só cabem {livres} rolos.</p>}
        <button className="botao-primario" disabled={enviando || !(nMetros > 0) || nQtd > livres}>
          {enviando ? "Enviando..." : `Adicionar ${nQtd} rolo(s)`}
        </button>
      </form>

      {[...porArtigo.entries()].map(([a, rolos]) => (
        <div key={a} className="mb-4">
          <h2 className="mb-2 font-bold">{a} · {rolos.length} rolos</h2>
          <div className="space-y-2">
            {rolos.map((r) => (
              <div key={r.linha} className="cartao flex items-center justify-between py-2">
                <span className="text-lg font-semibold">{numero(r.metros)} m</span>
                <button className="rounded-xl border border-border px-4 py-3 text-sm font-semibold" onClick={() => setBaixa(r)}>
                  Dar baixa
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {baixa && (
        <div className="fixed inset-0 z-20 flex items-end bg-foreground/40 p-4" onClick={() => setBaixa(null)}>
          <div className="cartao w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-lg font-bold">Dar baixa: {baixa.artigo} · {numero(baixa.metros)} m?</p>
            <button
              className="botao-perigo"
              disabled={enviando}
              onClick={() => void enviar("baixaRolo", { artigo: baixa.artigo, metros: baixa.metros }).then(() => setBaixa(null))}
            >
              Confirmar baixa
            </button>
            <button className="botao-secundario" onClick={() => setBaixa(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
