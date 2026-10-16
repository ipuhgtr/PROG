import { Component, type ReactNode } from "react";

interface Estado {
  erro: Error | null;
}

/** Nenhuma tela em branco: sempre mensagem e botão "tentar de novo". */
export class ErroBoundary extends Component<{ children: ReactNode }, Estado> {
  override state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  override componentDidCatch(erro: Error): void {
    console.error(erro);
  }

  override render(): ReactNode {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          O app encontrou um problema inesperado. Seus lançamentos pendentes
          continuam salvos neste aparelho.
        </p>
        <button
          className="botao-primario max-w-xs"
          onClick={() => {
            this.setState({ erro: null });
            window.location.reload();
          }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }
}
