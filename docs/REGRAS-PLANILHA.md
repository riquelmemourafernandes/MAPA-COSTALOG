# Catálogo inicial de regras e dependências

Este catálogo registra o que precisa ser reimplementado e homologado. Nenhuma regra calculada deve ser ativada automaticamente apenas porque existe uma fórmula no XLSX.

| Coluna | Regra observada | Dependência | Tratamento proposto |
|---|---|---|---|
| H — DEM | Se AX estiver vazio, retorna AG; caso contrário, converte AX em data e soma 2 dias | AX — SAÍDA DO CLIENTE | Implementar função de data no backend, validar horários/textos e confirmar regra de dias corridos versus úteis |
| K — ID PROG. | Busca o identificador da programação | BASE EXPORT | Importar cadastro de referência e definir comportamento para chave não encontrada |
| N — REFERENCIA | Há ocorrência de fórmula/referência | Referência de outra célula | Inspecionar casos reais antes de definir regra |
| P — NAVIO | Há ocorrência de fórmula | Referência de outra célula | Inspecionar casos reais antes de definir regra |
| Q — VALORES | Coluna contém expressões de cálculo em algumas linhas | Valores de origem e fórmulas variáveis | Mapear padrões por tipo de operação; não presumir uma única fórmula |
| R — QTD | Coluna contém expressões de cálculo em algumas linhas | Valores de origem | Mapear padrões por tipo de operação |
| S — PESO | Coluna contém expressões de cálculo em algumas linhas | Valores de origem | Mapear padrões por tipo de operação e unidade |
| AG — CATEGORIA | Busca categoria por placa e possui fallback para terceiro | BASE PLACAS e valor de W/X | Criar regra determinística com cadastro de veículos e teste para placas ausentes |
| AO — KM | Busca quilometragem por cidade/base auxiliar | BASE e cidade(s) | Definir cidades de origem/destino, prioridade e unidade; não substituir silenciosamente por geocodificação aproximada |
| BG — P.S. | Busca informação de referência | IMPORT MATRIZ | Identificar chave de relacionamento e casos de duplicidade |
| BU — VALIDAÇÃO CONTAINER | Fórmula personalizada/validação | Regra personalizada VALIDAR_CONTAINER | Recuperar a lógica original ou documentar casos de teste com Operações antes de substituir |

## Pontos que precisam de decisão operacional

- Existem duas colunas chamadas STATUS (C e AY). A aplicação deve identificá-las por chave interna distinta, sem depender apenas do texto do cabeçalho.
- Existem colunas sem cabeçalho visível no trecho do dicionário. Não devem aparecer como colunas utilizáveis até confirmar se são espaçadores, campos auxiliares ou conteúdo fora do recorte.
- Funções do Google Sheets, referências IMPORTRANGE/QUERY e fórmulas DUMMYFUNCTION não podem ser executadas diretamente no backend Node/PostgreSQL.
- Valores de exemplo presentes em fórmulas do arquivo original não foram copiados para este catálogo.
- A planilha pode conter scripts, gatilhos ou validações que não são armazenados no próprio XLSX. O catálogo será atualizado quando essas regras forem confirmadas.
