# MAPA Costalog — sistema substituto da planilha

Projeto para migrar gradualmente a operação da aba MAPA 1.0 para uma aplicação web própria.

## Estado atual
- Interface inicial React + TypeScript + Vite.
- Modelo inicial de dados PostgreSQL em `prisma/schema.prisma`.
- Plano de migração e segurança em `docs/PLANO-MIGRACAO.md`.
- Contrato inicial das rotas em `docs/CONTRATO-API.md`.
- Catálogo preliminar de regras em `docs/REGRAS-PLANILHA.md`.
- Dicionário sanitizado de colunas em `docs/dicionario-colunas.csv`.

**Ainda não está pronto para uso operacional.** A interface existente usa registros fictícios, e a API, autenticação, banco conectado e importação real ainda precisam ser implementados e testados.

## Stack planejada
- Frontend: React + TypeScript + Vite.
- API: Node.js + TypeScript.
- Persistência: PostgreSQL + Prisma.
- Histórico: auditoria no servidor.
- Próxima evolução: grade virtualizada, importação com prévia e colaboração.

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
3. Implementar API autenticada, permissões e auditoria.
4. Implementar importação XLSX com prévia, validação e idempotência.
5. Conectar a grade à API e habilitar edição persistente.
6. Comparar resultados com a planilha antes de liberar para a equipe.
