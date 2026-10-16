import { Gauge } from "lucide-react";
import { useState } from "react";
import { ativarDemo, salvarApiUrl } from "@/lib/config";

/** Primeira abertura: informa o endereço da planilha (ou escolhe a demonstração). */
export function Configurar({ aoConcluir }: { aoConcluir: () => void }) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) {
      setErro("O endereço deve começar com https://script.google.com e terminar em /exec.");
      return;
    }
    salvarApiUrl(u);
    aoConcluir();
  }

  return (
    <div className="seguro-topo flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-10 w-10 text-primary" />
        <span className="text-3xl font-bold tracking-tight">PREP</span>
      </div>
      <form onSubmit={salvar} className="w-full max-w-sm space-y-4">
        <label className="rotulo" htmlFor="url">
          Endereço da planilha (Apps Script, termina em /exec)
        </label>
        <input
          id="url"
          className="campo"
          inputMode="url"
          autoComplete="off"
          placeholder="https://script.google.com/macros/s/.../exec"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {erro && <p className="text-center text-sm font-medium text-destructive">{erro}</p>}
        <button className="botao-primario" disabled={!url.trim()}>
          Conectar
        </button>
        <button
          type="button"
          className="botao-secundario"
          onClick={() => {
            ativarDemo();
            aoConcluir();
          }}
        >
          Ver demonstração
        </button>
      </form>
    </div>
  );
}
