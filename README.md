# Akari · Portal Administrativo

Portal web do administrador do **Akari**, serviço de streaming centrado em animes. É por aqui que
o admin:

- cadastra os provedores de arquivos (MEGA, disco local);
- ingere diretórios no catálogo;
- faz a curadoria dos títulos: vínculo com a AniList e o TMDB, overrides de título, sinopse e
  imagens, pareamento dos arquivos com os episódios do TMDB e status de revisão;
- testa a reprodução;
- acompanha o cache de vídeo e as notificações;
- ajusta as preferências do sistema.

O portal é só o cliente: as regras e os dados ficam no backend [`akari`](../akari) (Quarkus), e o
contrato entre os dois é o [`openapi.yaml`](openapi.yaml), cópia do
`src/main/resources/META-INF/openapi.yaml` do backend.

## Documentação

- [`docs/OBJETIVO_DO_SISTEMA.md`](docs/OBJETIVO_DO_SISTEMA.md) — propósito, fluxos, atores e visão
  de produto.
- [`docs/ARQUITETURA_DO_SISTEMA.md`](docs/ARQUITETURA_DO_SISTEMA.md) — camadas, regras, fluxo entre
  as camadas, dependências, riscos e diretrizes para novas telas.
- Um `README.md` em cada pasta de `src/` com o detalhe daquela área.

## Stack

- **React 19 + Vite + TypeScript**, com React Router para as rotas da SPA.
- **TanStack Query** para o estado remoto, cache e invalidação.
- **Orval**: cliente HTTP, tipos e hooks do TanStack Query gerados do `openapi.yaml`, em
  `src/api/generated`.
- **EventSource (SSE)** nativo para os streams `/v1/cache/events` e `/v1/notifications/events`.
- **hls.js** no player da aba Reprodução.
- **Tailwind CSS** com os tokens do design em variáveis CSS (tema escuro e claro), e componentes
  sobre **Radix UI**.
- **React Hook Form + Zod** nos formulários; **Sonner** para as notificações na tela.
- Interface em **português (pt-BR)**.

## Como rodar

Pré-requisitos: Node.js e o backend `akari` rodando (por padrão em `http://localhost:8080`).

```bash
npm install
npm run dev
```

O portal sobe em `http://localhost:5173`. Em desenvolvimento o Vite repassa `/v1` para o backend
([`vite.config.ts`](vite.config.ts)), então portal e API ficam na mesma origem. O proxy força o
envio imediato dos headers dos streams SSE, sem o que o `EventSource` não abre enquanto o stream
não manda o primeiro evento.

### Variáveis de ambiente

| Variável            | Quando | Uso                                                                        |
| ------------------- | ------ | -------------------------------------------------------------------------- |
| `AKARI_API_URL`     | dev    | Endereço do backend para o proxy do Vite. Padrão: `http://localhost:8080`. |
| `VITE_API_BASE_URL` | build  | Base das chamadas à API. Vazio (padrão) = mesma origem do portal.          |

Com `VITE_API_BASE_URL` apontando para outra origem, o backend precisa liberar a origem do portal
no CORS (`CORS_ORIGINS` no backend; padrão `http://localhost:5173`). **Confirmado**
(`../akari/src/main/resources/application.properties:12-17`).

## Scripts

| Script                            | O que faz                                                            |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento.                                         |
| `npm run build`                   | Checagem de tipos e build de produção em `dist/`.                    |
| `npm run preview`                 | Serve o build localmente.                                            |
| `npm run typecheck`               | Só a checagem de tipos.                                              |
| `npm run lint` / `lint:fix`       | ESLint.                                                              |
| `npm run lint:oxlint`             | Oxlint.                                                              |
| `npm run format` / `format:check` | Prettier.                                                            |
| `npm run api:sync`                | Copia o `openapi.yaml` do backend (`../akari`) e regenera o cliente. |
| `npm run api:generate`            | Só regenera o cliente a partir do `openapi.yaml` local.              |

