# src/features/notifications

Estado ao vivo das notificações, compartilhado pelo app inteiro: contador de não lidas (menu e
cabeçalho), aviso de notificação nova no topo do conteúdo, destaque das que acabaram de chegar e a
lista da tela de Notificações atualizada sem recarregar.

| Arquivo                                                  | Papel                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`NotificationsProvider.tsx`](NotificationsProvider.tsx) | Escuta o stream de notificações e expõe o estado via `useNotificationsLive()`.                          |
| [`level.ts`](level.ts)                                   | Rótulo, tom e ícone de cada nível (`LEVEL`) e o título exibido de uma notificação (`notificationHead`). |

O `NotificationsProvider` fica no [`App.tsx`](../../App.tsx), envolvendo as rotas, então o stream
fica aberto em qualquer tela.

## Stream e estado (`NotificationsProvider`)

- Escuta `/v1/notifications/events` (evento `NEW`) com o `useEventSource`
  ([`src/api/README.md`](../../api/README.md#streams-sse)). Diferente do cache, o backend mantém a
  conexão aberta esperando os próximos eventos, sem snapshot nem fechamento por ociosidade.
  **Confirmado** (`NotificationEventBroadcaster.subscribe` no backend).
- Não há replay: a cada (re)conexão o portal invalida as queries de `/v1/notifications` e recarrega
  pelo REST o que tiver sido perdido.
- Para cada notificação nova, sem esperar o REST:
  - soma 1 ao contador de não lidas no cache do React Query (se ela já não vier lida);
  - insere a notificação no topo da primeira página da lista infinita da tela de Notificações
    (chave `NOTIFICATIONS_INFINITE_KEY`), se essa lista já estiver carregada e ela ainda não
    estiver lá;
  - invalida as demais listas de notificações, como a da Home;
  - marca o id como "fresco" por 6 s, para a tela destacar a linha;
  - mostra o aviso no topo do conteúdo por 6 s (o `AppLayout` renderiza); uma notificação nova
    substitui a anterior no aviso.
- O contador de não lidas também é recarregado ao voltar o foco para a janela e considerado fresco
  por 10 s.

`useNotificationsLive()` devolve `unread`, o `status` do stream, os ids `fresh`, o `banner` atual e
`dismissBanner()`; fora do provider, lança erro.

## Níveis e título (`level.ts`)

- `LEVEL` mapeia `INFO`, `WARNING` e `ERROR` para "Info", "Aviso" e "Erro", com o tom de chip e o
  ícone de cada um.
- `notificationHead(n)` usa o título do anime quando a notificação é sobre um título; senão,
  "Falha na ingestão" para erro e "Ingestão" para os demais níveis. Isso vale porque hoje toda
  notificação nasce na ingestão. **Confirmado** (no backend, `NotificationService.notify` só é
  chamado por `IngestionService` e `FolderAutoBindService`). Uma origem nova de notificação exige
  revisar esse texto.

## Observações

- **Aviso em sequência.** Numa ingestão com várias falhas, as notificações chegam em rajada e o
  aviso do topo troca a cada uma, mostrando só a última por 6 s. **Aceito** (confirmado pelo
  mantenedor): o aviso só chama a atenção; o detalhe fica na tela de Notificações.
- **Sem heartbeat.** O stream de notificações não manda nada enquanto não há notificação nova.
  Num proxy que corta conexões ociosas, a conexão cai e o portal reconecta (e recarrega pelo REST)
  sozinho. **Aceito** (confirmado pelo mantenedor): a reconexão com recarga pelo REST basta, sem
  heartbeat no backend.
