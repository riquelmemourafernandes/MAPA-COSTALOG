// C / STATUS drives conditional formatting across the entire operational row.
// These are display-only rules; never change stored data or individual styles.
export const STATUS_COLORS = [
  { status: "NOVO", background: "#ffffff" },
  { status: "EM ABERTO", background: "#ffff00" },
  { status: "DOC. - EMITIDO", background: "#00a7ff" },
  { status: "A CAMINHO DO DEPOT", background: "#ff9900" },
  { status: "AG. INTERCAMBIO", background: "#999999" },
  { status: "AG. CTE SUB.", background: "#ffff00" },
  { status: "PROC. - CANCELADO", background: "#ff0000" },
  { status: "PROC. - FINALIZADO", background: "#00b050" },
  { status: "AG. DOCS", background: "#ffffff" },
  { status: "PATIO AG. ENTREGA", background: "#ff00ff" },
  { status: "RETIRADA", background: "#f1c232" },
  { status: "PATIO AG. ESCALA", background: "#ffe599" },
  { status: "FRETE MORTO", background: "#9900ff" },
  { status: "CAMINHO TERM. APOIO", background: "#d9d2e9" },
  { status: "AG. CONF. REUSE", background: "#ff9900" },
  { status: "EM EMISSÃO", background: "#00ffff" }
] as const;

export function normalizeStatus(status: unknown): string {
  if (typeof status !== "string") return "";
  return status.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");
}

const STATUS_COLOR_MAP = new Map(STATUS_COLORS.map(rule => [
  normalizeStatus(rule.status), rule.background
]));

export function statusRowColor(status: unknown): string | null {
  return STATUS_COLOR_MAP.get(normalizeStatus(status)) ?? null;
}

export function hasStatusRule(status: unknown): boolean {
  return statusRowColor(status) !== null;
}

export function statusRowTextColor(background: string): string {
  // WCAG-style contrast threshold for the standard palette.
  const rgb = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const l = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return l > 0.179 ? "#17271d" : "#ffffff";
}
