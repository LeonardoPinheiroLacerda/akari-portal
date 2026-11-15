# src/pages/torrents

Telas de **Torrents**: rastrear animes em lançamento e buscar e baixar releases nos provedores de
torrent. Os arquivos baixados vão para a pasta do anime na biblioteca (o
provedor `LOCAL` da preferência `torrent.library-provider-id`) e são ingeridos no catálogo pelo
backend.

| Arquivo                                          | Papel                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`TrackedAnimesPage.tsx`](TrackedAnimesPage.tsx) | **Rastreados** (`/torrents`): animes rastreados, os episódios da edição e parar de rastrear.       |
| [`TorrentSearchPage.tsx`](TorrentSearchPage.tsx) | **Buscar** (`/torrents/buscar`): escolher o anime, buscar no provedor, baixar ou rastrear.         |
| [`EditionReleases.tsx`](EditionReleases.tsx)     | Lista das releases de uma edição, com o estado de download e o botão Baixar (Buscar e Rastreados). |

## Buscar

- Primeiro escolhe o anime na AniList: o download e o rastreio precisam dele, porque os arquivos
  vão para a pasta do anime.
- A busca no provedor começa com o título romaji, que é o que os grupos de fansub usam no nome das
  releases, e pode ser editada. Ela lê todas as páginas do provedor e leva alguns segundos; o
  resultado fica em cache por 5 minutos.
- O resultado vem agrupado pelo backend em **edições** (grupo + resolução, fonte, áudio, codec), com
  uma release por episódio. O filtro só procura no nome das edições, sem nova busca.
- Quando o provedor corta a busca no limite dele (`truncated`), um aviso pede para refinar o texto.
- **Rastrear** grava o rastreio da edição e leva a Rastreados. Um anime só tem um rastreio, então o
  botão fica desabilitado se o anime já é rastreado.

## Rastreados

- Cada card mostra a edição, o último episódio encontrado no provedor, quando foi a última checagem
  e o erro dela, se houve. O backend checa os rastreios a cada 15 minutos e baixa sozinho todo
  episódio novo da edição.
- **Episódios** abre a edição rastreada com o estado de download de cada episódio. A lista refaz a
  busca completa no provedor, então só carrega quando aberta.
- **Parar de rastrear** pede confirmação no próprio card; os episódios já baixados continuam.

## Acompanhar os downloads

Não há tela de downloads no portal: o menu tem um link **qBittorrent** que abre a WebUI dele
(`http://localhost:8090`, a stack do `docker-compose` do akari) em nova aba, com progresso,
velocidade, peers e o resto que o qBittorrent já oferece. Quando um download termina, o backend
move os arquivos para a biblioteca, tira o torrent do qBittorrent e avisa nas notificações.

## Baixar

- **Baixar** manda o magnet da release ao backend, que envia ao qBittorrent. Se o anime ainda não
  tem pasta, o backend cria uma na biblioteca e vincula ao anime; por isso o botão invalida também o
  catálogo e o anime.
- Uma release que já está baixando ou na biblioteca mostra o estado em vez do botão. Uma que saiu do
  qBittorrent antes de terminar volta a mostrar **Baixar**.
- Erros do backend aparecem como toast: biblioteca não configurada (`503`), anime vinculado a uma
  pasta de outro provedor (`409`), provedor recusando por excesso de requisições (`429`).
