# src/pages/smart-lists

Tela **Listas** (`/listas/:listId?`): cadastro das listas por critério que os clientes mostram
(tag `SmartList` do contrato, `/v1/smart-lists`). Cada lista guarda um filtro e uma ordem, não
títulos fixos: o backend recalcula os títulos a cada consulta, e eles são sempre a obra de início
(raiz) de cada franquia. **Confirmado** (contrato, descrição de `listSmartListItems`). A regra de
quais franquias entram é do backend; o portal só monta o filtro e mostra o resultado.

| Arquivo                                      | Papel                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`SmartListsPage.tsx`](SmartListsPage.tsx)   | Listas na ordem de exibição, reordenação, detalhe, títulos e remoção.                      |
| [`SmartListDialog.tsx`](SmartListDialog.tsx) | Diálogo de cadastro e edição: nome, filtros em pílulas e ordem.                            |
| [`FilterEditor.tsx`](FilterEditor.tsx)       | Escolha do tipo de filtro, editor de cada filtro, pílula e os campos com sugestões.        |
| [`criteria.ts`](criteria.ts)                 | Filtros disponíveis, validação, conversão de e para `SmartListCriteria`, rótulos e frases. |
| [`anilistGenres.ts`](anilistGenres.ts)       | Lista dos gêneros da AniList, fonte das pílulas de gênero.                                 |
| [`anilistTags.ts`](anilistTags.ts)           | Lista das tags da AniList, fonte das sugestões dos campos de tag.                          |
| [`anilistStudios.ts`](anilistStudios.ts)     | Lista dos estúdios da AniList, fonte das sugestões de estúdio.                             |

## Listas

- À esquerda, as listas na ordem de `GET /v1/smart-lists` (por `position`, depois `id`), com o
  número de cada uma, a ordem dos títulos e as setas **Subir** / **Descer**. Sem `listId` na rota, a
  tela abre a primeira lista; um `listId` que não está na listagem mostra "Lista não encontrada".
- **Reordenar** troca a posição de uma lista com a vizinha. O contrato não tem operação de
  reordenar, então a nova ordem é gravada com um `PUT /v1/smart-lists/{id}` por lista cuja posição
  mudou, reenviando nome, filtro e ordem de cada uma; as posições ficam 0, 1, 2… a partir da primeira
  reordenação. Os `PUT` não são atômicos: se um falhar, a ordem fica parcial e a tela recarrega a
  listagem para mostrar o que foi gravado.
- **Nova lista** entra no fim (maior `position` + 1).
- Sem nenhuma lista, a tela explica o que são e oferece criar a primeira.

## Detalhe

- O cabeçalho mostra o nome, quantos títulos a lista tem e a ordem, com **Editar** e **Remover**. Remover
  pede confirmação no próprio cabeçalho e só apaga a lista; os títulos continuam no catálogo.
- O filtro aparece em frases, as mesmas das pílulas do diálogo, nos dois grupos da regra do backend
  (`describeCriteria`). **Confirmado** (contrato, descrição de `listSmartListItems`).
  - **Em qualquer obra da franquia** — gêneros, tags, estúdios, status e conteúdo adulto. A franquia
    entra se algum membro, incluindo a raiz, atender a todos ao mesmo tempo.
  - **Na obra de início** — formato, faixa de anos, notas mínimas e popularidade mínima. Valem só
    para a raiz.
- **Títulos** — os pôsteres em grade, 24 por página (`?page=` na URL, 0-based), com a posição de
  cada um na lista. Clicar abre o item no catálogo, na aba AniList. Obras ocultas na tela Franquias
  nunca entram, porque não pertencem a nenhuma franquia.

## Cadastro e edição (`SmartListDialog`)

O diálogo tem só o nome, os filtros em uso e a ordem. Cada filtro é adicionado quando preciso e
fica numa pílula com a frase dele ("Gêneros: Ação e Comédia", "Lançada entre 2010 e 2020").

- **Nome** obrigatório.
- **Adicionar filtro** abre a escolha do tipo, nos dois grupos da regra do backend: em qualquer obra
  da franquia (gênero, sem gênero, tag, sem tag, estúdio, status, conteúdo adulto) e na obra de
  início (formato, ano de lançamento, nota mínima, nota média mínima, popularidade mínima). Os tipos
  já em uso não aparecem; cada um vira uma pílula só, com todos os seus valores.
- Escolhido o tipo, o editor do filtro abre abaixo das pílulas (`FilterEditor`), sobre um rascunho:
  **Adicionar** (ou **Aplicar**, ao editar) grava no formulário, **Cancelar** descarta. Enter num
  campo simples aplica. A pílula mostra o ícone do grupo; clicar nela reabre o editor, e o "x" tira
  o filtro.
- Os filtros que excluem (**sem gênero** e **sem tag**, `negative` em `FILTERS`) aparecem em vermelho,
  com o ícone de bloqueio, no menu, na pílula, no editor, nos valores escolhidos e no detalhe da
  lista.
- Enquanto a escolha ou um editor está aberto, **Salvar** fica desabilitado, para um filtro não
  ficar para trás sem querer. Esc fecha primeiro as sugestões de um campo, depois o painel aberto e
  só então o diálogo.
