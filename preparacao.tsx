import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculando, ComDados, Titulo } from "@/components/Estados";
import { useEnviar } from "@/hooks/useEnviar";
import { dataHora, localParaISO, numero } from "@/lib/format";
import type { LeituraAPI, Partida } from "@/lib/tipos";

export const Route = createFileRoute("/preparacao")({
  head: () => ({
    meta: [
      { title: "Urdideira e engomadeira — PREP" },
      { name: "description", content: "Fila de partidas da urdideira e da engomadeira com horários da planilha." },
      { property: "og:title", content: "Urdideira e engomadeira — PREP" },
      { property: "og:description", content: "Fila de partidas da urdideira e da engomadeira." },
    ],
  }),
  component: () => <ComDados>{(d) => <Preparacao dados={d} />}</ComDados>,
});

type Maquina = "urdideira" | "engomadeira";
type Modal =
  | { tipo: "nova" }
  | { tipo: "editar"; p: Partida }
  | { tipo: "pronto"; p: Partida }
  | { tipo: "receber"; p: Partida }
  | { tipo: "mover"; p: Partida };

function Preparacao({ dados }: { dados: LeituraAPI }) {
  const [maquina, setMaquina] = useState<Maquina>("urdideira");
  const [modal, setModal] = useState<Modal | null>(null);
  const { enviar, enviando, calculando } = useEnviar();
  const lista = dados.estoque[maquina];
  const total = maquina === "urdideira" ? dados.capacidade.urdideiraTotal : dados.capacidade.engomadeiraTotal;

  return (
    <div>
      <Titulo>Preparação</Titulo>
      <Calculando ativo={calculando} />
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["urdideira", "engomadeira"] as const).map((m) => (
          <button key={m} className={maquina === m ? "botao-primario" : "botao-secundario"} onClick={() => setMaquina(m)}>
            {m === "urdideira" ? "Urdideira" : "Engomadeira"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {lista.map((p, i) => (
          <div key={p.linha} className="cartao space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold">{i + 1}. {p.artigo}</span>
              <span className="font-medium">{numero(p.metragem)} m</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {maquina === "urdideira" && <span>Urdir: {dataHora(p.inicioUrdir)} → {dataHora(p.fimUrdir)}</span>}
              <span>Engomar: {dataHora(p.inicioEngomar)} → {dataHora(p.fimEngomar)}</span>
              <span>{p.qtdRolos || "—"} rolos</span>
              <span className="font-semibold">No estoque: {dataHora(p.prontoNoEstoqueEm)}</span>
            </div>
            {p.comecouEm && <div className="text-xs text-muted-foreground">Começou em {dataHora(p.comecouEm)}</div>}
            {p.prontoEmManual && <div className="text-xs text-muted-foreground">Pronto em (manual): {dataHora(p.prontoEmManual)}</div>}
            {p.aviso && <div className="rounded-lg bg-alerta px-2 py-1 text-sm text-alerta-foreground">{p.aviso}</div>}
            <div className="grid grid-cols-2 gap-2">
              {!p.comecouEm && (
                <button className="botao-primario min-h-12 text-sm" disabled={enviando}
                  onClick={() => void enviar("iniciarPartida", { maquina, linha: p.linha })}>
                  Iniciou agora
                </button>
              )}
              <button className="botao-secundario min-h-12 text-sm" onClick={() => setModal({ tipo: "pronto", p })}>Pronto em</button>
              <button className="botao-secundario min-h-12 text-sm" onClick={() => setModal({ tipo: "editar", p })}>Editar</button>
              {maquina === "urdideira" ? (
                <button className="botao-secundario min-h-12 text-sm" onClick={() => setModal({ tipo: "mover", p })}>
                  Passou p/ engomadeira
                </button>
              ) : (
                <button className="botao-secundario min-h-12 text-sm" onClick={() => setModal({ tipo: "receber", p })}>
                  Terminou — receber rolos
                </button>
              )}
            </div>
          </div>
        ))}
        {lista.length === 0 && <p className="text-center text-muted-foreground">Nenhuma partida na fila.</p>}
      </div>

      <button className="botao-primario mt-4" disabled={lista.length >= total} onClick={() => setModal({ tipo: "nova" })}>
        {lista.length >= total ? `Lista cheia (${total})` : "Adicionar partida"}
      </button>

      {modal && (
        <div className="fixed inset-0 z-20 flex items-end bg-foreground/40 p-4" onClick={() => setModal(null)}>
          <div className="cartao max-h-[85vh] w-full space-y-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <ConteudoModal modal={modal} maquina={maquina} dados={dados} enviando={enviando}
              enviar={(acao, d) => void enviar(acao, d).then((r) => { if (r && r.tipo !== "decisao") setModal(null); })}
              fechar={() => setModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ConteudoModal({
  modal, maquina, dados, enviando, enviar, fechar,
}: {
  modal: Modal;
  maquina: Maquina;
  dados: LeituraAPI;
  enviando: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enviar: (acao: any, d: any) => void;
  fechar: () => void;
}) {
  const p = "p" in modal ? modal.p : null;
  const [artigo, setArtigo] = useState(p?.artigo ?? dados.parametros.artigos[0] ?? "");
  const [metragem, setMetragem] = useState(p ? String(p.metragem) : "");
  const [pronto, setPronto] = useState("");
  const previstos = (dados.rolosPrevistos ?? []).filter(
    (r) => p && (r.partidaLinha === p.linha || (r.partidaLinha == null && r.artigo === p.artigo && /engom/i.test(r.origem))),
  );
  const [rolos, setRolos] = useState<string[]>(
    previstos.length ? previstos.map((r) => String(r.metros)) : p ? [String(p.metragem)] : [],
  );
  const nM = Number(metragem.replace(/\./g, "").replace(",", "."));
  const cancelar = <button className="botao-secundario" onClick={fechar}>Cancelar</button>;

  if (modal.tipo === "nova" || modal.tipo === "editar") {
    return (
      <>
        <h2 className="text-lg font-bold">{modal.tipo === "nova" ? "Nova partida" : "Editar partida"}</h2>
        <select className="campo" value={artigo} onChange={(e) => setArtigo(e.target.value)} aria-label="Artigo">
          {dados.parametros.artigos.map((a) => <option key={a}>{a}</option>)}
        </select>
        <input className="campo" inputMode="decimal" placeholder="Metragem da partida" value={metragem} onChange={(e) => setMetragem(e.target.value)} />
        <button className="botao-primario" disabled={enviando || !(nM > 0)}
          onClick={() => {
            if (modal.tipo === "nova") return enviar("addPartida", { maquina, artigo, metragem: nM });
            const mp = modal.p;
            if (artigo !== mp.artigo) enviar("editPartida", { maquina, linha: mp.linha, campo: "artigo", valor: artigo, valorAnterior: mp.artigo });
            else if (nM !== mp.metragem) enviar("editPartida", { maquina, linha: mp.linha, campo: "metragem", valor: nM, valorAnterior: mp.metragem });
            else fechar();
          }}>
          Salvar
        </button>
        {cancelar}
      </>
    );
  }
  if (modal.tipo === "pronto") {
    return (
      <>
        <h2 className="text-lg font-bold">Pronto em (manual)</h2>
        <input type="datetime-local" className="campo" value={pronto} onChange={(e) => setPronto(e.target.value)} />
        <button className="botao-primario" disabled={enviando || !localParaISO(pronto)}
          onClick={() => enviar("editPartida", { maquina, linha: modal.p.linha, campo: "prontoEm", valor: localParaISO(pronto), valorAnterior: modal.p.prontoEmManual })}>
          Salvar
        </button>
        {modal.p.prontoEmManual && (
          <button className="botao-secundario" disabled={enviando}
            onClick={() => enviar("editPartida", { maquina, linha: modal.p.linha, campo: "prontoEm", valor: null, valorAnterior: modal.p.prontoEmManual })}>
            Limpar horário manual
          </button>
        )}
        {cancelar}
      </>
    );
  }
  if (modal.tipo === "mover") {
    return (
      <>
        <p className="text-center text-lg font-bold">{modal.p.artigo} · {numero(modal.p.metragem)} m passou para a engomadeira?</p>
        <button className="botao-primario" disabled={enviando || dados.estoque.engomadeira.length >= dados.capacidade.engomadeiraTotal}
          onClick={() => enviar("moverParaEngomadeira", { linha: modal.p.linha, artigo: modal.p.artigo, metragem: modal.p.metragem })}>
          Confirmar
        </button>
        {cancelar}
      </>
    );
  }
  // receber
  const metrosRolos = rolos.map((r) => Number(r.replace(/\./g, "").replace(",", ".")));
  const valido = metrosRolos.length > 0 && metrosRolos.every((m) => m > 0);
  return (
    <>
      <h2 className="text-lg font-bold">Receber rolos no estoque</h2>
      <p className="text-sm text-muted-foreground">
        {modal.p.artigo} · divisão calculada pela planilha. Ajuste a metragem real se precisar.
      </p>
      {rolos.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="campo" inputMode="decimal" value={r} aria-label={`Rolo ${i + 1}`}
            onChange={(e) => setRolos(rolos.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="rounded-xl border border-border px-4" onClick={() => setRolos(rolos.filter((_, j) => j !== i))} aria-label="Remover rolo">✕</button>
        </div>
      ))}
      <button className="botao-secundario" onClick={() => setRolos([...rolos, ""])}>+ rolo</button>
      <button className="botao-primario" disabled={enviando || !valido}
        onClick={() => enviar("receberRolos", { maquina: "engomadeira", linha: modal.p.linha, artigo: modal.p.artigo, rolos: metrosRolos })}>
        Receber {rolos.length} rolo(s)
      </button>
      {cancelar}
    </>
  );
}
