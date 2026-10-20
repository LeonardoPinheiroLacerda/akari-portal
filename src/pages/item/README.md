# src/pages/item

Tela **Item do catálogo** (`/catalogo/:folderId/:aba`): a curadoria de uma pasta e do anime
vinculado a ela, em cinco abas. A lógica compartilhada entre as abas (estado do item, textos,
auto-pair, árvore da franquia) fica em [`src/features/item`](../../features/item/README.md), e a
sessão de reprodução em [`src/features/playback`](../../features/playback/README.md).

| Arquivo                                | Papel                                                             |
| -------------------------------------- | ----------------------------------------------------------------- |
| [`ItemPage.tsx`](ItemPage.tsx)         | Cabeçalho, status de revisão, abas e as travas entre elas.        |
| [`AnilistTab.tsx`](AnilistTab.tsx)     | Vínculo com a AniList, metadata, início da franquia e relações.   |
| [`TmdbTab.tsx`](TmdbTab.tsx)           | Vínculo com uma série ou filme do TMDB.                           |
| [`OverridesTab.tsx`](OverridesTab.tsx) | Overrides de título, sinopse, pôster, backdrop e logo.            |
| [`PairingTab.tsx`](PairingTab.tsx)     | Pareamento de cada arquivo com um episódio do TMDB e o auto-pair. |
| [`PlaybackTab.tsx`](PlaybackTab.tsx)   | Disponibilidade do arquivo e o teste de reprodução.               |

## Página (`ItemPage`)

- **Cabeçalho** — montado com as imagens de override do TMDB: o backdrop vira o fundo, o logo
  substitui o título em texto e o pôster de override tem prioridade sobre o da AniList. Sem
  overrides, mostra o pôster da AniList e o título.
- **Status de revisão** — badge com o status ("Aguardando revisão", "Parcial", "Revisado",
  "Processando") e o botão "Marcar como revisado" enquanto o título não está revisado. Fica no
  cabeçalho para estar disponível em todas as abas.
- **Abas e travas** — a rota sem aba redireciona para AniList. TMDB e Overrides exigem o vínculo
  AniList (e Overrides também o TMDB); TMDB Episódio Pair exige AniList, TMDB e que o vínculo TMDB
  seja de série — filmes não têm episódios. Uma aba travada mostra o motivo e um botão para a aba
  que falta. Cada aba ganha um check quando o passo dela está feito (Reprodução nunca recebe).

## AniList (`AnilistTab`)

- **Sem anime vinculado** — mostra a pasta livre e "Vincular anime", que abre a busca na AniList.
- **Metadata** — dados da AniList (títulos, formato, estação, episódios, nota, gêneros, sinopse
  sanitizada com DOMPurify), com o `anilistId` e o `malId` como links para a página do anime na
  AniList e no MyAnimeList (como o id da aba TMDB leva ao site do TMDB) e as ações Sincronizar (busca de novo na AniList), Trocar anime e
  Desvincular.
- **Desvincular** — confirmação que lista o que se perde (dados da AniList, vínculo e overrides do
  TMDB, relações, status de revisão e início da franquia) e o que fica (pasta, arquivos, pareamento
  dos episódios e cache). O pareamento fica porque é ligado ao arquivo de vídeo, não ao anime.
  **Confirmado** (`tmdb_file_pairing.file_id` referencia `video_file`, em
  `V8__create-tmdb-file-pairing-table.sql` no backend).
- **Início da franquia** — as três opções de curadoria (Automático, Sempre o início, Nunca o início)
  e como o anime aparece hoje, pelo `rootKind` do backend.
