# src/pages/ingestion

Telas de **Ingestão**. O trabalho em si roda no backend; o portal dispara e acompanha.

- `/ingestao` — três seções: **Nova ingestão** (o formulário), **Em andamento** (o andamento ao
  vivo da ingestão que está rodando — ou da última, sem nenhuma rodando —, sem as tarefas) e **Histórico** (as ingestões anteriores,
  paginadas).
- `/ingestao/:id` — as tarefas de uma ingestão: andamento, filtros, a lista de pastas e o painel com
  a linha do tempo de cada uma. Serve tanto para a ingestão em andamento (ao vivo) quanto para as do
  histórico.

| Arquivo                                            | Papel                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`IngestionPage.tsx`](IngestionPage.tsx)           | `/ingestao`: formulário, navegador de pastas do provedor (`FolderBrowser`) e as seções. |
| [`IngestionOverview.tsx`](IngestionOverview.tsx)   | Seções "Em andamento" e "Histórico".                                                    |
| [`IngestionTasksPage.tsx`](IngestionTasksPage.tsx) | `/ingestao/:id`: lista de tarefas com filtros e o atalho para a curadoria.              |
| [`TaskPanel.tsx`](TaskPanel.tsx)                   | Painel lateral com a linha do tempo de uma tarefa.                                      |

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
- Disparar uma ingestão com outra rodando é aceito: as pastas da nova entram na fila depois das
  atuais. O formulário avisa isso quando há uma rodando.
- Cada pedido grava uma ingestão própria, mesmo que repita um diretório já em andamento.
  **Confirmado** (contrato, `createIngestionTasks`).
- Erros síncronos (validação, chave do TMDB, provedor inexistente) aparecem num toast "A ingestão
  não foi aceita"; uma falha ao listar o provedor (`500`) vira o toast genérico.

## Em andamento e histórico

- **Em andamento** mostra a ingestão que está rodando ou, sem nenhuma, a última — o
  `useCurrentIngestion`, que o stream `/v1/ingestion/events` mantém atualizado
  ([`src/features/ingestion`](../../features/ingestion/README.md)): status, horário do disparo,
  duração, a barra das tarefas por status (`taskCounts`) e a tarefa rodando agora. O título vira
  "Última ingestão" quando ela termina. O bloco nunca some depois da primeira ingestão: uma ingestão
  pequena termina em segundos, e alternar entre o andamento e um estado vazio fazia a página piscar.
  Um chip mostra se o stream está "Ao vivo", "Conectando…" ou "Reconectando…", com a hora do último
  evento. "Ver tarefas" abre `/ingestao/:id`; a linha da tarefa atual abre o painel dela lá.
- **Histórico** lista as ingestões de `GET /v1/ingestion`, da mais nova para a mais antiga, 5 por
  página: número, status, data, duração, a barra das tarefas e as contagens. A mostrada em "Em andamento"
  fica de fora. O stream recarrega o histórico quando uma ingestão
  começa ou termina.
- A página do histórico é pequena porque cada ingestão vem com todas as tarefas dela — centenas,
  num provedor inteiro. **Confirmado** (contrato, `IngestionSummary.tasks`).

## Tarefas de uma ingestão (`/ingestao/:id`)

- A ingestão em andamento (ou a última) vem do cache do stream, ao vivo. As demais são procuradas
  página a página no histórico (`useIngestionById`), porque o contrato não tem uma busca de ingestão
  pelo número; um número que não está no histórico mostra "não encontrada".
- **Andamento:** o mesmo cabeçalho da seção "Em andamento"; clicar numa legenda aplica o filtro
  correspondente.
- **Tarefas:** uma linha por pasta — a rodando no topo, depois as finalizadas da que terminou por
  último para a mais antiga (`completedAt`) e por fim as na fila, na ordem em que vão rodar —, com pôster e título do anime vinculado,
  um marcador por etapa (cor do status da execução mais recente; vazio se a etapa não rodou) e o
  status. O filtro padrão é "Precisam de atenção" (aguardando curadoria ou com falha), quando há
  alguma; também há "Todas", "Concluídas" e "Na fila", e uma busca por pasta ou título. Como o
  contrato devolve todas as tarefas de uma vez, a tela filtra e pagina no cliente, 25 por página.
