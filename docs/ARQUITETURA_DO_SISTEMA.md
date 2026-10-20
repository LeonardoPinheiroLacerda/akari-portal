# Arquitetura do Sistema — akari-portal

> Visão técnica do portal no nível do projeto inteiro. O porquê do produto fica em
> [`OBJETIVO_DO_SISTEMA.md`](OBJETIVO_DO_SISTEMA.md); o detalhe de cada pasta, nos `README.md` de
> `src/`. Inferências não confirmadas estão marcadas como **Hipótese**; decisões do mantenedor, como
> **Aceito** ou **Backlog real**. Ao mudar a arquitetura, atualize este arquivo e os `README.md`
> afetados juntos.

## Visão arquitetural do projeto

O portal é uma **SPA React** (Vite + TypeScript) que fala só com o backend `akari`. Não tem servidor
próprio, banco nem regra de negócio de domínio — é um cliente:

- **Contrato como fonte.** O Orval lê o contrato direto do backend (`/q/openapi`) e gera dele o
  cliente HTTP, os tipos e os hooks do TanStack Query (`src/api/generated`). Mudou o contrato →
  `npm run api:generate` com o backend no ar → `npm run typecheck` aponta o que acompanhar.
- **Estado remoto no TanStack Query.** Não há store global de dados: cada tela usa os hooks
  gerados, e as mutações invalidam grupos de queries por prefixo de URL.
- **Tempo real por SSE.** Dois streams do backend, fora do contrato: o da fila de cache (só na tela
  de Cache) e o de notificações (aberto o tempo todo, num provider na raiz do app).
- **Reprodução por HLS.** A aba Reprodução cria uma sessão de transcode no backend e toca a
  playlist com hls.js.

## Padrões utilizados

- Hooks gerados pelo Orval para toda chamada REST, com um mutator próprio (`src/api/http.ts`) que
  transforma resposta fora de 2xx em `HttpError` com o corpo `ApiError`.
- Componentes base próprios sobre primitivos do Radix UI, estilizados com Tailwind e os tokens do
  design em variáveis CSS (temas escuro e claro).
- Formulários com React Hook Form + Zod; erros de validação do backend voltam para o campo.
- Estado de tela local (rascunhos, painéis) em `useState`; filtros e paginação na URL; preferências
  do navegador no `localStorage` com prefixo `akari.`.
- Contexto React só onde o estado é do app inteiro: notificações ao vivo e o título da página.

## Regras arquiteturais

- **Camadas e direção das dependências** (ver "Fluxo de comunicação"): `pages` usa `features`,
  `components` e `api`; `features` usa `api`; nenhuma camada importa `pages`. Uma página não importa
  outra página e uma feature não importa outra feature. **Confirmado** (busca dos imports em `src/`).
- **Cliente gerado é intocável** — o Orval apaga e recria `src/api/generated`; nada é editado à mão.
- **Regras de negócio ficam no backend.** As que ainda são calculadas no portal são **Backlog real**
  (confirmado pelo mantenedor) para migrar aos poucos — vale para qualquer regra desse tipo, sem
  nova decisão caso a caso. Estão listadas em "Riscos técnicos".
- **Só tokens do design** em cores e tamanhos; nunca cor fixa. Os dois temas funcionam por isso.
- **Textos em português e sem jargão**: nada de nome de endpoint ou valor de enum cru na interface.
- **Só o que é usado**: componentes e dependências entram quando uma tela precisa deles
  (confirmado pelo mantenedor).

## Convenções técnicas

- Alias `@/` para `src/`. Formatação com Prettier (aspas simples, sem ponto e vírgula, 130 colunas,
  classes do Tailwind ordenadas) e lint com ESLint (`typescript-eslint`, hooks do React,
  `eslint-config-prettier`). As regras do React Compiler ficam como aviso.
- Comentários e documentação descrevem o estado atual e o porquê não óbvio, nunca o histórico (skill
  `docs-style`). Commits seguem a skill `commit-message`.
- Ver [`README.md`](../README.md) para scripts, variáveis de ambiente e estrutura de pastas.

## Separação de responsabilidades

