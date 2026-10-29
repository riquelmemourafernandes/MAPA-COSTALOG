# Homologação do MAPA 2.0 no GitHub Pages

Esta prévia é **independente do Vercel de produção**. Ela é gerada somente a
partir da branch `feat/roadmap-phase1-filters` e publicada como arquivos
estáticos pelo GitHub Actions.

## Endereço previsto

https://riquelmemourafernandes.github.io/MAPA-COSTALOG/

O endereço só estará acessível quando o workflow de deploy terminar com
**success** e o GitHub Pages estiver configurado para receber GitHub Actions.

## Ativação do GitHub Pages (requer administrador do repositório)

1. Repositório **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Em **Settings → Environments → github-pages**, verifique as regras de
   proteção. A branch `feat/roadmap-phase1-filters` deve ser autorizada a
   publicar a prévia, caso haja restrições de branch.
3. Confira o workflow em **Actions → MAPA 2.0 - GitHub Pages Homologacao**.
   O passo `Deploy homologation website to GitHub Pages` precisa concluir
   com **success**.

A integração atual de GitHub não possui acesso administrativo para alterar
essas configurações por conta própria.

## API de homologação (Render)

O frontend publicado no Pages usa exclusivamente:

`https://mapa-costalog-api-homologacao.onrender.com`

O valor é inserido na compilação por `VITE_HOMOLOG_API_URL`; nenhum segredo
é inserido no JavaScript distribuído. Se a URL estiver ausente ou diferente,
o site de GitHub Pages **não** recorre à API de produção.

Para permitir o login e chamadas autenticadas no ambiente de homologação,
no **serviço de homologação do Render** configure:

`FRONTEND_ORIGINS=https://riquelmemourafernandes.github.io`

Se `FRONTEND_ORIGINS` já contiver outras origens, acrescente esta URL,
separando por vírgulas. Preserve `FRONTEND_ORIGIN` existente e **não**
altere o serviço de produção. Depois, aplique o redeploy da **API de
homologação** para efetivar a variável. O valor de CORS é apenas a origem
`https://riquelmemourafernandes.github.io`, sem o caminho
`/MAPA-COSTALOG/`.

A API deve responder em `/api/v1/health`; receber `Cannot GET /` na raiz
do servidor não significa que a API esteja parada. Confirme também que a
homologação usa seu banco de teste, e não o banco operacional de produção.

## Segurança e limitações

- O site estático do GitHub Pages é **público**. Nenhum segredo, token, senha
  ou dump da planilha deve ser versionado ou colocado em variáveis `VITE_*`.
- O login continua sendo controlado pela API de homologação. O Pages só
  fornece frontend; não substitui o Render nem o banco.
- Não crie, altere ou sincronize dados operacionais de produção durante testes.
- O ambiente usa o caminho-base `/MAPA-COSTALOG/` apenas no Vite com
  `--mode github-pages`. Builds do Vercel permanecem com `/`.

## Diagnóstico rápido

- **404** no Pages: verificar `Source = GitHub Actions` e o job `deploy`.
- **Página branca ou assets 404**: conferir o build `--mode github-pages`.
- **Falha de login, CORS ou Network Error**: validar a URL de homologação,
  configuração de `FRONTEND_ORIGINS` e disponibilidade do Render.
- **Deployment rejected by environment protection**: liberar a branch de
  homologação no ambiente `github-pages` do repositório.
