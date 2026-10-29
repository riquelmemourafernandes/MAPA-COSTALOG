// CORS allowlist shared by production and preview deployments.
// FRONTEND_ORIGIN is the primary deployment; FRONTEND_ORIGINS may contain
// additional comma-separated, explicitly approved origins.
const ownedVercelPreview =
  /^https:\/\/mapa-costalog(?:-[a-z0-9-]+)?-riquelmemourafernandes\.vercel\.app$/;

// GitHub Pages serves this user's repositories from one shared origin.
// Permit only the exact account origin; CORS is not a substitute for API auth.
const ownedGitHubPagesHomologation =
  "https://riquelmemourafernandes.github.io";

function normalizeConfiguredOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isAllowedFrontendOrigin(
  origin: string,
  primaryOrigin = "",
  additionalOrigins = ""
): boolean {
  const configuredOrigins = [
    primaryOrigin,
    ...additionalOrigins.split(",")
  ].map(normalizeConfiguredOrigin).filter(Boolean);

  // Exact comparison; no generic *.vercel.app or arbitrary domains.
  if (configuredOrigins.includes(origin)) return true;

  // Only Vercel deployments belonging to the named Costalog project/team.
  if (ownedVercelPreview.test(origin)) return true;

  // The exact GitHub Pages origin used by MAPA-COSTALOG homologation.
  return origin === ownedGitHubPagesHomologation;
}
