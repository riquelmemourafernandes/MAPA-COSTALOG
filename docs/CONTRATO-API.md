# Contrato inicial da API

Prefixo planejado: /api/v1. Todas as rotas de dados devem exigir sessão/token válido. O frontend não deve acessar o PostgreSQL diretamente.

## Saúde e configuração
- GET /api/v1/health — estado da API, sem segredos ou strings de conexão.
- GET /api/v1/config/columns — metadados e ordem das colunas liberadas ao usuário.

## Registros MAPA
- GET /api/v1/mapa?search=&status=&page=1&pageSize=100&sortBy=&sortDir=asc — retorna registros paginados, total e colunas.
- GET /api/v1/mapa/:id — detalhe de uma linha.
- POST /api/v1/mapa — criar linha com validação no servidor.
- PATCH /api/v1/mapa/:id — atualizar campos permitidos. Exigir versão esperada ou updatedAt para detectar edição concorrente.
- POST /api/v1/mapa/bulk-update — atualização em lote com validação individual e relatório por linha.
- GET /api/v1/mapa/:id/history — histórico de alterações conforme permissão.

## Importação
- POST /api/v1/imports/preview — receber XLSX e retornar prévia, mapeamento, totais e erros sem gravar registros operacionais.
- POST /api/v1/imports/:id/commit — efetivar prévia aprovada; idempotência e autorização obrigatórias.
- GET /api/v1/imports/:id — consultar andamento e relatório.

## Cadastros e regras
- GET /api/v1/lookups/:listName?search= — sugestões normalizadas, sem distinção entre maiúsculas/minúsculas.
- POST /api/v1/lookups/:listName e PATCH /api/v1/lookups/:id — apenas perfis autorizados.
- GET /api/v1/formula-rules — listar regras e estado de homologação.
- Alterar ou ativar regras é restrito a administradores e deve manter versão e casos de teste.

## Respostas e segurança
Listagens devem retornar items, page, pageSize e total. Erros devem retornar código estável, mensagem compreensível e detalhes de validação sem stack trace. Definir limites para lote e upload, validar conteúdo do XLSX, e registrar ações relevantes na auditoria.
