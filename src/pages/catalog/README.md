# src/pages/catalog

Tela **Catálogo** (`/catalogo`): lista paginada das pastas ingeridas, com busca, filtros de
curadoria e ordenação. É a porta de entrada da curadoria — daqui se abre o item de cada título
([`src/pages/item`](../item)).

| Arquivo                              | Papel                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| [`CatalogPage.tsx`](CatalogPage.tsx) | Barra de busca e filtros, tabela de pastas, navegação por subpastas e paginação. |

## Lista

- Vem de `GET /v1/catalog/folders`, 20 pastas por página. Todos os filtros combinam com E e são
  aplicados no backend. **Confirmado** (contrato, `listFolders`).
- Ordenação por nome (A–Z, Z–A) ou data de criação (recentes, antigas) — os dois campos que o
  backend aceita.
- Cada linha mostra a capa e o título do anime vinculado (ou "Sem vínculo"), o provedor e o
  caminho, o tipo da pasta (Anime, Série ou Filme, de `MEDIA_TYPE_LABEL` em
  [`src/features/item/labels.ts`](../../features/item/labels.ts)), se tem TMDB, se tem arquivos e a
  data de criação.
- Clicar numa linha abre o item na aba AniList — inclusive pastas sem anime vinculado, que caem no
  botão "Vincular anime" dessa aba.
- A seta da última coluna mostra as **subpastas** daquela pasta (filtro `parentId`), com um chip
  "Pasta pai" para voltar.

## Busca e filtros

- A busca pelo nome da pasta espera o usuário parar de digitar antes de consultar.
- O botão **Filtros** abre e fecha o painel; ele mostra quantos filtros estão ativos e o navegador
  lembra se o painel estava aberto (`akari.catalog.filtersOpen`).
- Filtros: Tipo, Arquivos, AniList, TMDB, Episódios, Revisão e Provedor. As definições ficam numa
  lista única (`SEGMENTED` e os selects), usada tanto pelos controles quanto pelos chips.
- Cada filtro ativo aparece como chip removível embaixo da barra, mesmo com o painel fechado; ao
  lado ficam a contagem de pastas e "Limpar filtros".
- Busca, filtros, ordenação, página e pasta pai ficam na URL, então uma lista filtrada pode ser
  compartilhada ou aberta de outra tela (ex.: "Pastas" na tela de Provedores abre
  `/catalogo?storageProviderId=<id>`).

Regras dos filtros de curadoria, definidas pelo backend. **Confirmado** (contrato, descrição
de `listFolders` e dos parâmetros):

- Pasta sem anime vinculado só aparece com AniList "Sem vínculo"; combinada com TMDB, Episódios ou
  Revisão, a lista fica vazia.
- Pasta sem nenhum arquivo não aparece nem em "Todos pareados" nem em "Com pendência".
