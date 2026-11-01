# src/features/item

Lógica do item do catálogo (a pasta com seu anime) compartilhada entre as abas da curadoria em
[`src/pages/item`](../../pages/item): o estado consolidado do item, os textos dos enums, a ordenação
dos arquivos e a regra calculada no portal — a árvore de relações da franquia.

| Arquivo                                | Papel                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| [`useItem.ts`](useItem.ts)             | Estado consolidado do item: pasta → anime → vínculo TMDB.                               |
| [`labels.ts`](labels.ts)               | Textos dos enums (revisão, início da franquia, relações, estações) e listas de idiomas. |
| [`files.ts`](files.ts)                 | `byName`: ordena arquivos de vídeo pelo nome, com trechos numéricos como número.        |
| [`relationsTree.ts`](relationsTree.ts) | Raiz da franquia e a árvore indentada de relações.                                      |

## Estado do item (`useItem`)

Encadeia três leituras: a pasta, o anime vinculado a ela e o estado do vínculo TMDB desse anime.
Devolve as queries e os atalhos `hasAnime`, `hasTmdb`, `isTv` e `anilistId`, que o `ItemPage` usa
para travar as abas que dependem de um vínculo anterior.

- `404` no anime da pasta significa "pasta sem anime vinculado", e `404` no estado TMDB significa
  "anime sem vínculo TMDB". **Confirmado** no backend (`AnimeService.getAnimeByFolder` e
  `AnimeTmdbService.getTmdbState` lançam "não encontrado" quando falta o vínculo). O contrato só
  diz `404`, sem detalhar o caso.
- Depois de desvincular, o refetch volta `404` mas o React Query mantém o dado anterior em cache;
  o hook trata o `404` como mais forte e devolve o item sem vínculo.
- Também trata `tmdbId: null` como sem vínculo, por precaução — o backend responde `404` nesse
  caso.

## Textos (`labels.ts`)

- `REVIEW` — rótulo e tom de cada status de revisão (`reviewInfo` cobre o "Processando" de quando
  ainda não há status). Usado na badge do cabeçalho do item e no filtro do catálogo.
- `FRANCHISE_ROOT` — rótulo e explicação das três opções de início da franquia. O texto de
  "Automático" descreve a regra do backend: é início quem não tem relação `PREQUEL` nem `PARENT`.
  **Confirmado** (contrato, schema `AnimeRootKind`).
- `RELATION_LABEL` / `relationLabel` — nome em português de cada tipo de relação da AniList; um
  tipo desconhecido aparece com o valor cru.
- `SEASON_LABEL` — estações do ano da AniList.
- `TMDB_LOCALES` e `ISO639` — idiomas oferecidos nos seletores (idioma da busca no TMDB e as
  preferências de idioma do TMDB). São uma seleção dos idiomas mais comuns, não a lista completa
  do TMDB. **Aceito** (confirmado pelo mantenedor): a seleção cobre o uso real; um idioma novo
  entra na lista quando for preciso.
- `ISO639_2` — idiomas das preferências de faixa padrão da reprodução, no código de 3 letras da tag
  `language` das faixas (ISO 639-2/B, como o Matroska grava). Também é uma seleção dos mais comuns.

## Árvore da franquia (`relationsTree.ts`)

A aba AniList mostra as obras relacionadas como uma árvore montada no portal a partir do grafo de
relações da API e do `rootKind` que o backend calcula para cada obra.

1. **Raiz** (`findFranchiseRoot`) — se o anime da página não é `NOT_ROOT`, ele é a raiz; senão, o
   portal sobe pelas relações `PREQUEL` e `PARENT` até uma obra que não seja `NOT_ROOT` (ou até a
   mais alta que alcançar).
2. **Árvore** (`buildFranchiseTree`) — com o grafo da raiz (profundidade 4), monta os grupos
   "Origem" (`SOURCE`/`ADAPTATION` da raiz), "Antes na cronologia" (cadeia de `PREQUEL`), "Linha
   principal" (a raiz e a cadeia de `SEQUEL`, numeradas) e "Outras relações" (o que sobrar do
   grafo, para nenhuma obra sumir). Cada entrada traz as derivadas recuadas abaixo dela, até 3
   níveis; uma derivada leva junto as próprias obras anteriores e continuações no mesmo recuo, e
   uma `SEQUEL` fora da linha principal (ramificação) entra como derivada.

Limitações conhecidas desse cálculo:

- A raiz depende da página: numa franquia em que uma continuação está marcada como "Sempre o
  início", a página da primeira temporada mostra a árvore a partir dela mesma, e a da continuação
  a partir da continuação.
- "Nunca o início" numa obra sem `PREQUEL` nem `PARENT` não muda a árvore — a subida não tem para
  onde ir, então a obra continua sendo a raiz na própria página.
- O selo "Início da franquia" aparece em toda obra que não é `NOT_ROOT`, então pode aparecer em
  mais de uma obra da mesma árvore.
- Franquias muito longas podem ficar cortadas pela profundidade 4 do grafo.

**Backlog real** (confirmado pelo mantenedor, pela mesma política geral): a árvore deveria vir
pronta do backend, o que resolve as limitações acima de uma vez.
