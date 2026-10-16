// Endereço do Web App (Apps Script) que fala com a planilha.
// Ordem: variável VITE_API_URL (build) → URL_PADRAO abaixo → endereço salvo neste aparelho → vazio (demonstração).
const CHAVE = "prep.apiUrl";

// Endereço fixo da planilha (Apps Script). Para trocar, edite aqui ou defina VITE_API_URL.
const URL_PADRAO =
  "https://script.google.com/macros/s/AKfycbz_flwAf6BLaiq2T612T7gT5Uk2Z5nGSmdEahKJpxo66VAG0LuGURO2LtnBMbIRLCxo/exec";

export function apiUrl(): string {
  const env: string = import.meta.env["VITE_API_URL"] ?? "";
  if (env) return env;
  if (URL_PADRAO) return URL_PADRAO;
  try {
    return localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function salvarApiUrl(url: string): void {
  try {
    if (url) localStorage.setItem(CHAVE, url.trim());
    else localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}

const CHAVE_DEMO = "prep.modoDemo";

export function modoDemo(): boolean {
  if (apiUrl()) return false;
  try {
    return localStorage.getItem(CHAVE_DEMO) === "1";
  } catch {
    return false;
  }
}

export function ativarDemo(): void {
  try {
    localStorage.setItem(CHAVE_DEMO, "1");
  } catch {
    /* ignora */
  }
}

/** Precisa configurar: nem endereço da planilha, nem demonstração escolhida. */
export function precisaConfigurar(): boolean {
  return !apiUrl() && !modoDemo();
}
