# MAPA Costalog — modo público de demonstração no GitHub Pages

## Endereço público

https://riquelmemourafernandes.github.io/MAPA-COSTALOG/

O GitHub Actions compila e publica o frontend estático a partir da branch
`feat/roadmap-phase1-filters`. A publicação não precisa de Render, Vercel,
Supabase, API remota nem banco de dados externo.

## O que funciona neste modo

- Grade de 72 colunas baseada no cabeçalho MAPA 1.0, com linhas fictícias.
- Editar célula com duplo clique, Enter ou F2.
- Selecionar células, linhas e colunas; usar o menu de contexto com botão direito.
- Copiar e colar intervalos tabulados do Excel/Sheets; Delete limpa a seleção.
- Inserir e excluir linhas e colunas.
- Pesquisar, filtrar por status e ordenar colunas.
- Desfazer/refazer alterações recentes.
- Importar CSV/TSV e exportar um CSV.
- Salvar automaticamente no armazenamento local do navegador (`localStorage`).

## Limitações importantes

Este é um modo de demonstração **sem autenticação e sem segurança de acesso**.
Não há login real nem perfis protegidos; qualquer pessoa que abra o link pode
usar as ferramentas de demonstração. Não coloque senhas, dados pessoais,
clientes reais, dados operacionais ou informações confidenciais nele.

Os registros são exemplos fictícios. As alterações ficam somente no navegador
e perfil em que foram feitas; não são compartilhadas com outras pessoas nem
sincronizadas entre dispositivos. Limpar os dados do navegador pode apagá-las.
Use **Exportar CSV** para guardar uma cópia local dos seus testes.

Sem API e banco de dados, estas funções não estão disponíveis como operações
reais compartilhadas:

- Login seguro, gestão de usuários e permissões de administrador.
- Banco de dados central, sincronização multiusuário e auditoria centralizada.
- Painéis operacionais, histórico remoto, alertas e notificações.
- Cadastros compartilhados e persistência entre dispositivos.

A interface não finge que essas funções estão ativas. A faixa de aviso no site
explica que se trata de uma demonstração local.

## Publicação

1. O repositório deve ter **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Em **Actions**, abra `MAPA Costalog - GitHub Pages (demonstração local)`.
3. Aguarde o build e o deploy terminarem com sucesso.
4. O caminho-base `/MAPA-COSTALOG/` é configurado apenas pelo modo de build
   `github-pages`.

## Futuro servidor próprio

O código da aplicação conectada permanece no repositório para uma etapa futura
de hospedagem própria. Para trabalhar com dados reais, será necessário escolher
e executar uma API e um banco de dados sob seu controle. O GitHub Pages sozinho
não executa backend nem fornece armazenamento compartilhado; por isso, esta
versão pública não tenta simular um login seguro.
