# MAPA Costalog — aplicação web operacional

O objetivo é substituir o uso diário da planilha por uma aplicação web conectada a um banco de dados próprio. O Excel enviado é a referência estrutural e funcional para construir a grade; a equipe trabalha no sistema, não enviando a planilha repetidamente.

## Direção funcional
- Grade MAPA 1.0 baseada nas 128 colunas originais, de A até DX, mantendo chaves Excel para diferenciar cabeçalhos repetidos.
- Cada usuário pode escolher quais colunas visualizar; a seleção fica salva no navegador por usuário.
- Busca, filtro por status, paginação, edição individual de campos editáveis e auditoria de alterações.
- Nenhum dado fictício é exibido como se fosse operacional.
- A estrutura de dados usa JSON por linha para preservar todas as colunas sem limitar o sistema aos campos principais.

## Estado atual e limites
A interface dinâmica e a seleção de colunas foram implementadas no frontend; os metadados das 128 colunas são cadastrados por `server/src/seed-columns.ts`. O sistema ainda depende de configurar o PostgreSQL e cadastrar/carregar os registros operacionais iniciais no banco. Fórmulas, automações e regras específicas do Google Sheets (incluindo IMPORTRANGE, QUERY e VALIDAR_CONTAINER) ainda precisam ser reproduzidas e homologadas antes do uso operacional.

## Stack
- Frontend: React + TypeScript + Vite.
- API: Node.js + TypeScript + Express.
- Persistência: PostgreSQL + Prisma.
- Acesso: login individual, perfis de usuário e histórico de alterações.

## Executar interface
`npm install` e `npm run dev`. Configure `VITE_API_URL` para apontar à API. Sem API configurada, a aplicação não mostra dados de demonstração.

## Segurança
Não adicionar o arquivo Excel operacional, exportações com dados reais, senhas, tokens ou chaves ao repositório. Configure segredos por variáveis de ambiente. Antes de liberar, validar permissões, regras operacionais e consistência dos dados.