| Camada                  | Responsabilidade                                                            | README                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/api`               | Cliente gerado, mutator HTTP, erros, React Query e invalidação, streams SSE | [`src/api`](../src/api/README.md)                                                                                                                                                                                                                            |
| `src/components/ui`     | Componentes base visuais, sem conhecimento de domínio                       | [`ui`](../src/components/ui/README.md)                                                                                                                                                                                                                       |
| `src/components/layout` | Moldura do app: menu, cabeçalho, título da página                           | [`layout`](../src/components/layout/README.md)                                                                                                                                                                                                               |
| `src/components/domain` | Componentes visuais ligados a um conceito do domínio                        | [`layout`](../src/components/layout/README.md)                                                                                                                                                                                                               |
| `src/features/*`        | Lógica compartilhada por área, sem tela própria                             | [`providers`](../src/features/providers/README.md), [`settings`](../src/features/settings/README.md), [`notifications`](../src/features/notifications/README.md), [`playback`](../src/features/playback/README.md), [`item`](../src/features/item/README.md) |
| `src/pages/*`           | Uma pasta por tela: compõe features e componentes, guarda o estado da tela  | um README por tela                                                                                                                                                                                                                                           |
| `src/lib`               | Utilitários sem domínio (formatação, `localStorage`, debounce, `cn`)        | —                                                                                                                                                                                                                                                            |

## Fluxo de comunicação entre as camadas

```
pages/*  ──►  features/*  ──►  api (generated, http, sse, query)  ──►  backend akari
   │              │                ▲
   │              └─► components/ui│
   ├─► components/layout ──► features/notifications
   ├─► components/domain ──► features/notifications
   └─► components/ui ──► api/errors (só a mensagem do ErrorState)
lib  ◄── todas as camadas
```

- **REST:** tela → hook gerado (direto ou via feature) → `http` → backend. Depois de uma mutação, a
  tela invalida o grupo de queries afetado (`invalidate.*`).
- **SSE:** `useEventSource` (`src/api/sse.ts`) abre o stream; o handler atualiza o cache do React
  Query ou estado local, e a cada (re)conexão a tela recarrega pelo REST, porque nenhum stream tem
  replay.
- **Exceções à direção das camadas:** `components/layout` e `components/domain` importam
  `features/notifications` (contador de não lidas, nível da notificação), e `components/ui` importa
  `api/errors` para a mensagem de erro padrão. **Confirmado**. **Backlog real** (confirmado pelo
  mantenedor): mover esses componentes (ou o que eles usam) para respeitar a direção das camadas.

## Dependências críticas

- **Contrato do backend** (`/q/openapi`) — toda tela depende dele; o portal fica defasado até rodar
  `npm run api:generate`, que só funciona com o backend no ar. O cliente gerado fica commitado, então
  rodar e buildar o portal não precisa do backend.
- **Streams SSE code-first** — tipos escritos à mão em `src/api/sse.ts`, espelhando os records Java.
  **Backlog real** (confirmado pelo mantenedor): o backend deveria publicar o esquema dos eventos.
- **CDN do TMDB e da AniList** — imagens carregadas direto pelas URLs que a API devolve; a imagem
  em tamanho original depende do formato da URL do TMDB (**Backlog real**: a API deveria entregar
  essa URL).
- **Bibliotecas centrais** — React, React Router, TanStack Query, Orval, hls.js, Radix UI, Tailwind,
  React Hook Form, Zod, Sonner, DOMPurify (sinopse da AniList).

## Riscos técnicos e acoplamentos importantes

**Regras de negócio no cliente** — **Backlog real** (confirmado pelo mantenedor), detalhadas nos
READMEs:

- catálogo de tipos de provedor e seus campos (`features/providers`);
- metadados das preferências (rótulo, tipo, valores aceitos) (`pages/preferences`);
- perfis de transcode (`features/playback`);
- proposta de auto-pair e árvore de relações da franquia, com as limitações conhecidas da árvore
  (`features/item`);
- troca de vínculo AniList/TMDB em duas chamadas não atômicas, aplicação do auto-pair um par por
  requisição, legenda selecionável ou queimada deduzida pelo codec (`pages/item`);
- ações em massa do cache, um `DELETE` por linha (`pages/cache`).

**Lacunas do contrato ou do backend que afetam o portal** — **Backlog real**, correção no `akari`:

- remover um provedor que ainda tem pastas falha por chave estrangeira (`pages/providers`);
- remover um trecho do catálogo deixa os arquivos em cache órfãos no disco (`pages/ingestion`);
- `404` ambíguo na reprodução (`features/playback`);
- listagem do cache sem filtro por arquivo (`pages/item`, aba Reprodução);
- chamadas sem timeout no mutator (`src/api`).

**Outros acoplamentos aceitos** (**Aceito**, confirmado pelo mantenedor): invalidação por grupo
amplo, reconexão periódica do stream de cache ocioso, último teste de conexão guardado só no
navegador, edição de provedor começando vazia.

**Sem testes automatizados.** **Backlog real** (confirmado pelo mantenedor): começar pelas regras
calculadas no cliente.

## Diretrizes para futuras implementações

- **Tela nova:** uma pasta em `src/pages/<tela>` com o próprio `README.md`, rota em `App.tsx`,
  entrada em `NAV` no `Sidebar` se for de navegação, e `usePageMeta` para o título.
- **Lógica usada por mais de uma tela** vai para `src/features/<área>`; componente visual genérico,
  para `src/components/ui`.
- **Mudança de contrato:** `npm run api:generate` com o backend no ar, ajustar as telas, e invalidar o grupo certo depois
  das mutações novas.
- **Regra de negócio nova:** pedir no backend em vez de calcular no portal; se precisar ficar no
  cliente por ora, registrar no README da área e em "Riscos técnicos".
- **Texto novo na interface:** português, sem jargão, com os rótulos dos enums nos mapas de
  `features/*` (ex.: `REVIEW`, `MEDIA_TYPE_LABEL`).
- **Antes de dar por pronto:** `npm run typecheck`, `npm run lint` e `npm run format:check`, e
  conferir a tela no preview.
