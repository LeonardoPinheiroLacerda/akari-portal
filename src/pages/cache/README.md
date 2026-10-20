# src/pages/cache

Tela **Cache** (`/cache`): acompanha a fila de downloads do cache de vídeo e os arquivos já
baixados. Arquivos de provedor remoto (MEGA) precisam estar no cache para tocar; os de provedor
local são lidos direto do disco e nunca passam por aqui.

| Arquivo                          | Papel                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`CachePage.tsx`](CachePage.tsx) | Fila de downloads ao vivo, arquivos em cache e as ações de cancelar, tentar de novo e deletar. |

## Fila de downloads

- Lista as linhas pendentes (`pendingOnly`: na fila, baixando ou com falha), ordenadas por estado
  (baixando, na fila, falhou) e pela ordem de entrada. O backend baixa um arquivo por vez.
- O progresso chega pelo stream `/v1/cache/events` ([`src/api`](../../api/README.md#streams-sse)):
  `PROGRESS` atualiza bytes, velocidade e tempo restante só em memória; `QUEUED`, `COMPLETED`,
  `FAILED`, `EVICTED`, `CANCELLED`, `DELETED` e `IDLE` recarregam a lista pelo REST. Um chip mostra
  se o stream está "Ao vivo", "Fila ociosa", "Conectando…" ou "Reconectando…", com a hora do último
  evento.
- Enquanto o rclone ainda não começou a transferir — por exemplo, logo depois de reiniciar, quando
  refaz o login no MEGA —, o backend informa `totalBytes` zero e a linha mostra "Conectando ao
  provedor" com o tamanho do arquivo do catálogo.
- **Tentar de novo** (linhas com falha) reenfileira o mesmo arquivo — o backend reaproveita o id da
  linha — e reabre o stream na hora, sem esperar a reconexão periódica.
- **Cancelar** (na fila ou baixando) pede confirmação na própria linha; o backend interrompe o job
  do rclone e apaga o arquivo parcial.

## Arquivos em cache

- Lista os downloads concluídos, dos mais recentes para os mais antigos, com episódio, origem,
  qualidade (deduzida do nome do arquivo, ex.: `1080p`, ou do formato), tamanho e data do pedido; o
  topo soma a quantidade e o tamanho total.
- Clicar numa linha abre a aba Reprodução do título.
- A lixeira de cada linha pede confirmação e apaga o arquivo do disco.

## Ações em massa

**Cancelar tudo** (na fila) e **Deletar tudo** (em cache) pedem confirmação num diálogo e chamam o
`DELETE` de cada linha, uma por vez, com uma barra de progresso. Antes, buscam a lista completa no
backend, página a página. O cancelamento tira as linhas da fila antes do download em andamento,
para o backend não começar o próximo no meio do processo. Linhas que mudaram de estado no caminho
(`400`) ou já sumiram (`404`) contam como ignoradas no resumo final.

Não há operação em lote no contrato. **Backlog real** (confirmado pelo mantenedor, pela política
geral de regras de negócio no cliente de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais)): as ações em massa deveriam ser uma
operação do backend. Se a página for fechada no meio, a operação para onde estava.

## Regras do backend que a tela respeita

**Confirmado** (contrato, tag Cache, e `CacheQueueProcessorService` no backend):

- Só linhas na fila ou baixando podem ser canceladas, e só arquivos concluídos podem ser deletados;
  uma linha com falha não pode ser removida (`400`) — só reenfileirada.
- Ao enfileirar um download novo, o backend apaga os arquivos concluídos usados há mais tempo até
  caber no limite `cache.max-size-bytes` (eviction LRU), e avisa com `EVICTED`.

## Observações

- **Falhas não somem.** Uma linha com falha não pode ser removida nem é apagada pela eviction LRU,
  que só considera arquivos concluídos (`findCompletedOrderByFetchedAtAsc`): ela fica na fila até
  alguém tentar de novo. **Confirmado** (contrato, `deleteCacheItem`). **Aceito** (confirmado
  pelo mantenedor): a falha serve de lembrete até ser reenfileirada.
- **Limite da listagem.** A tela mostra até 200 linhas pendentes e até 500 linhas no total, sem
  paginação. **Aceito** (confirmado pelo mantenedor): com o orçamento de cache atual, as listas
  não chegam a esses números.
- **Uma requisição por linha.** Para mostrar o título e o episódio, cada linha pede a pasta e o
  pareamento do arquivo (`getFolder`, `getTmdbFilePairing`), porque a linha do cache só traz o
  arquivo. **Aceito** (confirmado pelo mantenedor): o volume é pequeno e as respostas ficam em cache
  pelo React Query.
