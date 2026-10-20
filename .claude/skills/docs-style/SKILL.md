---
name: docs-style
description: Convenção de escrita pra documentação do akari-portal (docs/ARQUITETURA_DO_SISTEMA.md, docs/OBJETIVO_DO_SISTEMA.md, README.md e comentários de código) — documenta só o estado atual, nunca a jornada de como chegamos lá. Trigger sempre que for criar/editar um README.md ou um dos docs/*.md do portal (ARQUITETURA_DO_SISTEMA.md, OBJETIVO_DO_SISTEMA.md), ou escrever um comentário explicando uma decisão no código, seja numa revisão de documentação, seja de passagem ao implementar uma feature ou corrigir um bug. Cobre o que cortar (histórico, alternativas rejeitadas, "antes era X") vs. o que manter (marcas de Aceito/Backlog real/Confirmado, as respostas do mantenedor, a razão não-óbvia do desenho atual).
---

# docs-style

Documentação do akari-portal (`docs/ARQUITETURA_DO_SISTEMA.md`, `docs/OBJETIVO_DO_SISTEMA.md`,
os `README.md` da raiz e de cada área, e comentários no código) descreve **o estado atual do
portal**, nunca o processo de como esse estado foi alcançado. Isso
vale toda vez que um documento ou comentário é escrito — numa revisão da documentação ou de
passagem, ao implementar algo e atualizar a doc da área afetada.

O portal é o cliente do backend `akari` (`../akari`): quando um comportamento é definido pelo
contrato (`openapi.yaml`) ou pelo backend, a documentação do portal aponta pra lá em vez de
redescrever a regra — o que o portal documenta é como a tela usa aquilo.

## Onde cada coisa fica

- `docs/OBJETIVO_DO_SISTEMA.md` — o porquê: propósito, problemas, fluxos, atores, funcionalidades,
  visão de produto e contexto operacional. Sem detalhe de código.
- `docs/ARQUITETURA_DO_SISTEMA.md` — o como, no nível do projeto inteiro: camadas, padrões, regras,
  fluxo entre as camadas, dependências críticas, riscos e diretrizes.
- `README.md` da raiz — como rodar, scripts, estrutura e um resumo que aponta para os dois `docs/`.
- `README.md` de cada área — o detalhe daquela pasta. Uma decisão que vale para o projeto inteiro
  (ex.: a política de regras de negócio no cliente) mora em `ARQUITETURA_DO_SISTEMA.md`, e os
  READMEs das áreas só referenciam.

Não repita o mesmo texto em dois lugares: escreva no lugar certo e linke dos outros.

## O teste

Antes de escrever uma frase sobre decisão/mudança, pergunte: **isso ajuda alguém a evoluir o
portal no futuro?**

- Se a frase é sobre a *jornada* (onde um componente morava antes, que alternativa foi
  considerada e rejeitada, "o filtro era feito no cliente e passou pro backend", "o contrato
  chamava isso de cancelCacheDownload, foi renomeado") — **corte**. Ninguém lendo a doc daqui a
  6 meses precisa saber o histórico; só o que é verdade agora.
- Se a frase é uma **marca de decisão** (`Aceito`, `Backlog real`, `Confirmado`,
  `(confirmado pelo mantenedor)`) ou uma **razão não-óbvia pro desenho atual** — mesmo que essa
  razão cite uma alternativa rejeitada ("não usa o className em função do NavLink porque o Trigger
  do tooltip o junta como string") — **mantenha**. Essa razão evita que alguém "corrija" depois algo
  que não está quebrado.

## Cortar

- "O painel de pareamento era uma coluna fixa ao lado da lista, foi movido pra um painel lateral…"
  → só diga como é agora.
- "Pensamos em X, mas rejeitamos porque Y" → "Faz Z, não X, porque Y." (a alternativa rejeitada
  pode aparecer, mas como razão do estado atual, não como narrativa de decisão).
- "Isso ainda não existia no contrato, foi adicionado depois" → descreva só o comportamento atual.
- Listas do que estava errado antes e já foi corrigido → se já está certo, não há nada a dizer
  sobre o erro antigo.
- Comentário de código que narra uma correção ("corrigido: antes ficava com altura zero") → troque
  pela razão presente ("shrink-0: com overflow-x, a coluna flex encolheria as abas até altura zero").
- Qualquer seção/bullet que só existe pra narrar um bug/lacuna já resolvido, sem nenhum fato
  presente de valor → apague o bullet inteiro em vez de encurtar a história.

## Manter

- `Aceito`, `Backlog real`, `Confirmado` — são o resultado de uma decisão real do mantenedor,
  sinal útil pra quem for decidir se algo é problema ou não.
- `(confirmado pelo mantenedor)` — não é ruído, é proveniência da decisão. Só é dispensável quando
  o contexto já deixa claríssimo que é uma decisão.
- Razão curta pro estado atual, mesmo citando o que foi descartado: "As ações em massa do cache
  chamam o DELETE de cada linha porque o contrato não tem endpoint em lote." Isso é diferente de
  narrar a decisão ("consideramos X, decidimos Y") — é só o fato atual com o porquê.
- Regra de negócio que vive no portal (auto-pair, árvore da franquia, ações em massa) — registre
  que ela é calculada no cliente e a partir de quais dados da API, pra ficar claro o que muda se o
  backend mudar.

## Comentários de código

- Mesma regra: comentário explica o **porquê** presente de algo não óbvio, nunca o histórico.
- Siga a densidade de comentários do arquivo — não comente o óbvio.
- Português, como o resto do código.

## Quando estiver em dúvida

Isso é julgamento frase a frase, não um find-and-replace mecânico. Se não tiver certeza se uma
frase é "jornada" ou "razão do estado atual", pergunte ao usuário antes de fazer uma varredura
grande removendo texto — confirmações do mantenedor nunca devem ser removidas por engano.
