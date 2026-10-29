import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedFrontendOrigin } from "./frontend-origins.js";

const live = "https://mapa-costalog.vercel.app";
const knownPreview =
  "https://mapa-costalog-git-feat-roadmap-ph-1cce3a-riquelmemourafernandes.vercel.app";

test("permite domínio de produção explicitamente configurado", () => {
  assert.equal(isAllowedFrontendOrigin(live, live), true);
  assert.equal(isAllowedFrontendOrigin(live, live + "/"), true);
});

test("permite endereço conhecido da prévia do MAPA-COSTALOG", () => {
  assert.equal(isAllowedFrontendOrigin(knownPreview, live), true);
  assert.equal(isAllowedFrontendOrigin(
    "https://mapa-costalog-664fnuqft-riquelmemourafernandes.vercel.app", live
  ), true);
});

test("permite domínios adicionais somente quando explicitamente configurados", () => {
  const custom = "https://mapa.costalog.com.br";
  assert.equal(isAllowedFrontendOrigin(custom, live), false);
  assert.equal(isAllowedFrontendOrigin(custom, live, "https://outro.exemplo.com, " + custom + "/"), true);
});

test("rejeita sites Vercel de terceiros e domínios semelhantes", () => {
  const denied = [
    "https://mapa-costalog.vercel.app.evil.com",
    "https://mapa-costalog-evil.vercel.app",
    "https://mapa-costalog-git-branch-outro-usuario.vercel.app",
    "https://evil-riquelmemourafernandes.vercel.app",
    "http://mapa-costalog.vercel.app",
    "null",
    knownPreview + ".evil.com",
    knownPreview + "/wrongpath",
    "https://mapa-costalog.vercel.app:4443"
  ];
  for (const origin of denied) {
    assert.equal(isAllowedFrontendOrigin(origin, live), false, origin);
  }
});

test("não permite origens genéricas em produção sem configuração", () => {
  assert.equal(isAllowedFrontendOrigin("https://anywhere.example", ""), false);
  assert.equal(isAllowedFrontendOrigin("https://example.com", "", "https://another.example"), false);
});
