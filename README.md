# Meu Financeiro — controle pessoal

Aplicação estática em HTML, CSS e JavaScript puro, pensada primeiro para celulares. Os dados são guardados no `localStorage` do navegador. Não há conta, servidor, API paga, analytics ou envio de dados financeiros.

## Arquivos

- `index.html` — estrutura da aplicação.
- `styles.css` — interface responsiva e acessível.
- `finance.js` — cálculos, regras financeiras, datas, recorrência e validação de backup.
- `app.js` — interface, formulários, filtros, exportações e persistência local.
- `tests/finance.test.js` — testes automatizados do núcleo financeiro (Node.js, sem dependências externas).
- `tests/app-smoke.test.js` — teste de renderização das oito seções e abertura do formulário.
- `tests/storage-corruption.test.js` — confirma que dados locais inválidos não são sobrescritos silenciosamente.
- `sample.csv` — exemplo de CSV sem dados pessoais.
- `controle_financeiro_pessoal.xlsx` — planilha complementar, se estiver usando o pacote completo.

## Início rápido

1. Abra `index.html` no navegador ou publique a pasta pelo GitHub Pages.
2. A primeira abertura inicia em modo **Exemplo**, com valores fictícios identificados. No menu **Configurações e backup**, use **Limpar dados de exemplo** antes de registrar sua situação real.
3. Abra **Configurações e backup** e informe salário líquido mensal esperado, dia de recebimento, saldo bancário real (se quiser), número de meses essenciais para a reserva e categorias.
4. Em **Contas e vencimentos**, cadastre cada conta fixa uma vez. Ao marcar uma conta como paga, não lance o mesmo pagamento novamente como despesa em Movimentações.
5. Use **Adicionar gasto** para despesas avulsas e **Movimentações** para receitas planejadas/recebidas, gastos e transferências para objetivos/reserva.
6. Em **Orçamento**, estabeleça limites. Em **Objetivos** e **Reserva de emergência**, cadastre metas e registre todos os aportes/retiradas.
7. Exporte backup JSON com frequência em **Configurações e backup**. O backup contém seus dados financeiros; guarde-o em lugar privado.

## Regras financeiras usadas

- **Renda projetada:** salário esperado nas configurações, salvo quando há um lançamento da categoria `Salário` no mês; nesse caso o valor registrado para o salário substitui a previsão daquele mês. Outras receitas planejadas ou recebidas entram na projeção.
- **Renda recebida:** soma somente receitas marcadas como recebidas.
- **Despesas pagas:** soma despesas avulsas pagas e contas recorrentes marcadas como pagas.
- **Compromissos:** despesas pagas + despesas avulsas planejadas + contas pendentes. Contas pagas não permanecem na parcela pendente.
- **Objetivos e reserva:** aportes diminuem o dinheiro livre e aumentam o saldo reservado; retiradas têm o efeito inverso. Não são despesas de consumo.
- **Dinheiro livre estimado:** renda projetada menos compromissos e aportes líquidos. Pode ficar negativo e não equivale ao saldo bancário real.
- **Saldo bancário real:** valor opcional, informado manualmente, que não é inferido pelo histórico.
- **Recorrência:** cada modelo gera uma ocorrência por mês visualizado, identificada por modelo + mês. O sistema não marca uma ocorrência como paga automaticamente.

## Publicar no GitHub Pages

1. Entre em [GitHub](https://github.com/) e crie um repositório novo, por exemplo `meu-financeiro`.
2. Envie para a raiz do repositório os arquivos do site: `index.html`, `styles.css`, `finance.js`, `app.js` e, se desejar, `README.md`, a pasta `tests` e o `sample.csv`. Não é necessário publicar a planilha. **Nunca envie backups JSON nem a planilha depois de preenchê-los com seus dados financeiros reais.**
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch principal (normalmente `main`) e a pasta `/ (root)`, depois salve.
6. Aguarde o GitHub Pages publicar o site e abra a URL mostrada na própria página de configurações. Para um repositório comum, a URL costuma seguir `https://SEU-USUARIO.github.io/meu-financeiro/`.
7. Abra a URL no celular e adicione aos favoritos. Se alterar o código depois, envie os arquivos atualizados para a mesma branch.

A aplicação usa caminhos relativos, então funciona tanto no domínio principal quanto em um subcaminho de repositório. Não foi implementada como PWA instalável; use o navegador/favorito.

## Privacidade, backup e limites

- Os dados ficam no armazenamento local de cada navegador e perfil. Não sincronizam automaticamente entre celular e computador.
- Limpar os dados do site, usar navegação privada ou trocar de navegador/perfil pode apagar ou tornar os dados inacessíveis.
- Exporte JSON para backup e restaure somente um arquivo de origem conhecida. A restauração substitui o conjunto atual, depois de validação e confirmação.
- O CSV exporta movimentações e ocorrências de contas. É voltado a planilhas e usa `;` como separador, com BOM UTF-8.
- O site não é um extrato bancário e não acessa contas bancárias. Insights são cálculos descritivos dos dados informados, não aconselhamento de investimento.

## Testes

Com Node.js instalado, na pasta do projeto execute:

```bash
node --check finance.js
node --check app.js
node tests/finance.test.js
node tests/app-smoke.test.js
node tests/storage-corruption.test.js
```

O relatório com os resultados e as limitações está em `TESTES.md`. Testes visuais em navegadores e celulares reais ainda precisam ser feitos no dispositivo do usuário.
