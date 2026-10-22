# MAPA Costalog — sistema substituto da planilha

Projeto inicial para migrar a operação centralizada na aba **MAPA 1.0** para uma aplicação web própria.

## Estado atual
Este é um esqueleto inicial de interface, não uma migração concluída. Não importa dados reais automaticamente e não deve ser usado em produção até a implementação e validação do backend.

## Stack proposta
- React + TypeScript + Vite (interface)
- API Node.js + TypeScript
- PostgreSQL para dados transacionais
- WebSockets para atualizações simultâneas
- Histórico/auditoria de alterações no backend

## Começar a interface
```bash
npm install
npm run dev
```

## Próximas etapas
1. Confirmar dicionário de colunas e regras do MAPA 1.0.
2. Modelar tabelas e importador de XLSX com validação e prévia.
3. Criar API autenticada e migrações PostgreSQL.
4. Implementar edição em grade, colagem em massa, filtros e ordenação.
5. Implementar histórico, permissões e colaboração.
6. Testar cálculos comparando os resultados com a planilha original.
7. Configurar hospedagem e variáveis de ambiente.

## Segurança
Nunca coloque senhas, tokens ou credenciais no frontend ou neste repositório. Use variáveis de ambiente no servidor.