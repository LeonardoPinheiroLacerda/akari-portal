# src/api

Camada de acesso ao backend `akari`: o cliente gerado pelo Orval, o mutator HTTP que ele usa, o
tratamento de erros, o React Query e os streams SSE. As telas não chamam `fetch` direto — usam os
hooks gerados e, para os streams, o `useEventSource`.

| Arquivo                   | Papel                                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| [`generated/`](generated) | Cliente do Orval: funções, hooks do React Query e tipos de todo o contrato. |
| [`http.ts`](http.ts)      | Mutator do Orval (`http`), base da API (`apiUrl`) e o erro `HttpError`.     |
| [`errors.ts`](errors.ts)  | Mensagens amigáveis, toast de erro e erros de validação nos formulários.    |
| [`query.ts`](query.ts)    | `QueryClient` do app e os grupos de invalidação.                            |
| [`sse.ts`](sse.ts)        | Tipos dos eventos SSE e o hook `useEventSource`.                            |

## Cliente gerado (`generated/`)

Gerado pelo Orval a partir do contrato que o backend serve em `/q/openapi` (endereço de
`AKARI_API_URL`, padrão `http://localhost:8080`), com a configuração de
[`orval.config.ts`](../../orval.config.ts): um arquivo por tag do contrato em
`generated/endpoints/<tag>/` e os tipos em `generated/model/`, hooks do TanStack Query com
`AbortSignal` e todas as chamadas passando pelo mutator `http`.

Não é editado à mão: o Orval apaga a pasta e recria tudo a cada geração. Para trazer uma mudança do
contrato, com o backend no ar:

```bash
npm run api:generate
```

Depois, `npm run typecheck` aponta as telas que precisam acompanhar a mudança (operação renomeada,
campo novo obrigatório etc.). O cliente gerado fica commitado, então rodar e buildar o portal não
precisa do backend.

## HTTP (`http.ts`)

- A base vem de `VITE_API_BASE_URL`; vazia, as chamadas vão para a mesma origem do portal (em
  desenvolvimento o Vite repassa `/v1` ao backend). `apiUrl(path)` monta a URL e também é usada
  fora do Orval: SSE, playlist HLS do player.
- Toda resposta fora de 2xx vira `HttpError`, com o `status` e o corpo `ApiError` do backend
  (`code`, `message`, `details`) quando ele veio em JSON.
- `204` ou corpo vazio devolvem `undefined`; JSON é parseado; o resto volta como texto.

## Erros (`errors.ts`)

- `errorMessage` prefere a `message` do `ApiError`, que o backend já escreve para o usuário. Sem
  ela, usa um texto genérico para 5xx e uma mensagem de "servidor fora do ar" para falha de rede
  (`TypeError` do `fetch`).
- `toastError(e, título?)` mostra o erro num toast; com título, a mensagem vai na descrição.
- `errorStatus` / `errorCode` servem para decidir o tratamento — o contrato pede que o cliente
  chaveie pelo `code` (`ApiErrorCode`), nunca pelo texto da `message`. O `status` é usado onde o
  código não basta (ex.: `404` como "sem vínculo" no item do catálogo).
- `applyFieldErrors` leva os `details` de um `VALIDATION_ERROR` para os campos de um formulário do
  React Hook Form, com um mapa opcional do caminho do backend (ex.: `config.password`) para o nome
  do campo.

## React Query (`query.ts`)

- Dados ficam frescos por 30 s e não são recarregados ao voltar o foco para a janela.
- Erros 4xx não são repetidos; os demais, até 2 vezes.
- **Invalidação por prefixo.** As chaves geradas pelo Orval começam pela URL da operação, então
  `invalidatePrefixes('/v1/cache/')` derruba toda query cuja URL comece com esse prefixo. O objeto
  `invalidate` agrupa os prefixos usados depois de cada mutação (`catalog`, `anime`, `tmdb`,
  `videoFiles`, `providers`, `notifications`, `cache`, `settings`). Invalidar por grupo amplo
  refaz mais queries do que a mutação afetou. **Aceito** (confirmado pelo mantenedor): a
  simplicidade vale mais que as requisições extras.

## Streams SSE (`sse.ts`)

Os streams `/v1/cache/events` e `/v1/notifications/events` não estão no OpenAPI (são code-first no
backend), então os tipos ficam aqui, escritos à mão. **Confirmado**: `CacheEvent` e
`NotificationEvent` batem campo a campo com os records Java de mesmo nome no backend
(`domain/cache/sse/CacheEvent.java`, `domain/notification/sse/NotificationEvent.java`), e o nome
de cada evento SSE é o `type` do evento (`CacheEventBroadcaster.java:126`). Quando o backend muda
um evento, o tipo daqui precisa ser ajustado à mão. **Backlog real** (confirmado pelo mantenedor):
o backend deveria publicar o esquema dos eventos para o portal gerar esses tipos, como faz com o
resto do contrato.

`useEventSource(path, opções)` abre um `EventSource` e devolve `status` (`connecting`, `open`,
`idle`, `error`), `lastEventAt` e `reconnect()`:

- Escuta os nomes de evento passados em `events` e entrega o JSON parseado em `onMessage`.
- `onOpen` roda a cada (re)conexão — é onde a tela recarrega o estado pelo REST, porque nenhum dos
  streams tem replay do que foi perdido.
- Em erro, reconecta com espera exponencial (2 s, 4 s… até 30 s).
- `closeOn` fecha a conexão quando um evento indica que não há mais nada a acompanhar, e o hook
  reconecta depois de `idleRetryMs` (15 s por padrão). É o caso do cache: o backend manda `IDLE` e
  fecha o stream quando a fila esvazia, e também logo na inscrição quando não há nada ativo
  (**Confirmado**, `CacheEventBroadcaster.java:30-50`). Com a fila vazia, a tela de Cache reabre o
  stream a cada 15 s para perceber downloads novos. **Aceito** (confirmado pelo mantenedor): a
  reconexão é barata e só acontece com a tela aberta.
- `reconnect()` força a reconexão na hora — usado depois de reenfileirar um download, para não
  esperar os 15 s.

## Observações técnicas

- O `fetch` do mutator não tem timeout: uma chamada que o backend demora a responder (ex.:
  listagem de um provedor remoto lento) fica carregando até o navegador desistir. **Backlog real**
  (confirmado pelo mantenedor): falta um timeout padrão nas chamadas.
