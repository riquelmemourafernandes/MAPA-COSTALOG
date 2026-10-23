# API do MAPA Costalog

Serviço inicial isolado do frontend. Conecta ao PostgreSQL via Prisma e oferece login individual, leitura paginada da grade e atualização de campos com auditoria.

## Autenticação e permissões
- POST /api/v1/auth/login autentica usuário e senha e devolve JWT válido por 8 horas.
- As demais rotas de /api/v1 exigem Authorization: Bearer <token>.
- Os usuários são verificados no banco a cada requisição protegida; usuários inativos perdem acesso.
- ADMIN, SUPERVISOR e OPERACAO podem editar registros; CONSULTA tem acesso de leitura.
- O cadastro público não existe. Criar o primeiro administrador pelo script controlado abaixo.
- Não registrar tokens, senhas ou hashes em logs. Em produção, usar HTTPS e um JWT_SECRET aleatório com pelo menos 32 caracteres.

## Variáveis de ambiente
- DATABASE_URL: conexão PostgreSQL usada pelo Prisma.
- JWT_SECRET: segredo de assinatura JWT (mínimo de 32 caracteres).
- FRONTEND_ORIGIN: origem exata do frontend autorizada pelo CORS.
- PORT: opcional; padrão 3001.
- ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD: somente para o script de criação do primeiro administrador; não são usados pela API após o bootstrap.
- NODE_ENV: definir production no servidor de produção.

## Executar localmente
Na pasta server:
1. npm install
2. Configurar variáveis de ambiente localmente; não versionar arquivo .env.
3. npm run prisma:generate
4. Aplicar a migração a partir da pasta server com: npx prisma migrate deploy --schema ../prisma/schema.prisma
5. Criar o administrador com: npm run bootstrap:admin
6. Cadastrar os metadados da grade com: npm run seed:columns
7. Iniciar com: npm run dev

A base PostgreSQL precisa existir antes de aplicar a migração. O script de administrador não altera contas existentes e exige senha de pelo menos 14 caracteres.

## Rotas nesta versão
- GET /api/v1/health — público; informa status e se DATABASE_URL foi configurada.
- POST /api/v1/auth/login — login com limite de tentativas.
- GET /api/v1/auth/me — usuário autenticado.
- GET /api/v1/config/columns — metadados visíveis da grade.
- GET /api/v1/mapa — pesquisa textual básica, filtro por status e paginação.
- PATCH /api/v1/mapa/:id — aceita apenas campos marcados como editáveis no cadastro de colunas, valida tipos básicos, detecta conflito de edição e registra auditoria com o usuário autor.
- POST /api/v1/imports/preview — ADMIN/SUPERVISOR; lê XLSX em memória, verifica a aba MAPA 1.0, calcula hash, mostra amostra e registra o resultado da prévia sem gravar as linhas operacionais.
- POST /api/v1/imports/:id/commit — somente ADMIN; exige reenviar exatamente o mesmo arquivo validado na prévia e grava linhas + auditoria em uma transação.

A importação aceita até 50 MB por requisição e atualmente importa somente a aba MAPA 1.0. A prévia e a confirmação são separadas; a confirmação exige perfil ADMIN e reenvio do mesmo arquivo validado. A validação inicial é estrutural; não equivale à homologação de todas as fórmulas, status ou regras de negócio. Faça primeiro em banco de homologação e backup.

## Limitações ainda abertas
A interface React possui integração inicial opcional com a API para login, leitura paginada e edição de alguns campos; não é ainda uma grade operacional completa. A API ainda não possui criação de registros, edição em lote, recuperação de senha, gestão de usuários por interface nem controle fino de permissões por campo. A validação da importação ainda precisa ser testada com cópia controlada do arquivo original e dados reais em ambiente isolado. Fórmulas sem resultado calculado e valores complexos são sinalizados para evitar importação silenciosamente incorreta. Antes de uso operacional, testar build, migração, permissões e carga em homologação.