- Editores:
  - **Gênero** e **sem gênero**: pílulas de `ANILIST_GENRES`, com o rótulo de `GENRE_LABEL`; um
    gênero já usado no filtro oposto não aparece. Um gênero gravado fora da lista aparece no fim, com
    o nome da AniList, para não se perder ao salvar.
  - **Tag**, **sem tag** e **estúdio**: campo com sugestões de `ANILIST_TAGS` e `ANILIST_STUDIOS`, até
    8 que casam com o texto (as que começam com ele primeiro), com setas e Enter; a área do diálogo
    rola até as sugestões ficarem visíveis. Uma tag do filtro oposto não é sugerida. O texto que bate
    com um nome da lista, ignorando maiúsculas e minúsculas, é gravado com o nome da lista
    ("madhouse" → "MADHOUSE"); o que não bate fica marcado. Backspace no campo vazio tira o último.
  - **Status** e **formato**: pílulas de múltipla escolha.
  - **Conteúdo adulto**: não adulta ou adulta (`adult` `false` ou `true`). Por ser critério de
    franquia, "não adulta" pede uma obra não adulta que também case os demais filtros de franquia;
    uma franquia com uma obra adulta e outra não pode entrar tanto em "adulta" quanto em "não adulta".
  - **Ano de lançamento**: de e até, um ou os dois; o final não pode vir antes do inicial.
  - **Notas** (0 a 10, aceitando vírgula) e **popularidade** (inteiro): um número só.
- O backend compara gêneros, tags e estúdios pelo texto exato, com maiúsculas e minúsculas.
  **Confirmado** no backend (`SmartListService` usa `contains`/`containsAll`).
- **Ordem**: campo (nota, nota média, popularidade, ano, título) e direção, com o rótulo da direção
  conforme o campo ("A → Z", "Mais recentes", "Maior primeiro").
- Filtro sem pílula sai do envio: o portal não manda a chave, e o backend trata ausente como "não
  filtra" (`toCriteria`). Erros de validação do backend (`VALIDATION_ERROR`) em `name` voltam ao
  campo; em `criteria.*`, aparecem abaixo das pílulas com o nome do filtro; os demais viram toast.

## Recarga

- Criar, editar e reordenar invalidam `invalidate.smartLists()` (tudo em `/v1/smart-lists`).
- Remover invalida só a listagem: o prefixo inteiro pediria de novo os títulos da lista recém-removida,
  que ainda está na tela no momento da recarga.
- Os títulos dependem do catálogo, das franquias e dos overrides de título, mas as mutações dessas
  telas não invalidam as listas; os títulos se atualizam ao abrir a tela de novo depois dos 30 s de
  dados frescos do React Query.

## Regras e lacunas

- As listas de gêneros e tags são cópias das coleções da AniList (`GenreCollection` e
  `MediaTagCollection`, 19 gêneros e 430 tags), que o backend grava sem traduzir em `Anime.genres`
  e `Anime.tags`. **Confirmado** na AniList e no backend.
- A lista de estúdios são todos os 2.487 estúdios da AniList (2.483 nomes; quatro se repetem),
  lidos pela consulta paginada `Page { studios }`. O backend grava em `Anime.studio` o primeiro
  estúdio principal da obra (`studios(isMain: true)`, `AnimeMapper.toMainStudio`). A lista não se
  restringe aos marcados com `isAnimationStudio`, porque obras da coleção têm como estúdio principal
  estúdios sem essa marca (Aniplex, studio A-CAT e outros). **Confirmado** nos dados do backend: todos
  os estúdios principais das raízes de franquia estão na lista.
- Nenhum nome se repete ignorando maiúsculas e minúsculas nas três listas, então a correção da caixa
  nunca é ambígua; se um dia se repetir, o campo grava o texto como digitado. Se a AniList criar um
  gênero, uma tag ou um estúdio, o portal só o oferece depois de os arquivos serem atualizados com as
  mesmas consultas.
- Essas listas, os status e formatos da AniList e os rótulos em português ficam no portal, como os
  demais textos de enums. Entra na política de regras de negócio no cliente de
  [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md).
- **Lacuna do contrato:** o contrato não lista os gêneros, tags e estúdios, então as listas do
  portal podem ficar defasadas em relação à AniList. Um endpoint com esses valores resolveria;
  decisão do mantenedor.
- **Lacuna do contrato:** sem operação de reordenar, a ordem nova custa um `PUT` por lista e pode
  ficar parcial se um deles falhar.
- **Efeito da regra de franquia em listas de tema:** como basta um membro casar os filtros de
  franquia, um especial ou OVA com um gênero ou uma tag traz a franquia inteira. Na coleção atual,
  um filtro por Sports traz Boku no Hero Academia, JoJo e Fate/Zero, e a tag Isekai traz BLEACH e Mob
  Psycho 100. **Confirmado** nos dados do backend. Filtros de raiz (formato, ano, notas) não evitam
  isso, porque valem para a obra de início; listas de tema mais precisas dependem de o backend
  oferecer outra regra (gênero e tag só na raiz, por exemplo); decisão do mantenedor.
