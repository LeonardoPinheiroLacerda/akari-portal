# src/pages/ingestion

Tela **Ingestão** (`/ingestao`): sincroniza um diretório de um provedor com o catálogo — ou
remove do catálogo o que foi ingerido de um diretório. O trabalho em si roda no backend, em
segundo plano; a tela só dispara e avisa.

| Arquivo                                  | Papel                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`IngestionPage.tsx`](IngestionPage.tsx) | Formulário de ingestão, navegador de pastas do provedor (`FolderBrowser`) e remoção do catálogo. |

## Formulário

1. **Provedor** — escolhido entre os cadastrados, com o chip do último teste de conexão
   ([`src/features/providers`](../../features/providers/README.md)). Sem provedores, a tela manda
   para Provedores.
2. **Tipo do conteúdo** — Anime, Série ou Filme (`mediaType`). Vale só para as pastas novas; as que
   já estão no catálogo mantêm o tipo que têm. **Confirmado** (`openapi.yaml`, operação
   `ingestProviderSubtree`).
3. **Diretório raiz** — caminho dentro do provedor; vazio ingere o provedor inteiro. As barras do
   começo e do fim são removidas antes de enviar. "Procurar" abre o navegador de pastas.

"Iniciar ingestão" fica desabilitado sem a chave do TMDB configurada, com um aviso no topo — o
backend recusa a ingestão nesse caso ([`src/features/settings`](../../features/settings/README.md)).

## Ingestão

- O backend responde `202` na hora e faz o resto em segundo plano: lista o diretório no provedor,
  remove do catálogo o que não existe mais lá, cria as pastas e arquivos novos e vincula cada pasta
  (AniList → TMDB → episódios). **Confirmado** (`openapi.yaml`, `ingestProviderSubtree`).
- A tela só confirma que a ingestão começou. O resultado chega pelas notificações: uma `INFO` ao
  terminar, `ERROR` se a ingestão falhar, e `WARNING`/`ERROR` para cada pasta que não conseguiu
  vincular (sem interromper as demais).
- Pedir de novo o mesmo diretório do mesmo provedor enquanto a ingestão dele está em andamento não
  inicia outra — o backend ignora o pedido e responde `202` igual. A tela avisa isso no card de
  confirmação.
- Erros síncronos (validação, chave do TMDB, provedor inexistente) aparecem num toast "A ingestão
  não foi aceita".

## Navegador de pastas (`FolderBrowser`)

Mostra a árvore de pastas do provedor (`listAvailableFolders`), com as pastas que já estão no
catálogo marcadas como "No catálogo", e devolve o caminho escolhido para o campo de diretório.
Abre com os ancestrais do diretório atual expandidos.

A árvore inteira do provedor é pedida de uma vez (o portal não usa o parâmetro `rootPath` da
operação para carregar por partes) e fica em cache por 1 minuto. Num provedor remoto grande, a
primeira abertura pode demorar. **Aceito** (confirmado pelo mantenedor): o tamanho atual dos
provedores não justifica carregar por partes.

## Remover do catálogo

"Remover do catálogo" pede confirmação e chama `DELETE /v1/ingestion/providers/{id}?rootPath=`:
remove as pastas, os arquivos e os vínculos de metadata do trecho escolhido (ou de tudo do
provedor, com o diretório vazio), sem tocar em nada no provedor. A operação é idempotente e
responde `204` mesmo quando nada casa. **Confirmado** (`openapi.yaml`, `removeIngestedSubtree`).

Arquivos desse trecho que já estavam no cache de vídeo somem da tela de Cache, mas continuam no
disco: a linha do cache sai em cascata com o arquivo (`video_file_cache.file_id ... ON DELETE
CASCADE`, `V12__create-video-file-cache-table.sql`), e nada apaga o arquivo baixado em `cache.dir`
— ele fica fora da tela de Cache e fora da conta do limite de tamanho do cache. **Confirmado** no
código do backend. **Backlog real** (confirmado pelo mantenedor): a correção é no backend `akari`,
apagando do disco os arquivos em cache do trecho removido.