- **Resolver:** uma tarefa em `WAITING_CURATION` abre, numa nova aba do navegador, a aba do item da
  etapa que parou (`UNRESOLVED`): AniList, TMDB, Overrides ou Pareamento. A etapa vem dos `steps` da
  tarefa; o mapa etapa → aba fica em `STEPS` ([`labels.ts`](../../features/ingestion/labels.ts)).
- **Marcar como resolvida:** depois da curadoria no item, o botão de check (na linha ou no painel)
  chama `PUT /v1/ingestion/tasks/{taskId}/resolve`, que passa a tarefa para `RESOLVED` sem rodar as
  etapas que faltavam. A resposta atualiza a lista e o painel na hora, sem esperar o stream, e o
  histórico é recarregado. Só vale para `WAITING_CURATION`; o backend responde `400` nos demais
  status. **Confirmado** (contrato, `resolveIngestionTask`).
- `RESOLVED` conta como terminada: aparece no filtro "Concluídas", fora de "Precisam de atenção", e
  na barra como "Resolvidas à mão", num verde mais apagado que o das concluídas
  (`taskCounts.resolved`).

## Painel da tarefa

Clicar numa tarefa abre um painel lateral (`?tarefa=<id>` na URL), que fecha com Esc ou clique
fora. Ele lê `getIngestionTask` e mostra cada execução de etapa — status, tentativa, duração — com a
linha do tempo dos eventos: ícone por tipo, a `message` pronta do backend e, recolhidos, os
`details` em JSON. Etapas que não rodaram aparecem no fim, apagadas. Uma tarefa parada mostra em que
etapa parou, o botão Resolver e "Marcar como resolvida"; as demais, um atalho para o item no
catálogo.

O stream só entrega os eventos de uma etapa quando ela termina (`STEP_FINISHED`). Por isso, enquanto
a tarefa aberta está rodando, o painel recarrega o detalhe a cada 2 s para mostrar a etapa em
andamento.

## Lacunas no backend

Levantadas para o mantenedor:

- `IngestionSummary` não traz o provedor, o diretório nem o tipo do conteúdo de cada ingestão: a
  tela identifica uma ingestão só pelo número e pela data.
- `GET /v1/ingestion` devolve todas as tarefas de cada ingestão da página, o que torna o histórico
  pesado; o ideal seria a listagem só com o resumo e as tarefas por um endpoint paginado.
- Não há `GET /v1/ingestion/{id}`: abrir uma ingestão antiga pelo número exige percorrer o
  histórico.
- As datas não têm formato único: o `TASK_UPDATED` que abre ou fecha uma tarefa manda `startedAt`/
  `completedAt` com fuso (`2026-11-09T09:46:51-03:00`), e o REST e os demais eventos em UTC
  (`...T12:46:51Z`). O portal compara sempre o instante (`Date.parse`), nunca o texto.
- Não há como refazer nem cancelar uma tarefa: uma `FAILED` não roda de novo, e uma
  `WAITING_CURATION` só pode ser marcada como resolvida, não reprocessada.

## Navegador de pastas (`FolderBrowser`)

Mostra a árvore de pastas do provedor (`listAvailableFolders`), com as pastas que já estão no
catálogo marcadas como "No catálogo", e devolve o caminho escolhido para o campo de diretório.
Abre com os ancestrais do diretório atual expandidos.

A árvore inteira do provedor é pedida de uma vez (o portal não usa o parâmetro `rootPath` da
operação para carregar por partes) e fica em cache por 1 minuto. Num provedor remoto grande, a
primeira abertura pode demorar. **Aceito** (confirmado pelo mantenedor): o tamanho atual dos
provedores não justifica carregar por partes.
