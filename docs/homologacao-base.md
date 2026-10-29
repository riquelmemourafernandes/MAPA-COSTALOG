# Homologação da BASE do MAPA-COSTALOG (sem alterar produção)

## Diagnóstico confirmado
A prévia Vercel da branch `feat/roadmap-phase1-filters` tem a tela Cadastros, mas o `vercel.json` atual encaminha `/api/*` à API de produção `mapa-costalog-api.onrender.com`. O backend `main` não contém `GET /api/v1/base/catalog`; a branch de desenvolvimento contém. Uma resposta 404 para essa rota é, portanto, uma incompatibilidade de versões e **não significa que a BASE está vazia**.

## Passos para ativar a BASE de verdade em HOMOLOGAÇÃO
1. No Render, crie **outro** Web Service chamado, por exemplo, `mapa-costalog-api-homologacao`, conectado ao repositório `riquelmemourafernandes/MAPA-COSTALOG` na branch `feat/roadmap-phase1-filters`. Não altere o serviço `mapa-costalog-api` existente.
2. Use o mesmo diretório raiz do repositório e os comandos de build/start definidos em `render.yaml`: `cd server && npm install --include=dev && npm run prisma:generate && npm run build`; `cd server && npm start`.
3. Configure `NODE_ENV=production`, `JWT_SECRET` forte com pelo menos 32 caracteres, `DATABASE_URL` de **um banco de testes separado** e `FRONTEND_ORIGIN` com o endereço exato da prévia Vercel. **Nunca reutilize o DATABASE_URL da operação** sem uma decisão explícita.
4. Inicie o esquema Prisma desse banco separado pelo procedimento de provisionamento do projeto, sem executar migrações contra a produção. Crie um usuário administrador fictício/de homologação pelos mecanismos existentes; não reutilize a senha de usuários reais.
5. Confira no serviço novo `GET /api/v1/health`; depois, com sessão de homologação, confira `GET /api/v1/base/catalog?listName=ATENDENTE`. O esperado é HTTP 200 e JSON `{"items":[]}` quando a BASE ainda não tem itens.
6. No **Vercel**, configure a variável de ambiente `VITE_HOMOLOG_API_URL` **somente no ambiente Preview** para a URL HTTPS desse serviço de homologação (sem barra final). Faça redeploy da prévia. A interface usa essa variável apenas se ela estiver presente; sem ela continua usando a rota existente.
7. Na prévia, abra **Cadastros > BASE**, inclua um atendente fictício. Confirme que aparece na coluna B do MAPA de homologação. Teste editar, inativar, reativar e os menus de clientes, terminais e status. Não use linhas operacionais reais.

## Modo provisório no frontend
Enquanto a rota estiver ausente ou devolver uma página HTML inesperada, a prévia exibe um **protótipo local identificado**: inclusão, edição e inativação funcionam como simulação, sem gravar no servidor e sem alimentar menus reais. Ao conectar a API de homologação, a tela volta automaticamente à BASE persistente; há também um botão para verificar novamente.

## Proteções
- Somente ADMIN e SUPERVISOR podem manter a BASE.
- Inativação é lógica e preserva históricos do MAPA.
- Duplicidades são recusadas pela API e pela chave única `listName+normalized`.
- Nenhum passo deste guia modifica o Render, o Supabase ou o Vercel automaticamente.