- **Relações da franquia** — a árvore montada por `relationsTree` (ver
  [`src/features/item`](../../features/item/README.md#árvore-da-franquia-relationstreets)); clicar
  numa obra que está na coleção abre o item dela.

## TMDB (`TmdbTab`)

- Mostra o vínculo atual (série ou filme, com pôster, datas e quantos overrides existem) ou o
  convite para vincular.
- A busca no TMDB escolhe entre série e filme, usa o idioma padrão das preferências como idioma
  inicial e pagina os resultados.
- "Remover vínculo" apaga o vínculo; os overrides caem em cascata. **Confirmado** (`openapi.yaml`,
  `clearTmdbBinding`).

## Overrides (`OverridesTab`)

- Cinco campos: título, sinopse, pôster, backdrop e logo. Cada um pode ficar sem override (usa o
  padrão da AniList ou nenhum), usar uma opção do TMDB ou, no caso do texto, um texto personalizado.
- As opções vêm do schema de overrides do TMDB; "Recarregar opções" força a busca de novo no TMDB.
- As alterações ficam num rascunho até "Salvar overrides", que substitui o bloco inteiro — campo
  `null` remove aquele override. Há pré-visualização do rascunho (backdrop, logo, pôster, título e
  sinopse).
- As imagens podem ser vistas ampliadas, em tamanho original, com navegação entre as opções e
  "Usar esta imagem". O tamanho original é obtido trocando o tamanho na URL do CDN do TMDB
  (`/t/p/w342/` → `/t/p/original/`), já que a API só entrega a URL do preview. **Backlog real**
  (confirmado pelo mantenedor): o backend deveria entregar também a URL em tamanho original, sem o
  portal depender do formato da URL do TMDB.

## Pareamento (`PairingTab`)

- Lista dos arquivos da pasta em largura total, com o nome completo, o episódio pareado e filtros
  (Todos, Sem par, Pareados).
- Clicar num arquivo abre um painel lateral não modal com a escolha do episódio: abas de temporada,
  episódios com still, a pré-visualização do episódio escolhido e a opção de usar o still do TMDB
  como thumbnail. O painel navega entre arquivos (anterior, próximo, próximo sem par), reabre na
  temporada e na altura da lista da última escolha e fecha ao salvar, remover, descartar, clicar
  fora ou com Esc. Fechar descarta o rascunho não salvo.
- Salvar grava o par com uma cópia dos dados do episódio (nome, sinopse, data, duração, nota,
  tipo); "Remover pareamento" apaga o par (`DELETE`), que é diferente de gravar campos `null`.
  **Confirmado** (`openapi.yaml`, operações de `tmdb-pairing`).
- **Auto-pair por continuidade** abre a proposta de `autoPair`; "Aplicar" grava os pares marcados
  um por um. Se um falhar no meio, os anteriores ficam salvos e o aviso diz quantos.

## Reprodução (`PlaybackTab`)

- Escolhe o arquivo e mostra a disponibilidade: provedor local é lido direto do disco; provedor
  remoto precisa estar no cache — a aba mostra o estado do download e oferece "Enfileirar download"
  quando o arquivo está fora do cache ou falhou. Enquanto o arquivo está na fila ou baixando, a aba
  recarrega o estado a cada 5 s.
- Com o arquivo disponível, lê o probe de mídia (faixas de áudio e legenda) e libera o player:
  perfil (`WEB`, `TV`, `MOBILE`), faixa de áudio, legenda, "Ir para" uma posição (`mm:ss`) e troca
  de faixas durante a reprodução.
- A aba indica se a legenda será selecionável ou queimada no vídeo pelo codec (SRT é selecionável),
  repetindo a regra que o backend aplica.
- O estado do cache de um arquivo é achado listando até 500 linhas do cache e procurando o
  arquivo, porque a listagem do cache não filtra por arquivo. **Confirmado** (`openapi.yaml`,
  `listCaches`: só `page`, `size` e `pendingOnly`). Com mais de 500 linhas no cache, o estado pode
  sair errado. **Backlog real** (confirmado pelo mantenedor): o backend deveria filtrar a listagem
  do cache por arquivo.

## Regras calculadas na tela

Pela política geral de regras de negócio no cliente de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais), estes pontos são **Backlog real**
(confirmado pelo mantenedor) — deveriam vir do backend:

- **Trocar vínculo** (AniList e TMDB) é feito em duas chamadas: apaga o vínculo atual e cria o
  novo, porque o backend recusa um segundo vínculo. Se a segunda falhar, o item fica sem vínculo —
  e, no TMDB, os overrides já caíram junto com o vínculo antigo.
- **Aplicar o auto-pair** grava um par por requisição, sem operação em lote.
- **Legenda selecionável ou queimada** é deduzida no portal pelo codec, repetindo a regra do
  backend.
