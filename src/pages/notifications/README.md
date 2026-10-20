# src/pages/notifications

Tela **Notificações** (`/notificacoes`): o histórico das notificações do sistema — hoje, todas
vindas da ingestão (resultado de cada ingestão e falhas de vínculo de cada pasta). O estado ao vivo
(contador, aviso, destaque) fica em
[`src/features/notifications`](../../features/notifications/README.md).

| Arquivo                                          | Papel                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [`NotificationsPage.tsx`](NotificationsPage.tsx) | Lista agrupada por dia, "ver mais", marcar como lida e atalho para o título. |

## Lista

- Página a página, 20 por vez, da mais nova para a mais antiga, com o botão "Ver mais" — o formato
  que o contrato prevê. **Confirmado** (`openapi.yaml`, `listNotifications`). Usa uma
  `useInfiniteQuery` com a chave `NOTIFICATIONS_INFINITE_KEY`, que o provider de notificações
  atualiza quando chega uma nova pelo stream.
- Agrupada em Hoje, Ontem e Anteriores, pelo dia local de criação.
- Uma notificação que chega ao vivo entra no topo da primeira página; como isso desloca a
  paginação do backend, a lista remove ids repetidos ao juntar as páginas.
- Cada linha mostra a capa do título (ou o ícone do nível), o nível (Info, Aviso, Erro), o título
  (`notificationHead`), a mensagem e há quanto tempo chegou. Não lidas têm fundo destacado e um
  ponto; as recém-chegadas ficam com destaque mais forte por alguns segundos.
- O chip do topo mostra se o stream está "Ao vivo" ou "Reconectando…".

## Ações

- **Clicar numa notificação não lida** marca como lida na hora (lista e contador atualizados antes
  da resposta) e confirma no backend; em erro, mostra o toast e recarrega.
- **"Revisar título" / "Abrir pasta no catálogo"** aparece quando a notificação aponta uma pasta
  (`folderId`): marca como lida e abre a aba AniList do item.
- **"Marcar todas como lidas"** chama a operação do backend e zera o contador; fica desabilitado
  sem não lidas.

## Observações

- **Sem limpeza.** Não há como apagar notificações, nem pela tela nem pela API, e o backend não
  expira as antigas — o histórico só cresce. **Confirmado** (`openapi.yaml`: só listagem, contagem
  e marcar como lida). **Aceito** (confirmado pelo mantenedor): o volume é pequeno e o histórico
  completo é útil.
- **Sem filtros.** A lista não filtra por nível nem por lidas/não lidas (a API também não oferece
  esses filtros). **Aceito** (confirmado pelo mantenedor): a lista agrupada por dia basta.
