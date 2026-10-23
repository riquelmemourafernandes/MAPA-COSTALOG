# MAPA Costalog — sistema substituto da planilha

Projeto para migrar gradualmente a operação da aba MAPA 1.0 para uma aplicação web própria.

## Estado atual
- Interface inicial React + TypeScript + Vite.
- Modelo inicial de dados PostgreSQL em `prisma/schema.prisma`.
- Plano de migração e segurança em `docs/PLANO-MIGRACAO.md`.
- Contrato inicial das rotas em `docs/CONTRATO-API.md`.
- Catálogo preliminar de regras em `docs/REGRAS-PLANILHA.md`.
- Dicionário sanitizado de colunas em `docs/dicionario-colunas.csv`.

**Ainda não está pronto para uso operacional.** Sem `VITE_API_URL`, a interface mostra somente registros fictícios; com essa variável, há integração inicial para login, leitura paginada e edição individual de alguns campos com auditoria. A API e a importação XLSX com prévia estão em desenvolvimento; o banco de produção/homologação ainda não está configurado, as regras completas não foram migradas e a homologação ainda está pendente.

## Stack planejada e arquivos
- Frontend: React + TypeScript + Vite.
- API inicial: Node.js + TypeScript + Express em `server/`.
- Persistência: PostgreSQL + Prisma, com schema em `prisma/schema.prisma` e migração inicial em `prisma/migrations/`.
- Histórico: tabela de auditoria no servidor.
- Documentação da migração e regras: `docs/`.
- API inicial: autenticação individual por JWT, permissões por perfil, leitura paginada, edição com auditoria e importação XLSX com prévia protegida.
- Próxima evolução: validar build e importação, configurar banco de homologação, ligar a grade à API e testar as regras da planilha.

## Executar a interface atual
```bash
npm install
npm run dev
```

## Segurança
Não adicionar a planilha operacional, exportações com dados reais, senhas, tokens ou chaves ao repositório. Usar variáveis de ambiente no servidor. A migração deve ser validada com cópia controlada e backup antes de qualquer carga operacional.

## Próximas etapas
1. Validar o dicionário de colunas e regras de negócio.
2. Configurar PostgreSQL e gerar/aplicar migrações Prisma.
3. Concluir os testes automatizados de compilação e validação da API.
4. Configurar PostgreSQL de homologação e executar migração + cadastro inicial de colunas/administrador.
5. Testar a importação XLSX com cópia controlada, incluindo duplicidade e arquivo inválido.
6. Completar a grade operacional (edição em lote, criação de registros, paginação e exportação) e validar edição persistente com auditoria.
7. Comparar resultados e regras com a planilha antes de liberar para a equipe.
