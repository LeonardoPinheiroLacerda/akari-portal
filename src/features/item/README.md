# src/features/item

Lógica do item do catálogo (a pasta com seu anime) compartilhada entre as abas da curadoria em
[`src/pages/item`](../../pages/item) (e, os textos, também pela tela Franquias): o estado consolidado
do item, os textos dos enums e a ordenação dos arquivos.

| Arquivo                    | Papel                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| [`useItem.ts`](useItem.ts) | Estado consolidado do item: pasta → anime → vínculo TMDB.                        |
| [`labels.ts`](labels.ts)   | Textos dos enums (revisão, franquia, relações, estações) e listas de idiomas.    |
| [`files.ts`](files.ts)     | `byName`: ordena arquivos de vídeo pelo nome, com trechos numéricos como número. |

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
- `ASSIGNMENT` — rótulo, explicação e tom de cada atribuição de franquia: automática, manual
  (`MANUAL_MEMBER`, posta à mão numa franquia, e `MANUAL_ROOT`, início de uma franquia criada à
  mão) e oculta. O texto de "Automática" descreve a regra do backend: a obra fica na franquia do pai
  automático (a anterior, a principal ou a de que deriva). **Confirmado** (contrato, descrição de
  `GET /v1/metadata/franchises`).
- `RELATION_LABEL` / `relationLabel` — nome em português de cada tipo de relação da AniList; um
  tipo desconhecido aparece com o valor cru.
- `SEASON_LABEL` — estações do ano da AniList.
- `TMDB_LOCALES` e `ISO639` — idiomas oferecidos nos seletores (idioma da busca no TMDB e as
  preferências de idioma do TMDB). São uma seleção dos idiomas mais comuns, não a lista completa
  do TMDB. **Aceito** (confirmado pelo mantenedor): a seleção cobre o uso real; um idioma novo
  entra na lista quando for preciso.
- `ISO639_2` — idiomas das preferências de faixa padrão da reprodução, no código de 3 letras da tag
  `language` das faixas (ISO 639-2/B, como o Matroska grava). Também é uma seleção dos mais comuns.
