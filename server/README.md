# API do MAPA Costalog

API do sistema web substituto da planilha. Os registros operacionais vivem no PostgreSQL; a planilha original serve como referência para estrutura de colunas e regras, não como arquivo a ser reenviado no uso diário.

## Autenticação e permissões
- POST /api/v1/auth/login autentica usuário e senha e devolve JWT válido por 8 horas.
- As demais rotas de /api/v1 exigem Authorization: Bearer <token>.
- Usuários inativos perdem acesso; ADMIN, SUPERVISOR e OPERACAO podem editar; CONSULTA tem acesso de leitura.
- Não existe cadastro público. Criar o administrador inicial pelo script controlado.

## Variáveis de ambiente
- DATABASE_URL: conexão PostgreSQL.
- JWT_SECRET: segredo JWT com pelo menos 32 caracteres.
- FRONTEND_ORIGIN: origem exata do frontend autorizada pelo CORS.
- PORT: opcional; padrão 3001.
- ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD: usados apenas no bootstrap do primeiro administrador.
- NODE_ENV: definir production no servidor de produção.

## Executar localmente
1. Na pasta server, execute `npm install`.
2. Configure as variáveis de ambiente localmente; não versione .env.
3. Execute `npm run prisma:generate`.
4. Aplique a migração: `npx prisma migrate deploy --schema ../prisma/schema.prisma`.
5. Crie o administrador com `npm run bootstrap:admin`.
6. Cadastre as 128 colunas com `npm run seed:columns`.
7. Inicie com `npm run dev`.

## Rotas
- GET /api/v1/health — status da API.
- POST /api/v1/auth/login — login com limite de tentativas.
- GET /api/v1/auth/me — usuário autenticado.
- GET /api/v1/config/columns — metadados da grade.
- GET /api/v1/mapa — pesquisa textual, filtro por status e paginação.
- PATCH /api/v1/mapa/:id — atualização dos campos permitidos, detecção de conflito e auditoria.

## Pendências antes da operação
A interface dinâmica usa a estrutura completa de colunas e deixa cada usuário selecionar as que quer ver. Ainda é necessário configurar o banco, cadastrar os registros operacionais iniciais, testar compilação e permissões, e migrar/homologar fórmulas e regras da planilha. A edição em lote, criação de linhas pela interface e gestão de preferências sincronizada entre dispositivos ainda não estão implementadas.
