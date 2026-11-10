# src/features/ingestion

Estado ao vivo da ingestão, compartilhado pelo app inteiro, e os rótulos dos status do domínio.

| Arquivo                                                  | Papel                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`IngestionLiveProvider.tsx`](IngestionLiveProvider.tsx) | Escuta o stream `/v1/ingestion/events` e mantém o cache da ingestão atual.                                  |
| [`labels.ts`](labels.ts)                                 | Rótulos e tons dos status, as etapas na ordem (com a aba do item de cada uma), ícones dos eventos.          |
| [`queries.ts`](queries.ts)                               | `useIngestionById` (a atual ao vivo; as demais procuradas no histórico) e o tamanho da página do histórico. |

## Ingestão atual ao vivo

O `IngestionLiveProvider` fica montado em volta do router, então o stream fica aberto em qualquer
tela. `useCurrentIngestion()` devolve a ingestão em andamento, ou a última — `null` se nunca houve
(o `204` de `GET /v1/ingestion/current`) — e `useIngestionLive()` o estado do stream (`status`,
`lastEventAt`).

Cada evento atualiza o cache do React Query, sem recarregar pelo REST:

- `SNAPSHOT` — primeira mensagem de cada conexão: substitui a ingestão inteira. Por isso a
  reconexão não precisa reconciliar pelo REST.
- `INGESTION_UPDATED` — troca status e contagens e mantém as tarefas que o cache já tem, porque o
  evento vem com `tasks` vazio. **Confirmado** (contrato, `IngestionStreamEventType`).
- `TASK_UPDATED` / `STEP_FINISHED` — trocam a tarefa pelo `id` (ou a acrescentam) e a tarefa em
  execução; o `STEP_FINISHED` também acrescenta a execução ao detalhe da tarefa
  (`getIngestionTask`), se ele estiver em cache.

O backend não publica a criação das tarefas, só quando cada uma começa. Quando um
`INGESTION_UPDATED` traz uma ingestão nova, ou mais tarefas (`taskCounts.total`) do que o cache tem,
o provider recarrega a ingestão atual pelo REST, sem cancelar uma recarga em andamento.
**Confirmado** (`domain/ingestion/README.md` do backend, "Pontos de entrada").

Quando uma ingestão começa ou termina, o provider recarrega o histórico (`invalidateHistory`, só as
chaves de `GET /v1/ingestion`). Quando termina, também invalida as consultas de catálogo e de anime,
que as etapas alteraram.
