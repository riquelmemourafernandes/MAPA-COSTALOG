# Regras e escopo de migração — MAPA COSTALOG

## Escopo autorizado

A aplicação substitui o uso diário da aba **MAPA 1.0**. A planilha original é referência para identificar estrutura e regras; não existe fluxo de importação recorrente da planilha.

Somente estas abas podem ser consultadas como referência:
- **MAPA 1.0** — estrutura operacional principal e fórmulas existentes.
- **BASE** — tabela de referência usada por funções da MAPA 1.0.
- **BASE PLACAS** — descrição/classificação de placas.

Todas as demais abas estão fora do escopo e não devem ser usadas para reconstruir regras ou fornecer dados à aplicação. Não colocar dados operacionais reais ou a planilha original no repositório.

## Fórmulas e dependências observadas

| Coluna | Cabeçalho observado | Comportamento encontrado | Situação da migração |
|---|---|---|---|
| H | DEM | Calcula a data a partir de AX, com ajuste de dois dias; há tratamento para data vazia/valor de data | Regra identificada, ainda precisa de testes com casos reais autorizados |
| AG | (classificação de placa) | Consulta a placa em W na aba BASE PLACAS; usa TERCEIRO quando não encontra correspondência | Pode ser reproduzida usando somente BASE PLACAS, após confirmar cabeçalho e exceções |
| AO | (KM de entrega) | Consulta AN na faixa F:G da aba BASE | Pode ser reproduzida usando somente BASE, após confirmar semântica e tratamento de duplicidades |
| K | 489 | Consulta VLOOKUP em BASE EXPORT | **Bloqueada:** depende de aba fora do escopo permitido |
| BG | 540 | Consulta VLOOKUP em IMPORT MATRIZ | **Bloqueada:** depende de aba fora do escopo permitido |
| BU | VALIDAÇÃO CONTAINER | Chama função personalizada VALIDAR_CONTAINER(T) | **Pendente:** implementação original da função ainda não foi encontrada; não inventar comportamento |

As fórmulas e cabeçalhos devem ser confirmados antes de habilitar cálculos equivalentes em produção. Os números acima representam contagens observadas na planilha de referência, não registros que devam ser importados.

## Proteção de edição

O cadastro de metadados atual bloqueia uma coluna inteira quando ela contém pelo menos uma fórmula. Isso é uma proteção temporária contra sobrescrita de valores calculados, mas pode impedir edição em colunas mistas, nas quais algumas linhas contêm fórmulas e outras têm valores manuais. Não desbloquear essas colunas em lote: a proteção correta exige identificar a célula/linha calculada ou implementar o cálculo no servidor e homologar o resultado.

## Próximos passos antes do uso operacional

1. Confirmar os cabeçalhos completos das colunas H, AG e AO e as regras de exceção.
2. Recuperar a definição original de VALIDAR_CONTAINER e montar testes de aceitação.
3. Definir o tratamento para K e BG sem consultar abas fora do escopo.
4. Implementar cálculos apenas depois de testes com exemplos autorizados, sem copiar dados reais para o repositório.
5. Provisionar banco, usuários e dados operacionais por procedimento controlado antes de declarar a aplicação pronta para uso.

## Critério de segurança

Não exibir dados fictícios como se fossem operacionais, não presumir que a ausência de uma correspondência significa um resultado válido e não afirmar equivalência com a planilha enquanto houver dependências ou funções personalizadas pendentes.
