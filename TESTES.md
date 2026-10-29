# Relatório de testes — Meu Financeiro

## Executados neste ambiente

- **Sintaxe JavaScript:** `node --check finance.js` e `node --check app.js` — aprovados.
- **Núcleo financeiro:** `node tests/finance.test.js` — 10/10 testes aprovados.
- **Renderização e navegação simuladas:** `node tests/app-smoke.test.js` — aprovados. O teste passa pelas oito seções, confere que cada uma produz conteúdo, verifica os textos do painel/relatórios/configurações e abre o formulário de movimentação em um harness DOM simplificado.
- **Armazenamento local inválido:** `node tests/storage-corruption.test.js` — aprovado. Conteúdo inválido já presente no armazenamento local não é sobrescrito silenciosamente; a tela exibe uma mensagem de aviso.
- **Contas recorrentes:** testadas a criação sem duplicação, a virada de mês com vencimento no último dia disponível e a exclusão persistente de uma ocorrência cancelada.
- **Regras financeiras:** testadas renda prevista/recebida, contas pagas e pendentes, despesas planejadas, alocações para objetivo/reserva, orçamento negativo, mês sem lançamentos, metas alcançadas/inviáveis e recálculo após editar/excluir movimentação.
- **Planilha:** foram inspecionadas as nove abas e os resultados calculados do painel. No cenário de demonstração, os valores apurados incluem renda projetada de R$ 3.200,00, despesas pagas de R$ 1.205,00, contas pendentes de R$ 210,00, compromissos de R$ 1.415,00, aportes líquidos de R$ 350,00 e dinheiro livre projetado de R$ 1.435,00. A busca na grade do workbook não encontrou `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` nem `#N/A`.
- **Arquivos do pacote:** o ZIP foi verificado com `unzip -t`; o conteúdo pode ser extraído sem erro.

## Não executados / limitações

- **Navegador visual real e telas físicas:** não foi possível concluir a captura automatizada em Chromium headless neste ambiente, que também não abriu a página de teste `about:blank`. Portanto, o resultado do harness DOM não equivale a um teste visual completo. Recomenda-se abrir o `index.html` ou o site publicado no Chrome/Firefox do celular e do computador.
- **Excel e Google Sheets reais:** as fórmulas e os valores foram inspecionados pelo mecanismo de planilha disponível no ambiente, mas não foi feita uma abertura manual em instalações reais do Excel nem do Google Sheets. A aparência final de gráficos, validações e formatos deve ser conferida após importar o `.xlsx` na aplicação escolhida.
- **Persistência real entre sessões e exportações via navegador:** o código foi revisado e o estado inicial foi testado no harness; baixar/restaurar arquivos e reabrir a aplicação em um navegador real ainda deve ser conferido pelo usuário. Os testes automatizados não simulam completamente os diálogos nativos de arquivo do Android.
- **Publicação:** nenhum repositório foi criado nem publicado em uma conta GitHub. O projeto está pronto para o usuário enviar ao próprio repositório e ativar GitHub Pages.

## Como repetir os testes

Execute na raiz do projeto com Node.js instalado:

```bash
node --check finance.js
node --check app.js
node tests/finance.test.js
node tests/app-smoke.test.js
node tests/storage-corruption.test.js
```