## Estrutura

```
src/
  api/            cliente HTTP, SSE, React Query e invalidação
    generated/    cliente do Orval (não editar à mão)
  components/
    ui/           componentes base (botão, chip, diálogo, select…)
    layout/       sidebar, header, título da página
    domain/       componentes ligados a um conceito do domínio
  features/       lógica compartilhada por área (providers, settings, notifications, playback, item)
  pages/          uma pasta por tela
  lib/            utilitários (formatação, armazenamento local, debounce)
```

### Telas

| Rota                       | Tela                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `/`                        | Home                                                                                  |
| `/catalogo`                | Catálogo de pastas, com filtros de curadoria                                          |
| `/catalogo/:folderId/:aba` | Item do catálogo: abas AniList, TMDB, TMDB Overrides, TMDB Episódio Pair e Reprodução |
| `/cache`                   | Fila de downloads e arquivos em cache                                                 |
| `/provedores`              | Provedores de arquivos                                                                |
| `/ingestao`                | Ingestão de diretórios                                                                |
| `/preferencias`            | Preferências do sistema                                                               |
| `/notificacoes`            | Notificações                                                                          |

## Integração com o backend

Resumo abaixo; os detalhes e as decisões ficam em [`src/api/README.md`](src/api/README.md).

- **Contrato e cliente gerado.** O `openapi.yaml` é a fonte dos tipos e hooks. Ao mudar o contrato
  no backend, rode `npm run api:sync` e ajuste as telas ao que mudou. O cliente gerado não é
  editado à mão: o Orval apaga e recria `src/api/generated` a cada geração.
- **Streams SSE.** `/v1/cache/events` e `/v1/notifications/events` não estão no OpenAPI (são
  code-first no backend), então os tipos dos eventos ficam escritos à mão em
  [`src/api/sse.ts`](src/api/sse.ts). O stream do cache não tem replay nem heartbeat: a cada
  (re)conexão o portal recarrega o estado pelo REST.
- **Invalidação.** As chaves do React Query geradas pelo Orval começam pela URL; depois de cada
  mutação o portal invalida por prefixo de URL, nos grupos de [`src/api/query.ts`](src/api/query.ts).
- **Erros.** Todo erro da API chega como `HttpError` com o corpo `ApiError` do backend
  ([`src/api/http.ts`](src/api/http.ts)); erros 4xx não são repetidos automaticamente.

## Convenções

- Textos da interface em português, sem jargão técnico nem nomes de endpoint.
- O visual segue a variação **A · Lanterna** do protótipo de design (handoff mantido fora do repositório).
- Preferências do navegador ficam no `localStorage` com prefixo `akari.`: tema, menu expandido,
  painel de filtros do catálogo e o último teste de conexão de cada provedor.
- Formatação com Prettier e lint com ESLint (configurações na raiz).
- As skills do projeto em `.claude/skills` cobrem mensagens de commit (`commit-message`) e a escrita
  e curadoria da documentação (`docs-style`, `docs-interview`).

## Estado atual e limitações

Resumo; as decisões completas ficam em [`docs/OBJETIVO_DO_SISTEMA.md`](docs/OBJETIVO_DO_SISTEMA.md)
(contexto operacional) e [`docs/ARQUITETURA_DO_SISTEMA.md`](docs/ARQUITETURA_DO_SISTEMA.md) (riscos
e regras).

- **Sem autenticação** — **Aceito**: não há login no portal nem no backend.
- **Hospedagem separada do backend**, por servidor estático, com `VITE_API_BASE_URL` e a origem
  liberada no CORS do backend. O backend não serve o build, e o servidor estático precisa devolver o
  `index.html` para qualquer rota da SPA (ex.: `/catalogo/123/anilist`).
- **Regras de negócio no cliente** — **Backlog real**: devem migrar para o backend aos poucos.
- **Sem testes automatizados** — **Backlog real**.
