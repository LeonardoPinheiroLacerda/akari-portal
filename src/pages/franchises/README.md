# src/pages/franchises

Tela **Franquias** (`/franquias/:key?`): a organização das obras da coleção em franquias. Cada
anime pertence a no máximo uma franquia, identificada pela obra de início (a raiz). Quem pertence a
quê é decidido pelo backend, pela regra automática (o pai automático de cada obra, pelas relações
da AniList) e pelas atribuições feitas aqui; o portal só mostra e chama as ações.
**Confirmado** (contrato, descrição de `GET /v1/metadata/franchises`).

| Arquivo                                            | Papel                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| [`FranchisesPage.tsx`](FranchisesPage.tsx)         | Lista de franquias ou, com uma escolhida, o painel dela.                |
| [`FranchisePanel.tsx`](FranchisePanel.tsx)         | A franquia selecionada: obras, relacionadas e ações.                    |
| [`HiddenPanel.tsx`](HiddenPanel.tsx)               | As obras ocultas e as ações para tirá-las de lá.                        |
| [`FranchiseGraph.tsx`](FranchiseGraph.tsx)         | Visão Grafo das obras (React Flow).                                     |
| [`relationsGraph.ts`](relationsGraph.ts)           | Setas do grafo (uma por par, a partir da raiz) e o layout pela relação. |
| [`FranchisePreview.tsx`](FranchisePreview.tsx)     | Visão Prévia: temporadas, filmes e especiais como os clientes mostram.  |
| [`pickers.tsx`](pickers.tsx)                       | Diálogos de busca: obra da coleção e franquia.                          |
| [`useFranchiseActions.ts`](useFranchiseActions.ts) | Ações de organização, com aviso e recarga do que depende delas.         |

## Lista (`FranchisesPage`)

- Sem `key`, a tela é a lista de franquias, com a mesma cara do Catálogo: no cartão de cima a
  busca por qualquer obra da franquia (o backend procura nos títulos da raiz e dos membros), o
  filtro Todas / Automáticas / Manuais, **Ocultas** (com quantas obras estão ocultas) e **Nova
  franquia**, e embaixo dele o total e "Limpar filtros"; depois a tabela paginada (12 por página),
  com o pôster da raiz, o título, ano · formato · estúdio · `anilistId`, o tipo (automática ou
  manual) e quantas obras a franquia tem. A ordem é a do backend, pelo `anilistId` da raiz.
  **Confirmado** (contrato, `listFranchises`).
- **Nova franquia** cria uma franquia manual a partir de uma obra da coleção: ela sai da franquia em
  que estava, com as obras que estão abaixo dela.
- Com `key` (`anilistId` da raiz ou `ocultas`), a lista sai da tela para o grafo ter a largura
  toda; no topo ficam **Franquias** (volta à lista) e **Trocar franquia** (busca uma franquia pelo
  título de qualquer obra e a abre).

## Franquia (`FranchisePanel`)

- **Cabeçalho** — a raiz, o tipo (automática ou manual) e quantas obras e relacionadas tem, com
  "Adicionar obra" (busca na coleção), "Abrir item" e, só na manual, "Excluir franquia" (a raiz e as
  obras postas à mão nela voltam ao automático).
- **Obras da franquia**, em três visões:
  - **Grafo** — a árvore completa de relações da AniList em volta da franquia (o grafo de relações
    da raiz, profundidade 50), para ver o que poderia entrar nela: os membros normais e as demais
    obras esmaecidas, cada uma com a franquia em que está ("Em …") ou "Oculta", e com uma seta por par
    no sentido natural da relação. O detalhe da franquia só diz onde estão os vizinhos diretos
    (`related`); as obras mais distantes são lidas uma a uma (`GET /v1/metadata/animes/{anilistId}`,
    que traz `franchiseRootId`). Cada membro fica sob o pai automático dele (`autoParentId`), e o
    desenho não depende de qual obra é o início: trocar o início só move o selo "Início". Clicar numa
    obra abre um modal com a situação dela numa frase (abaixo de qual obra está, ou em qual
    franquia) e as ações, cada uma com uma linha dizendo o que acontece; remover aparece em vermelho
    e "Abrir item" fica no rodapé (nas de fora, a ação é "Trazer para esta franquia"). "Árvore
    completa" / "Só esta franquia" escolhe se as obras de outras franquias e as ocultas aparecem;
    com "Só esta franquia", o desenho mostra só os membros e as setas entre eles. Detalhes do
    desenho abaixo.
  - **Lista** — as obras em Temporadas, Filmes e Especiais (a divisão que o backend devolve), com a
    raiz antes se não estiver nelas. Cada linha diz de quem a obra está abaixo, ou que foi posta à
    mão, e tem as ações em ícones.
  - **Prévia** — temporadas, filmes e especiais em pôsteres, como os clientes mostram, lidos de
    `GET /v1/metadata/animes/{anilistId}/franchise`.
