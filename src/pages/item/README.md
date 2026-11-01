# src/pages/item

Tela **Item do catálogo** (`/catalogo/:folderId/:aba`): a curadoria de uma pasta e do anime
vinculado a ela, em cinco abas. A lógica compartilhada entre as abas (estado do item, textos,
ordenação dos arquivos, árvore da franquia) fica em [`src/features/item`](../../features/item/README.md), e a
sessão de reprodução em [`src/features/playback`](../../features/playback/README.md).

| Arquivo                                | Papel                                                             |
| -------------------------------------- | ----------------------------------------------------------------- |
| [`ItemPage.tsx`](ItemPage.tsx)         | Cabeçalho, status de revisão, abas e as travas entre elas.        |
| [`AnilistTab.tsx`](AnilistTab.tsx)     | Vínculo com a AniList, metadata, início da franquia e relações.   |
| [`TmdbTab.tsx`](TmdbTab.tsx)           | Vínculo com uma série ou filme do TMDB e a proposta do anibridge. |
| [`OverridesTab.tsx`](OverridesTab.tsx) | Overrides de título, sinopse, pôster, backdrop e logo.            |
| [`PairingTab.tsx`](PairingTab.tsx)     | Pareamento de cada arquivo com um episódio e as propostas.        |
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
- **Metadata** — dados da AniList (títulos, formato, estação, estúdio, episódios, nota, gêneros, sinopse
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

- Mostra o vínculo atual ou o convite para vincular. O card do vínculo mostra a ficha do próprio
  TMDB (`details` do estado do vínculo): pôster principal, título e título original, estreia ou
  lançamento, temporadas e episódios (série) ou duração (filme), status, nota, gêneros e sinopse.
  Não aplica overrides nem cai nos dados da AniList, para que dê para conferir se o vínculo —
  inclusive o automático da ingestão — aponta para o título certo. Quantos overrides existem
  aparece no rodapé do card.
- A ficha vem do TMDB sem idioma pedido, então título, sinopse e gêneros saem em `en-US`, não no
  idioma das preferências. **Confirmado** (contrato, `TmdbBindingDetails`).
- O painel de vincular (ou de trocar o vínculo) começa pela **proposta do anibridge**
  (`POST /v1/metadata/tmdb/binding-proposals`): o título que o anibridge propõe para o anime, com a
  mesma ficha do card do vínculo, e "Vincular proposta". É o mesmo critério do vínculo automático
  da ingestão. A chamada não grava nada, então o portal a lê como consulta. Se a proposta já é o
  vínculo atual, aparece "Vínculo atual" no lugar do botão. Sem proposta (`404`), o bloco mostra o
  chip "Sem proposta" e a mensagem do backend, que diz o motivo (sem mapeamento no anibridge, anime
  fora da AniList ou título removido do TMDB), e manda para a busca manual logo abaixo; se o anime é
  `SPECIAL` ou `OVA` na AniList, acrescenta que o TMDB costuma guardá-los como episódios da
  temporada 0 da série principal. **Confirmado** (contrato, `proposeTmdbBinding`).
- A busca no TMDB escolhe entre série e filme, usa o idioma padrão das preferências como idioma
  inicial e pagina os resultados.
- "Remover vínculo" apaga o vínculo, e o backend apaga junto os overrides e o pareamento de
  episódio de todos os arquivos da pasta. **Confirmado** (contrato, `clearTmdbBinding`).

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
  **Confirmado** (contrato, operações de `tmdb-pairing`).
- **Propostas de pareamento** (`POST /v1/metadata/tmdb/file-pairing-proposals`): os botões
  "Proposta do anibridge" e "Auto-pair por continuidade" abrem o mesmo painel com a `strategy`
  `ANIBRIDGE` ou `CONTINUITY`. A primeira é o critério do pareamento automático da ingestão; a
  segunda dá a cada arquivo sem par o episódio seguinte ao do arquivo pareado anterior e não
  depende do anibridge. Toda a regra vem do backend — episódio proposto, `status` de cada arquivo,
  comparação com o par atual (`change`), episódio já usado por outro arquivo (`usedByFileId`),
  âncora da continuidade (`basedOnFileId`) e pré-seleção (`selectedByDefault`); o painel só
  exibe, na ordem que o backend devolve. Proposta igual ao par atual não pode ser marcada;
  proposta que troca um par existente aparece como "substitui SxxEyy". A chamada não grava nada,
  então o portal a lê como consulta, sempre recalculada ao abrir o painel. **Confirmado**
  (contrato, `proposeTmdbFilePairing`).
- "Aplicar" grava o `pairing` pronto de cada arquivo marcado, com o `PUT` de `tmdb-pairing`, um por
  um. Se um falhar no meio, os anteriores ficam salvos e o aviso diz quantos. **Aceito**
  (confirmado pelo mantenedor): o backend não terá gravação em lote.
- Sem proposta para a pasta inteira — na `ANIBRIDGE`, o anibridge sem mapeamento (`NO_MAPPING`)
  ou com mapeamento conflitante (`CONFLICTING_MAPPING`); na `CONTINUITY`, nenhum arquivo pareado
  como ponto de partida (`NO_ANCHOR`); ou um `404`/`400` do backend —, o painel mostra o chip "Sem
  proposta", o motivo, o próximo passo e só "Fechar". Na `ANIBRIDGE`, se o anime é `SPECIAL` ou
  `OVA` na AniList, acrescenta que esses episódios costumam estar na temporada 0 da série. Quando só
  parte dos arquivos fica sem proposta, a lista aparece com o motivo de cada um.

## Reprodução (`PlaybackTab`)

- Escolhe o arquivo e mostra a disponibilidade, lida de `GET /v1/playback/files/{fileId}/availability`:
  `READY` (provedor local, lido direto do disco, ou remoto já em cache), `DOWNLOADING` (na fila ou
  baixando) ou `NEEDS_DOWNLOAD` (fora do cache ou com download que falhou), que oferece "Enfileirar
  download". O endpoint não diferencia fila de download em andamento nem falha de "nunca baixado";
  esse detalhe fica na tela Cache. Enquanto o arquivo está `DOWNLOADING`, a aba recarrega a
  disponibilidade a cada 5 s.
- Com o arquivo disponível, lê o probe de mídia (faixas de áudio e legenda) e libera o player:
  perfil (os valores do enum `TranscodeProfile`), faixa de áudio, legenda, "Ir para" uma posição
  (`mm:ss`) e troca de faixas durante a reprodução.
- Áudio e legenda começam em "Padrão das preferências", que mostra o idioma (e, na legenda, se é
  completa ou forçada, ou "sem legenda" quando o idioma da legenda está vazio) das preferências
  `playback.default.*` e deixa o backend escolher a faixa; a
  legenda também tem "Sem legenda". Com a sessão ativa, a opção de padrão some e os seletores
  mostram as faixas que o backend escolheu, prontas para a troca de faixas.
- A aba indica se a legenda será selecionável ou queimada no vídeo pelo codec (SRT é selecionável),
  repetindo a regra que o backend aplica.
- As informações técnicas do arquivo listam as faixas de vídeo (com DAR e SAR — SAR diferente de
  `1:1` sai destacado como anamórfico), áudio e legenda e os capítulos do arquivo como o probe os
  devolve (início, fim, duração e título, sem reordenar nem corrigir sobreposições).

## Regras calculadas na tela

Pela política geral de regras de negócio no cliente de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais), estes pontos são **Backlog real**
(confirmado pelo mantenedor) — deveriam vir do backend:

- **Trocar vínculo** (AniList e TMDB) é feito em duas chamadas: apaga o vínculo atual e cria o
  novo, porque o backend recusa um segundo vínculo. Se a segunda falhar, o item fica sem vínculo —
  e, no TMDB, os overrides e os pareamentos já caíram junto com o vínculo antigo.
- **Legenda selecionável ou queimada** é deduzida no portal pelo codec, repetindo a regra do
  backend.
