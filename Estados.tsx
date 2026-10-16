import { useDados } from "@/hooks/useDados";
import { dataHora } from "@/lib/format";
import type { LeituraAPI } from "@/lib/tipos";

/** Garante dados carregados: mostra carregando/erro com "tentar de novo". */
export function ComDados({ children }: { children: (d: LeituraAPI) => React.ReactNode }) {
  const { data, error, isFetching, refetch, isPlaceholderData } = useDados();
  if (!data) {
    if (error) {
      return (
        <div className="cartao space-y-3 text-center">
          <p className="font-semibold">Não foi possível ler a planilha</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          <button className="botao-primario" onClick={() => void refetch()}>Tentar de novo</button>
        </div>
      );
    }
    return <p className="py-10 text-center text-muted-foreground">Lendo a planilha...</p>;
  }
  return (
    <>
      {(error || isPlaceholderData) && !isFetching && (
        <div className="mb-3 rounded-xl bg-alerta px-3 py-2 text-sm font-medium text-alerta-foreground">
          Mostrando a última leitura salva ({dataHora(data.atualizadoEm)}).{" "}
          <button className="underline" onClick={() => void refetch()}>Tentar de novo</button>
        </div>
      )}
      {children(data)}
    </>
  );
}

export function Calculando({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return (
    <div className="mb-3 animate-pulse rounded-xl bg-secondary px-3 py-2 text-center text-sm font-medium">
      calculando...
    </div>
  );
}

export function Titulo({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>;
}