- **Ações de cada obra**:
  - **Mover para outra franquia** — busca a franquia de destino; a obra vai com as que estão abaixo
    dela.
  - **Remover desta franquia** — pergunta para onde ela vai: **Franquia própria** (vira raiz de uma
    franquia manual) ou **Ocultar**. Mostra antes as obras que vão junto: as que estão abaixo pela
    regra automática, sem o início nem as postas à mão, que não seguem o pai automático.
  - **Tornar início da franquia** — troca o início por esta obra, mantendo todas as obras juntas.
    São duas chamadas, porque o contrato não tem uma operação única para isso: a obra vira franquia
    manual (sai com as que estão abaixo dela) e a franquia antiga é juntada à nova, e a tela segue
    para ela. Se a segunda falhar, as duas ficam separadas e o aviso diz para usar "Juntar a outra
    franquia" na antiga. **Backlog real**, pela política geral de
    [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais):
    deveria ser uma operação só no backend.
  - **Voltar ao automático** — só nas obras postas à mão.
  - Na raiz, no lugar de mover e remover, **Juntar a outra franquia**: todas as obras desta vão
    para a escolhida, e a tela segue para ela.
- **Relacionadas em outras franquias** — obras com relação na AniList com algum membro, mas em outra
  franquia ou ocultas, com a relação, a obra a que se ligam e onde estão hoje, e **Trazer para esta
  franquia**.
- "Abrir item" (no cabeçalho, nas linhas, no modal do grafo, nas ocultas) e os pôsteres da Prévia
  abrem o item numa aba nova, para a franquia continuar aberta.
- Toda ação recarrega as franquias, a franquia de cada anime e as raízes listadas, porque mover uma
  obra muda mais de uma franquia.

## Ocultas (`HiddenPanel`)

Obras postas fora de qualquer franquia (os clientes não as listam), com **Voltar ao automático**,
**Mover para…** e **Franquia própria**. As que estão ocultas só por estarem abaixo de uma oculta não
aparecem aqui: saem junto com ela.

## Grafo (`FranchiseGraph` e `relationsGraph.ts`)

- `graphEdges` junta cada par de obras numa seta só, porque a AniList grava a relação dos dois
  lados (`SEQUEL`/`PREQUEL`, `SIDE_STORY`/`PARENT`). Quando o par tem mais de uma relação, fica a de
  maior prioridade: continuação, história paralela, spin-off, resumo, versão alternativa, outra.
- `labelEdges` dá a cada seta o nome da relação no sentido natural (a obra anterior → a
  continuação, a principal → a derivada).
- `applyTreeParents` faz a seta entre cada obra e o pai automático dela sair do pai; se a relação
  entre os dois estiver desligada no filtro, cria uma ligação só para o layout, que não é desenhada,
  para o desenho não mudar de forma conforme o filtro.
- `layoutByRelation` posiciona as obras pela relação com a de cima, começando pelas que não têm nada
  acima (o topo natural): continuação abaixo, filmes à esquerda e o resto à direita. Partes sem
  ligação entre si ficam lado a lado, da maior para a menor. Cada obra forma um bloco com a própria
  coluna de continuações e os galhos laterais empilhados em cada linha. Os nós têm tamanho fixo
  (`NODE_W` × `NODE_H`), o que permite enquadrar o desenho sem medir os nós.
- Quando caber tudo exigiria um zoom em que os cartões não dão para ler (abaixo de 0,55), o desenho
  abre nesse zoom com o topo do desenho no alto da tela, centrado no início da franquia na
  horizontal; o botão de enquadrar mostra tudo.
- A barra do grafo tem o alcance ("Árvore completa" / "Só esta franquia", com a explicação na dica),
  um botão em pílula por tipo de relação, com a amostra do traço, para ligar e desligar as setas
  daquele tipo, e o ícone de tela cheia. "Versão alternativa" começa desligada,
  porque a AniList usa muito esse tipo e ele embola o desenho. Passar o mouse numa obra destaca em
  laranja o cartão e as setas dela. "Tela cheia" abre o grafo numa camada sobre o portal (não no
  modo do navegador, em que o modal da obra, renderizado fora do grafo, ficaria invisível).
- Os nós são recriados a cada render (hover, seleção); o grafo guarda as medidas que o React Flow
  informa e as devolve nos nós, porque sem elas ele esconde os nós até medir de novo.

## Lacuna do contrato

`root` e `members` vêm como `AnimeResponse`, que não traz a pasta do anime. Para os links "Abrir
item", o painel usa o grafo de relações da raiz (o mesmo do desenho), cujos nós trazem `folderId`;
as relacionadas já trazem a pasta. Uma obra posta à mão sem nenhuma relação
com a franquia fica sem o link. **Backlog real**: o `AnimeResponse` deveria trazer `folderId`.
