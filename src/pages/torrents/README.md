# src/pages/torrents

Telas de **Torrents**: rastrear animes em lançamento e buscar e baixar releases nos provedores de
torrent. Os arquivos baixados vão para a pasta do anime na biblioteca (o
provedor `LOCAL` da preferência `torrent.library-provider-id`) e são ingeridos no catálogo pelo
backend.

| Arquivo                                          | Papel                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [`TrackedAnimesPage.tsx`](TrackedAnimesPage.tsx) | **Rastreados** (`/torrents`): animes rastreados, os episódios da edição e parar de rastrear. |
| [`TorrentSearchPage.tsx`](TorrentSearchPage.tsx) | **Buscar** (`/torrents/buscar`): escolher o anime, buscar no provedor e rastrear uma edição. |
| [`EditionReleases.tsx`](EditionReleases.tsx)     | Lista das releases de uma edição, com o estado de download e o botão Baixar (Rastreados).    |

## Buscar

- Primeiro escolhe o anime na AniList: o download e o rastreio precisam dele, porque os arquivos
  vão para a pasta do anime.
- Abaixo do anime ficam os dados que ajudam a montar as buscas: títulos (romaji, inglês, japonês),
  sinônimos em alfabeto latino, formato, estação, status, episódios, exibição e estúdio.
- A busca começa com duas queries, o título romaji e o inglês, sem pontuação: o provedor exige
  todas as palavras, e cada grupo escreve o nome de um jeito. Lê todas as páginas do provedor; o
  resultado fica em cache por 5 minutos.
- **Adicionar busca** soma outra query (ex.: "Tokyo Revengers S04"), enviada como digitada. O
  backend junta os resultados sem repetir release; o rastreio guarda todas as queries.
- O resultado vem agrupado pelo backend em **edições** (grupo + resolução, fonte, áudio, codec), com
  uma release por episódio. O filtro só procura no nome das edições, sem nova busca.
- Cada edição mostra badges, episódios, pacotes, tamanho médio por arquivo e seeders médios. As
  médias ignoram pacotes. A busca não lista releases nem baixa: baixar é pelo rastreio.
- Quando o provedor corta a busca no limite dele (`truncated`), um aviso pede para refinar o texto.
- **Rastrear** grava o rastreio da edição e leva a Rastreados. Um anime só tem um rastreio, então o
  botão fica desabilitado se o anime já é rastreado.

## Rastreados

- Cada card mostra a edição, o último episódio encontrado, as queries e a última checagem (com o
  erro, se houve). O backend checa a cada 15 minutos e baixa todo episódio novo da edição.
- **Episódios** abre a edição rastreada com o estado de download de cada episódio. A lista refaz a
  busca completa no provedor, então só carrega quando aberta.
- **Buscas** soma ou remove queries do rastreio; cada mudança salva na hora.
- **Parar de rastrear** pede confirmação no próprio card; os episódios já baixados continuam.

## Acompanhar os downloads

Não há tela de downloads no portal: o menu tem um link **qBittorrent** que abre a WebUI dele
(`http://localhost:8090`, a stack do `docker-compose` do akari) em nova aba, com progresso,
velocidade, peers e o resto que o qBittorrent já oferece. Quando um download termina, o backend
move os arquivos para a biblioteca, tira o torrent do qBittorrent e avisa nas notificações.

## Baixar

- **Baixar** (nos Episódios de um rastreio) envia o magnet ao qBittorrent pelo backend. Se o anime ainda não tem pasta, o backend cria uma na biblioteca e vincula ao anime;
  por isso o botão invalida também o catálogo e o anime.
- **Baixar todos** envia, um por vez, os episódios ainda não baixados; pacotes ficam de fora. Para
  no primeiro erro.
- Uma release que já está baixando ou na biblioteca mostra o estado em vez do botão. Uma que saiu do
  qBittorrent antes de terminar volta a mostrar **Baixar**.
- Erros do backend aparecem como toast: biblioteca não configurada (`503`), anime vinculado a uma
  pasta de outro provedor (`409`), provedor recusando por excesso de requisições (`429`).
