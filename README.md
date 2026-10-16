# PREP — Previsão e Preparação (PWA)

App instalável (celular) ligado à planilha **PROGRAMAÇÃO PREP**. Sem login e sem PIN: abriu, usou.
Telas: Previsão, FAT, Estoque, Preparação (urdideira/engomadeira), Pendentes, Pontos e Parâmetros.
Funciona offline: mostra a última leitura e guarda os lançamentos numa fila que envia sozinha quando volta a internet.

## Ligar o app à planilha (uma vez, ~3 minutos)

1. Abra a planilha → **Extensões → Apps Script**. Apague o que houver em `Código.gs` e cole o conteúdo de `apps-script/Code.gs`.
2. (Opcional) Em *Configurações do projeto* marque *Mostrar o arquivo appsscript.json* e cole `apps-script/appsscript.json`.
3. **Implantar → Nova implantação → Tipo: App da Web** · Executar como: **Eu** · Quem pode acessar: **Qualquer pessoa** → Implantar → autorize → copie o endereço que termina em `/exec`.
4. O endereço já está fixo em `src/lib/config.ts` (`URL_PADRAO`). Se criar uma nova implantação com outro endereço, troque lá (ou defina `VITE_API_URL`).

Ao mudar o `Code.gs` depois: **Implantar → Gerenciar implantações → editar → Nova versão** (o endereço continua o mesmo).

> Quem tiver o endereço `/exec` consegue ler e lançar dados. Não divulgue o endereço fora da equipe.

## O que o app faz na planilha

| Ação no app | Onde grava |
|---|---|
| Lançar FAT | PONTOS LIDOS, colunas O:R (linhas 2–501) |
| Importar pontos | PONTOS LIDOS, colunas A:M (primeira linha livre; ignora linhas já existentes) |
| Estoque (adicionar/baixar rolo) | ESTOQUE, linhas 41–190 (colunas B:C) |
| Urdideira / engomadeira | ESTOQUE, linhas 15–26 e 30–37 (colunas B, C, D, L); as partidas de baixo sobem quando uma sai |
| Parâmetros | PARAM ROLOS (B6, B29:B36) |

Tudo o que é previsão (TEARES, DISTRIBUIÇÃO, ROLOS PREVISTOS, resumo) é lido pronto da planilha — o app não recalcula nada. O script cria uma aba oculta `LOG_API` para não gravar a mesma operação duas vezes.

Se você mudar linhas/colunas da planilha, ajuste as constantes no topo do `Code.gs`.

## Instalar no celular

Abra o link publicado no Chrome (Android) ou Safari (iPhone) → **Adicionar à tela inicial**. O service worker só registra no site publicado (não no preview da Lovable); `?sw=off` desliga.

## Desenvolvimento

```sh
npm i --legacy-peer-deps
npm run dev      # sem endereço configurado, "Ver demonstração" usa dados de exemplo
npm run build    # gera .output/ com sw.js e manifest
npm test
npx tsc --noEmit
```
