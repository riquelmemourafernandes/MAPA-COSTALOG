# API do MAPA Costalog

Serviço inicial isolado do frontend. Ele conecta ao PostgreSQL via Prisma e oferece saúde, leitura paginada da grade e atualização de campos com auditoria.

## Limitação importante de autenticação
Nesta fase, as rotas de dados usam um token Bearer compartilhado via MAPA_API_TOKEN como proteção temporária. Isso não substitui autenticação individual, gestão de sessão ou autorização por usuário. Antes de uso operacional, implementar login individual, perfis e associação do autor às alterações. Não expor o token no frontend público nem embuti-lo no bundle Vite.

## Variáveis de ambiente
- DATABASE_URL: conexão PostgreSQL usada pelo Prisma.
- MAPA_API_TOKEN: token forte e aleatório, somente no servidor.
- FRONTEND_ORIGIN: origem exata autorizada do frontend, por exemplo a URL de homologação.
- PORT: opcional; padrão 3001.
- NODE_ENV: definir production no servidor de produção.

## Executar localmente
Na pasta server:
1. npm install
2. Configurar as variáveis de ambiente no ambiente local (não versionar .env).
3. npm run prisma:generate
4. npm run dev

O schema Prisma fica na pasta prisma, um nível acima. O banco precisa existir e receber as migrações antes de usar as rotas de dados.

## Rotas nesta versão
- GET /api/v1/health — público; informa apenas status e se DATABASE_URL foi configurada.
- GET /api/v1/config/columns — protegido.
- GET /api/v1/mapa — protegido; filtros básicos e paginação.
- PATCH /api/v1/mapa/:id — protegido; aceita apenas campos marcados como editáveis no cadastro de colunas, detecta conflito de edição e registra auditoria.

A API não importa o XLSX e não preenche as colunas de configuração automaticamente. A importação e o login individual serão implementados depois de validar o modelo e as regras.
