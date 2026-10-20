# src/features/playback

Sessão de reprodução da aba Reprodução do item ([`PlaybackTab`](../../pages/item/PlaybackTab.tsx)):
inicia o transcode no backend, toca a playlist HLS no `<video>`, mantém a sessão viva e cuida de
mudar a posição e as faixas.

| Arquivo                                          | Papel                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| [`usePlaybackSession.ts`](usePlaybackSession.ts) | Hook `usePlaybackSession(videoRef)` com o ciclo de vida da sessão e o player. |

## Ciclo da sessão

`usePlaybackSession` devolve `start`, `seek`, `switchTracks`, `reset` e o estado: `status`
(`idle`, `starting`, `loading`, `playing`, `expired`, `error`), a sessão ativa, a posição na mídia,
o TTL e o vencimento do heartbeat e um log de eventos que a aba mostra.

1. **Início** — `start(fileId, perfil, faixas)` cria a sessão no backend, que devolve o id, a URL
   da playlist e o instante em que o transcode começou (`startOffsetSeconds`).
2. **Espera da playlist** — a playlist só existe depois que o transcode produz o primeiro
   segmento; até lá o backend responde `404`, o mesmo código de sessão inexistente ou expirada.
   **Confirmado** (`openapi.yaml`, operação da playlist). O hook tenta de novo com espera crescente
   (0,5 s até 3 s entre tentativas, 40 tentativas no máximo) e desiste com erro depois disso.
3. **Player** — com a playlist pronta, carrega no hls.js (ou no HLS nativo do Safari). Segmentos
   ainda não gerados também respondem `404`; o hls.js é configurado para tentar de novo na borda
   ao vivo em vez de falhar. Se a sessão tem legenda, liga a primeira faixa de legenda do HLS.
4. **Heartbeat** — o TTL vem do header `X-Playback-Heartbeat-Ttl-Seconds` da playlist e, depois,
   do corpo de cada heartbeat; nunca é fixo no portal. O hook pinga na metade do prazo (mínimo
   2 s). `404` no heartbeat marca a sessão como expirada; outro erro tenta de novo em 4 s.
5. **Posição e faixas** — a posição na mídia é `startOffsetSeconds + currentTime` do player.
   - `seek(posição)` pede ao backend; se o `startOffsetSeconds` devolvido mudou, o transcode
     recomeçou naquele ponto e o player recarrega a playlist; senão, só move o `currentTime`.
   - `switchTracks(faixas)` sempre reinicia o transcode na posição atual e recarrega o player.
6. **Fim** — `reset()` para o heartbeat e o player e limpa o estado. Não existe operação para
   encerrar a sessão: o backend a descarta quando o heartbeat para e o TTL vence. **Confirmado**
   (`openapi.yaml`: não há `DELETE` em `/v1/playback/sessions`).

## Regras do contrato que o hook respeita

- Os índices de faixa (`audioTrackIndex`, `subtitleTrackIndex`) são a posição 0-based da faixa nos
  arrays `audio` e `subtitles` do probe de mídia, não o campo `index` de cada faixa. **Confirmado**
  (`openapi.yaml`, schema do pedido de sessão).
- Se a legenda vai como faixa selecionável ou queimada no vídeo é decidido pelo backend, pelo
  formato da legenda; o portal não escolhe.
- Os perfis de transcode são `WEB`, `TV` e `MOBILE` (tipo `Profile` no hook). O contrato declara o
  `profile` como texto livre — "os profiles suportados pelo backend" — sem listar os valores; a
  lista vem do enum `Profile` do backend. **Confirmado** (`FullTranscodeHlsStrategy.java:35`).
  **Backlog real** (confirmado pelo mantenedor, pela política geral de regras de negócio no cliente
  de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais)): a lista de perfis deveria vir
  do contrato (como enum) em vez de ser repetida no portal.

## Observações

- **Sessão órfã.** Fechar a aba ou trocar de tela durante a reprodução não encerra a sessão na
  hora: o transcode continua no backend até o TTL do heartbeat vencer (30 s por padrão, preferência
  `playback.session.heartbeat-ttl`). **Aceito** (confirmado pelo mantenedor): esperar o TTL é
  suficiente, sem operação de encerrar sessão.
- **`404` ambíguo.** Playlist ainda não pronta, sessão expirada e sessão inexistente respondem
  todos `404` com o mesmo código; só o texto da mensagem muda. O portal trata qualquer `404` da
  playlist como "ainda não ficou pronta" até esgotar as tentativas — uma sessão que já expirou só
  aparece como erro depois de todas elas. **Backlog real** (confirmado pelo mantenedor): o backend
  deveria diferenciar os casos por código de erro, e o portal passar a chavear por ele.
