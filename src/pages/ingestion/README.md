# src/pages/ingestion

Tela **Ingestão** (`/ingestao`): traz para o catálogo as pastas e os vídeos novos de um diretório
de um provedor. O trabalho em si roda no backend; a tela só dispara e avisa.

| Arquivo                                  | Papel                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| [`IngestionPage.tsx`](IngestionPage.tsx) | Formulário de ingestão e navegador de pastas do provedor (`FolderBrowser`). |

## Formulário

1. **Provedor** — escolhido entre os cadastrados, com o chip do último teste de conexão
   ([`src/features/providers`](../../features/providers/README.md)). Sem provedores, a tela manda
   para Provedores.
2. **Tipo do conteúdo** — Anime, Série ou Filme (`mediaType`). Vale só para as pastas novas; as que
   já estão no catálogo mantêm o tipo que têm. **Confirmado** (contrato, operação
   `createIngestionTasks`).
3. **Diretório raiz** — caminho dentro do provedor; vazio ingere o provedor inteiro. As barras do
   começo e do fim são removidas antes de enviar. "Procurar" abre o navegador de pastas.

"Iniciar ingestão" fica desabilitado sem a chave do TMDB configurada, com um aviso no topo — o
backend recusa a ingestão nesse caso ([`src/features/settings`](../../features/settings/README.md)).

## Ingestão

- Antes de responder `202`, o backend lista o diretório no provedor e cria as pastas novas; depois,
  em segundo plano e uma por vez, roda uma tarefa por pasta: cadastra os vídeos novos e passa pelas
  etapas `ANILIST_SYNC` (vínculo com a AniList), `TMDB_BIND` (vínculo com o TMDB pelo anibridge),
  `TMDB_OVERRIDES` (título, sinopse e imagens do TMDB, pelos idiomas das
  [Preferências](../preferences/README.md)) e `TMDB_FILEPAIR` (pareamento dos episódios). A ingestão
  não remove do catálogo o que sumiu do provedor. **Confirmado** (contrato, `createIngestionTasks` e
  `IngestionStep`).
- A tela só confirma que a ingestão começou; ela não acompanha o andamento das tarefas nem usa as
  operações `getCurrentIngestion`, `listIngestions` e `getIngestionTask` do contrato.
- Cada pedido grava uma ingestão própria, mesmo que repita um diretório já em andamento.
  **Confirmado** (contrato, `createIngestionTasks`).
- Erros síncronos (validação, chave do TMDB, provedor inexistente) aparecem num toast "A ingestão
  não foi aceita"; uma falha ao listar o provedor (`500`) vira o toast genérico.

## Navegador de pastas (`FolderBrowser`)

Mostra a árvore de pastas do provedor (`listAvailableFolders`), com as pastas que já estão no
catálogo marcadas como "No catálogo", e devolve o caminho escolhido para o campo de diretório.
Abre com os ancestrais do diretório atual expandidos.

A árvore inteira do provedor é pedida de uma vez (o portal não usa o parâmetro `rootPath` da
operação para carregar por partes) e fica em cache por 1 minuto. Num provedor remoto grande, a
primeira abertura pode demorar. **Aceito** (confirmado pelo mantenedor): o tamanho atual dos
provedores não justifica carregar por partes.
