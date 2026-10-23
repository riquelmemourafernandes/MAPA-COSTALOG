# MAPA Costalog — plano de migração

## Princípio
A aplicação deve substituir gradualmente a planilha, sem presumir que fórmulas exportadas do Google Sheets funcionem fora dele. O arquivo original é referência de regras e validação; não é uma fonte a ser publicada no GitHub.

## Etapas de implementação
1. **Estrutura e segurança:** separar interface, API e banco PostgreSQL; manter segredos apenas no servidor; usar perfis ADMIN, SUPERVISOR, OPERACAO e CONSULTA; auditar alterações no servidor.
2. **Dicionário de colunas:** cadastrar ordem, nome, tipo, obrigatoriedade e possibilidade de edição. Preservar chaves originais como referência. Normalizar datas, horas, números, placas, containers e status sem perder valores originais durante a validação.
3. **Dados operacionais:** manter a grade e os registros no banco de dados da aplicação; não exigir envio recorrente do Excel para trabalhar. Planejar uma carga inicial controlada dos registros existentes, preservando as colunas originais.
4. **Regras de negócio:** reescrever fórmulas relevantes em funções testáveis no backend. Para cada regra, registrar entradas e saídas esperadas. Manter a regra desabilitada até passar nos testes.
5. **Grade operacional:** edição por célula e em lote, colagem tabular, filtros, ordenação e paginação/virtualização. Validar no cliente e no servidor. Detectar conflitos de edição concorrente.
6. **Auditoria e cadastros:** registrar usuário, data, campo, valor anterior e novo. Definir origem e normalização para clientes, terminais, cidades, status, placas e motoristas.
7. **Homologação:** comparar totais, status e cálculos contra cópia controlada da planilha. Testar carga inicial controlada, linhas incompletas, datas, valores vazios e fórmulas com erro. Liberar uso operacional apenas após aprovação.

## Observações estruturais
- A pasta contém 39 abas, incluindo abas ocultas e auxiliares.
- MAPA 1.0 é a base operacional principal e possui cabeçalhos de A até DX.
- STATUS 1.0, CONTROLE BAIXA, Página166, IMPORT MATRIZ e abas de relatórios possuem muitas fórmulas e referências cruzadas.
- Existem funções específicas do Google Sheets, como IMPORTRANGE e QUERY, além de fórmulas exportadas como DUMMYFUNCTION. Elas precisam ser substituídas por integrações ou regras próprias.
- A função personalizada VALIDAR_CONTAINER foi identificada no arquivo, mas o código Apps Script não está contido no XLSX. A automação original ainda não está totalmente documentada.
- A planilha contém dados operacionais e possivelmente dados pessoais. Não adicionar o XLSX real, exportações ou credenciais ao repositório.

## Modelo inicial
MapaRow.data guarda o mapa de valores da linha durante a transição, permitindo preservar dezenas de colunas enquanto o modelo é refinado. Campos usados em buscas frequentes são indexados. MapaColumn descreve a grade; LookupValue guarda listas normalizadas; AuditLog registra alterações; FormulaRule versiona regras e casos de teste.

Esse modelo é uma fundação inicial, não significa que todas as regras da planilha já foram migradas.
