import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculando, ComDados, Titulo } from "@/components/Estados";
import { useEnviar } from "@/hooks/useEnviar";
import type { LeituraAPI, Parametros } from "@/lib/tipos";

export const Route = createFileRoute("/parametros")({
  head: () => ({
    meta: [
      { title: "Parâmetros — PREP" },
      { name: "description", content: "Velocidades, trocas de partida, esperas e tamanho de rolo." },
      { property: "og:title", content: "Parâmetros — PREP" },
      { property: "og:description", content: "Velocidades, trocas, esperas e tamanho de rolo." },
    ],
  }),
  component: () => <ComDados>{(d) => <Params dados={d} />}</ComDados>,
});

const CAMPOS: { campo: keyof Parametros; rotulo: string }[] = [
  { campo: "velUrdideira", rotulo: "Velocidade urdideira (m/min)" },
  { campo: "trocaUrdideira", rotulo: "Troca de partida urdideira (h)" },
  { campo: "velEngomadeira", rotulo: "Velocidade engomadeira (m/min)" },
  { campo: "trocaEngomadeira", rotulo: "Troca de partida engomadeira (h)" },
  { campo: "esperaUrdideiraEngomadeira", rotulo: "Espera urdideira → engomadeira (h)" },
  { campo: "esperaEngomadeiraEstoque", rotulo: "Espera engomadeira → estoque (h)" },
  { campo: "roloMaximo", rotulo: "Rolo máximo (m)" },
  { campo: "roloMinimo", rotulo: "Rolo mínimo (m)" },
];

function Params({ dados }: { dados: LeituraAPI }) {
  const { enviar, enviando, calculando } = useEnviar();
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(CAMPOS.map(({ campo }) => [campo, String(dados.parametros[campo] ?? "")])),
  );

  return (
    <div>
      <Titulo>Parâmetros</Titulo>
      <Calculando ativo={calculando} />
      <div className="space-y-3">
        {CAMPOS.map(({ campo, rotulo }) => {
          const atual = String(dados.parametros[campo] ?? "");
          const v = valores[campo] ?? "";
          const n = Number(v.replace(",", "."));
          const mudou = v !== atual;
          return (
            <div key={campo} className="cartao space-y-2">
              <label className="rotulo" htmlFor={campo}>{rotulo}</label>
              <div className="flex gap-2">
                <input id={campo} className="campo" inputMode="decimal" value={v}
                  onChange={(e) => setValores({ ...valores, [campo]: e.target.value })} />
                <button className="rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40"
                  disabled={!mudou || enviando || !(n > 0)}
                  onClick={() => void enviar("setParametro", { campo, valor: n, valorAnterior: dados.parametros[campo] })}>
                  Salvar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
