# Handoff: Akari — Portal Administrativo

## Overview
Portal administrativo do **Akari**, serviço de streaming centrado em animes. É usado pelo admin para:
- cadastrar provedores de arquivos;
- ingerir diretórios no catálogo;
- curar os títulos (vínculos AniList e TMDB, overrides, pareamento de episódios);
- testar a reprodução;
- acompanhar o cache de vídeo e as notificações;
- ajustar as preferências do sistema.

O backend é o projeto `akari` (Quarkus). O contrato está em `src/main/resources/META-INF/openapi.yaml`. Todas as telas deste design foram alinhadas a esse contrato.

## About the Design Files
O arquivo `Portal Admin.dc.html` é uma **referência de design feita em HTML**: um protótipo navegável com dados de exemplo e streams SSE simulados. **Não é código de produção para copiar.** A tarefa é **recriar estas telas no stack definido abaixo**, consumindo a API real.

Para abrir o protótipo, coloque `Portal Admin.dc.html`, `support.js` e `assets/` na mesma pasta e abra o HTML no navegador. No canto inferior direito há um seletor de variações (A/B/C). **A variação escolhida é a A · Lanterna.** As variações B e C devem ser ignoradas.

## Stack alvo
- **React + Vite**, TypeScript.
- **React Router**: rotas da SPA (ver "Rotas").
- **TanStack Query**: estado remoto, cache e invalidação.
- **React Hook Form + Zod**: formulários e validação.
- **Orval**: clientes, tipos e hooks gerados a partir do `openapi.yaml`. Usar os hooks gerados com TanStack Query.
- **EventSource (SSE)**: `/v1/cache/events` e `/v1/notifications/events`. **Esses dois streams são code-first: não estão no OpenAPI**, então os tipos dos eventos devem ser escritos à mão.
- **hls.js**: player da aba Reprodução.
- **Tailwind CSS**: estilos, com os tokens abaixo em `tailwind.config` e variáveis CSS para os dois temas.
- **shadcn/ui** (base Radix): Dialog, Select, Tabs, Switch, RadioGroup, Checkbox, Tooltip, Toast (Sonner), ScrollArea, Collapsible.
- **Sem autenticação** por enquanto.
- Idioma da interface: **português (pt-BR)**.

## Fidelity
**Alta fidelidade.** Cores, tipografia, espaçamentos, raios, estados e textos são finais. Recriar com Tailwind e shadcn/ui ajustando os componentes aos tokens. Exceções:
- Os dados são de exemplo.
- Pôsteres, stills e backdrops são **placeholders listrados**. Usar as URLs reais da API (`thumbnails.*`, `previewUrl`, `defaultStillPreviewUrl`, `coverImageUrl`, `posterUrl`).
- Os textos não devem mencionar endpoints. A interface deve ser amigável, sem jargão técnico.

---

## Design Tokens

### Cores — tema escuro (padrão)
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#13100e` | fundo da página e do header |
| `panel` | `#1b1714` | cards, seções, sidebar |
| `raised` | `#26201c` | chips neutros, trilhas, placeholders |
| `line` | `#2c2622` | bordas e divisores |
| `text` | `#f3ece4` | texto principal |
| `muted` | `#a99d91` | texto secundário, rótulos |
| `sideHover` | `#241f1b` | hover dos itens da sidebar |
| `logoBg` | `#2a1a0c` | fundo do tile do logo |
| `hover` | `rgba(255,255,255,.035)` | hover de linhas |
| `code` | `rgba(255,255,255,.04)` | faixas de rodapé e blocos técnicos |

### Cores — tema claro
| Token | Hex |
|---|---|
| `bg` | `#f8f4ee` |
| `panel` | `#ffffff` |
| `raised` | `#f1ebe3` |
| `line` | `#e8e0d5` |
| `text` | `#2a211a` |
| `muted` | `#75685b` |
| `sideHover` | `#f6efe6` |
| `logoBg` | `#fff0e3` |
| `hover` | `rgba(0,0,0,.025)` |
| `code` | `rgba(0,0,0,.035)` |

### Acento (marca, do ícone da lanterna)
- `accent` `#ff6900`. Botões primários, item ativo da sidebar, seleção, indicadores e barras de progresso.
- `accentInk` `#160a00`. Texto sobre o acento.
- `accentText`: escuro `#ff8a3d`, claro `#c24e00`. Links e textos de ação sobre o fundo.
- Tint de seleção: escuro `rgba(255,105,0,.10)`, claro `rgba(255,105,0,.07)`. Usado em opções e linhas selecionadas.
- `danger`: escuro `oklch(0.58 0.17 28)`, claro `oklch(0.55 0.18 28)`.

### Chips de status (fórmula)
Hues: `ok` 150, `warn` 75, `err` 25, `info` 250. `neutral` = fundo `raised` com texto `muted`.

| Tema | Fundo | Texto |
|---|---|---|
| Escuro | `oklch(0.78 0.13 H / .14)` | `oklch(0.82 0.13 H)` |
| Claro | `oklch(0.6 0.13 H / .13)` | `oklch(0.45 0.13 H)` |

### Tipografia
- **Sora** (400/500/600/700) para toda a interface.
- **JetBrains Mono** (400/500) para IDs, caminhos, códigos (S01E03), chaves de preferência e valores técnicos.
- Base de 14px. Escala usada: 10, 11, 12, 13, 14, 15 (títulos de seção, 600), 17–18 (títulos de página e modal, 600), 22, 24, 28 (título do item), 30 (números dos indicadores, 600, letter-spacing −.02em).
- Rótulos de grupo: 11px, uppercase, letter-spacing .06em, cor `muted`.
- `text-wrap: pretty` em parágrafos.

### Raios, espaçamento e sombra
- Raios: `r` 14px (cards e seções), `rS` 10px (botões, inputs, itens), `rXs` 6px (thumbnails), `rChip` 999px (chips).
- Espaçamento base de 4px. Valores frequentes: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32.
- Alturas de controles: 28 (chips e filtros pequenos), 32, 34, 36 (padrão), 38–40 (inputs principais).
- Sombra só no modal: `0 20px 60px rgba(0,0,0,.35)`. Overlay `rgba(10,8,6,.55)`.

### Ícones
**Material Symbols Rounded** (Google Fonts). Tamanhos 14–22px; ativo com `FILL 1`. Os nomes dos ícones estão no HTML de referência (ex.: `video_library`, `movie`, `tune`, `memory`, `dns`, `download`, `notifications`, `link_off`, `auto_mode`, `account_tree`).

---

## Shell da aplicação

### Sidebar (expansível)
- **Largura:** 248px expandida, 68px recolhida, com transição de largura de .22s ease.
- **Topo (64px):** tile do logo de 40×40 (fundo `logoBg`, raio `rS`, ícone `assets/logo.svg` em 30px). Quando expandida, mostra ao lado "Akari" (17px/700) e "ADMIN" (11px mono uppercase `muted`).
- **Itens (42px, raio `rS`, gap 12px):**
  - Ordem: Home `home`, Catálogo `video_library`, Item de Catálogo `movie`, Preferências `tune`, Cache `memory`, Provedores `dns`, Ingestão `download`, Notificações `notifications`.
  - Recolhida: só o ícone, com tooltip com o nome da opção.
  - Ativo: fundo `accent`, texto `accentInk`, peso 600, ícone preenchido.
  - Em Notificações, badge com o número de não lidas (pill de 20px, fundo `accent`), visível só com a sidebar expandida.
- **Rodapé:** botão "Recolher menu" (`left_panel_close` / `left_panel_open`). Guardar o estado no `localStorage`.

### Header (64px, borda inferior `line`)
- **À esquerda:** breadcrumb (11px mono uppercase `muted`; no item: "Catálogo / {título}") e, abaixo, o título da página (18px/600).
- **À direita:**
  - Busca global de 280px (36px de altura).
  - Botão de alternar tema (`light_mode` / `dark_mode`). Persistir a escolha; padrão escuro.
  - Sino com badge numérico de não lidas, que leva a Notificações.
  - Avatar de 38px.

### Área principal
- Padding 28px 32px 64px. Conteúdo com `max-width: 1280px` centralizado e gap vertical de 24px.
- Todas as grades usam `auto-fit/auto-fill` com `minmax(min(100%, X), 1fr)`, e tabelas largas ganham scroll horizontal.

## Rotas sugeridas
`/` · `/catalogo` · `/catalogo/:anilistId/:aba` (abas: `anilist`, `tmdb`, `overrides`, `pareamento`, `reproducao`) · `/preferencias` · `/cache` · `/provedores` · `/ingestao` · `/notificacoes`

---

## Telas

### 1. Home
- **Indicadores** (grid auto-fit de 200px, card padding 18×20; rótulo 12px `muted`, valor 30px/600, nota 12px):
  - **Pastas no catálogo:** total de `GET /v1/catalog/folders`. Nota: quantas têm `animeBinding`.
  - **Downloads pendentes:** `GET /v1/cache/items?pendingOnly=true`. Nota: "X baixando · Y na fila".
  - **Notificações não lidas:** `GET /v1/notifications/unread-count`. Nota: quantas são erros.
  - **Provedores conectados:** resultado do último health check de cada provedor. Nota: "N sem teste" ou "N sem conexão".
- **Notificações recentes:** as 4 últimas, com ícone do nível, título (ou "Ingestão"), mensagem truncada e horário relativo. Link "Ver todas".
- **Títulos que precisam de atenção:**
  - Notificações não lidas de nível WARNING/ERROR que têm `folderId`. Mostra a capa, um badge do nível no canto e a mensagem.
  - O clique marca como lida e abre o item.
  - Estado vazio: "Nada pendente. Todos os avisos foram lidos."

### 2. Catálogo (`GET /v1/catalog/folders`)
- **Painel de filtros** (card com duas linhas):
  - Linha 1: busca "Buscar pelo nome da pasta" (`name`) e ordenação à direita (`sort`: `name:asc|desc`, `createdAt:desc|asc`).
  - Linha 2: Tipo como segmented (Todos/ANIME/TV/MOVIE, `mediaType`); Arquivos como segmented (Todos/Com arquivos/Sem arquivos, `hasFiles`); Provedor como select (`storageProviderId`); contagem de pastas; "Limpar filtros" visível só com algum filtro ativo.
- **Chip de pasta pai** (`parentId`): aparece ao clicar no botão de subpastas de uma linha, com um × para remover.
- **Tabela:**
  - Colunas: thumb (34×48), Pasta (nome + "provedor · caminho" em mono), Tipo (chip mono), Anime vinculado (título + "ano · formato · AniList id", ou chip "Sem vínculo"), TMDB ("Vinculado" ok / "Sem TMDB" warn), Arquivos ("Com arquivos" ok / "Sem arquivos" neutral), Criada em, botão de subpastas.
  - Linha com anime abre o Item de Catálogo.
  - Rodapé com paginação (`page`/`size`).

### 3. Item de Catálogo
- **Cabeçalho:** pôster de 112×160, chip do status de revisão, título (28px/600) e uma linha de metadados.
- **Abas com dependência:**
  - AniList, sempre liberada.
  - TMDB, exige AniList.
  - TMDB Overrides, exige TMDB.
  - TMDB Episódio Pair, exige TMDB do tipo **TV**.
  - Reprodução, sempre liberada.
  - Aba bloqueada: ícone `lock`, opacidade .5, sem clique e com tooltip do motivo.
  - Aba liberada: ✓ verde se configurada, círculo vazio se não.
  - Se a aba atual ficar bloqueada, mostrar um card tracejado com o motivo e um CTA ("Ir para AniList" / "Ir para TMDB" / "Disponível só para séries").

#### 3.1 AniList
- **Card de metadados** (`GET /v1/metadata/animes/{id}`):
  - Pôster de 120px e lista chave/valor: anilistId, malId, títulos principal/inglês/japonês, sinônimos, formato · estação, episódios · duração, nota (0–10), adulto.
  - Chips de gêneros e sinopse (HTML da AniList; sanitizar).
  - Rodapé com o status de revisão (`PENDING_REVIEW` / `PARTIAL` / `REVIEWED`) em texto amigável.
- **Ações:**
  - **Sincronizar** (`POST …/sync`).
  - **Trocar anime:** abre a busca `GET /v1/anilist/search`. Ao escolher, faz `DELETE` do atual e depois `POST …/{novo}/binding {folderId}`.
  - **Desvincular**, com o fluxo de confirmação abaixo.
- **Confirmação de desvínculo** (card com borda `danger`):
  - Título: "Desvincular {título} desta pasta?"
  - Duas colunas:
    - **Será removido:** dados da AniList; vínculo TMDB e overrides; ligações de franquia; status de revisão e definição de início da franquia.
    - **Continua como está:** pasta e arquivos; pareamento de episódios; cache.
  - O botão final só fica ativo depois de digitar o nome da pasta.
- **Depois de desvincular:** estado vazio "Pasta sem anime vinculado", com o botão "Vincular anime" (busca AniList). Invalidar as queries de catálogo e TMDB.
- **Início da franquia** (`PUT …/franchise-root`): RadioGroup com rótulos amigáveis.
  - **Automático** (`AUTO`): "Decidido pelas relações da AniList: é o início se não tiver temporada anterior nem obra principal."
  - **Sempre o início** (`MANUAL_ROOT`).
  - **Nunca o início** (`MANUAL_NOT_ROOT`).
  - Rodapé com o resultado: "Hoje aparece como início da franquia…" ou "agrupado dentro de outra franquia".
- **Relações da franquia** (`GET …/relations/graph`), em **árvore indentada, não em grafo visual**:
  - Grupos: "Origem" (`SOURCE`), "Antes na cronologia" (`PREQUEL` a partir da raiz), "Linha principal" (cadeia de `SEQUEL`, numerada 1, 2, 3…). Derivadas (`SIDE_STORY`, `SPIN_OFF`, `ALTERNATIVE`, especiais) ficam recuadas 28px sob a entrada de origem, com uma linha guia em "L".
  - Cada item: thumb de 30px, título, relação em pt-BR · formato · ano, chip "Na coleção" (tem `folderId`) ou "Fora da coleção" (borda tracejada), selo "Este anime" (fundo `accent`) e marcador "Início da franquia" (`rootKind` ≠ `NOT_ROOT`).
  - **Montar a árvore a partir da raiz da franquia, não do anime atual**, para que ela seja igual em todas as páginas da franquia.
  - Rótulos: SEQUEL→Continuação, PREQUEL→Anterior, SOURCE→Obra original, SIDE_STORY→História paralela, SPIN_OFF→Spin-off, ALTERNATIVE→Versão alternativa, PARENT→Obra principal.

#### 3.2 TMDB
- **Com vínculo** (`GET …/tmdb`):
  - Card com tmdbId, tipo (TV/MOVIE), nome e data do vínculo.
  - Rodapé "N de 5 campos com override", com links para Overrides e para Pareamento (este só se TV).
  - Ações: **Trocar vínculo** e **Remover vínculo** (`DELETE …/tmdb/binding`, overrides caem por cascata).
- **Sem vínculo:** aviso tracejado e a busca já aberta.
- **Busca:**
  - Segmented TV/MOVIE (`/v1/tmdb/search/tv-shows` ou `/movies`), select de idioma e campo de busca.
  - Resultados: pôster, nome, nome original, "tv/id · data · país · ★ nota (votos) · popularidade" e sinopse em 2 linhas. Botão "Vincular" (`POST …/tmdb/binding {tmdbId, mediaType}`). 20 por página, fixo no TMDB.
  - Ao trocar, avisar que os overrides atuais são removidos.

#### 3.3 TMDB Overrides
Dados: `GET …/tmdb/overrides/schema` (`forceRefresh`) e `PUT …/tmdb/overrides`, que substitui o bloco inteiro.
- **Barra superior:** "N de 5 campos sobrepostos", chip "Alterações não salvas" e os botões Recarregar opções, Limpar todos, Descartar e **Salvar overrides**.
- **Nav de campos** (220px): Título, Sinopse, Pôster, Backdrop, Logo. Cada um mostra o valor atual ou "Padrão". Ponto cheio = override ativo; ponto vazado = alterado e não salvo.
- **Editor de texto:**
  - Radio "Sem override", com o padrão escrito.
  - Traduções do TMDB, com chip do idioma.
  - Texto personalizado (input para título, textarea para sinopse).
- **Editor de imagem:**
  - Filtro de idioma em chips com contagem.
  - Grade na proporção de cada imagem: pôster 2/3 (min 120px), backdrop 16/9 (min 200px), logo 3/1 (min 170px).
  - O primeiro tile é "Sem override".
  - Selecionado: outline de 2px `accent` e check no canto.
  - Abaixo de cada tile: idioma e dimensões.
- **Pré-visualização em largura total:** backdrop com logo sobreposto, pôster, título e sinopse do rascunho, mais a origem de cada campo (Override/Padrão).

#### 3.4 TMDB Episódio Pair
Dados:
- Arquivos: `GET /v1/catalog/video-files?folderId=` (já trazem `tmdbPairing`).
- Estrutura da série: `GET …/tmdb/file-pairing/schema`.
- Gravar: `PUT /v1/metadata/files/{fileId}/tmdb-pairing`, mandando os campos `episode*` do episódio escolhido. Remover: `DELETE` no mesmo endereço.

Tela:
- **Barra:** "X de N arquivos pareados", barra de progresso e o botão **Auto-pair por continuidade**.
- **Lista de arquivos** (280–340px): filtro Todos/Sem par/Pareados. Cada linha mostra o nome em mono, o nome do episódio e um chip com o código (S01E03) ou "sem par".
- **Editor:**
  - Cabeçalho com o arquivo e as ações Remover pareamento, Descartar e Salvar pareamento.
  - Abas por temporada ("S00 · Especiais" etc.).
  - Lista de episódios: radio, still 96px 16/9, código, nome, chip do `episodeType` quando não for `standard`, "data · duração · ★ nota (votos)" e o chip "em 03.mkv" se o episódio já estiver pareado com outro arquivo.
- **Pré-visualização em largura total:** still, código, nome, metadados e sinopse, com um Switch "Usar o still do TMDB como thumbnail" (desligado envia `thumbnailPath: null`).
- **Auto-pair por continuidade** (calculado no cliente; abre um painel de proposta sem gravar nada):
  - Os arquivos são agrupados por diretório e ordenados por nome.
  - Cada arquivo sem par recebe o episódio seguinte ao do arquivo anterior. No fim de uma temporada, continua no E01 da próxima. S00 não serve de ponto de partida.
  - Status das linhas: "sequência" (marcada), "nova temporada" (marcada), "já usado por X" (desmarcada) e "fim da série" (bloqueada).
  - "Aplicar N pareamentos" faz um PUT por arquivo marcado.

#### 3.5 Reprodução
- **Topo:** select de arquivo (código do pareamento · nome) e chip de disponibilidade (Em cache / Na fila de download / Fora do cache).
  - Provedor remoto fora do cache: botão "Enfileirar download" (`POST /v1/cache/items`) e um aviso amigável de que as informações técnicas e a reprodução ficam disponíveis quando o download terminar (sem citar código de erro).
- **Player:** hls.js com a `playlistUrl`.
  - **Perfil** em segmented: **WEB / TV / MOBILE** (enum `Profile`).
  - **Faixa de áudio** e **Legenda** em selects montados a partir do mediaprobe. Enviar a **posição no array**, não o `index`.
  - Nota da legenda: SRT = "soft · WebVTT"; ASS e outros = "queimada (hardsub)".
  - Ações: Iniciar sessão, Trocar faixas (`POST …/tracks`, só ativo se as faixas mudaram; reinicia o transcode) e Seek mm:ss (`POST …/seek`). Usar `startOffsetSeconds` para mapear o `currentTime`.
- **Painel da sessão:** ID, perfil, faixas, início da playlist e uma barra de heartbeat (`POST …/heartbeat` antes de `expiresInSeconds`; o TTL vem do header `X-Playback-Heartbeat-Ttl-Seconds`), mais um log em linguagem amigável.
- **Informações técnicas do arquivo** (`GET /v1/mediaprobe/files/{fileId}`):
  - Container (formato, duração, tamanho, bitrate).
  - Tabelas:
    - Vídeo: codec, resolução, DAR, FPS, pixel/profile, bitrate.
    - Áudio: posição, codec, canais, amostragem, bitrate, idioma, título.
    - Legendas: posição, codec, idioma, título, chips default/forced/SDH e modo no playback.
  - A faixa selecionada recebe o tint de acento.

### 4. Preferências (`GET /v1/settings?name=`, `PUT /v1/settings/{key}`)
- Filtro por chave no topo. Grupos por prefixo: Cache de vídeo, Reprodução, TMDB, AniList.
- **Cada linha:** nome amigável, chave em mono, descrição, controle, botão **Salvar** individual (ativo só com alteração) e "Atualizado {quando}".
- **Controles por chave:**
  - `cache.dir`, `playback.work.base-dir`: input de caminho.
  - `cache.max-size-bytes`: número, com sufixo "≈ X GB".
  - `*.ttl`, `playback.session.heartbeat-ttl`: ISO-8601, com sufixo legível ("7 d", "30 s").
  - `playback.transcode.hardware-acceleration`: segmented NONE / VIDEOTOOLBOX / NVENC / QSV / VAAPI.
  - `tmdb.api-key`: password, com chip "Configurado" ou "Não configurado" (valor mascarado `***`).
  - `tmdb.default-language`: Select de locales (en-US, pt-BR, ja-JP…).
  - `tmdb.image.logo-language`, `tmdb.image.backdrop-language`: Select ISO 639-1, mais "Sem idioma (sem texto)" = vazio.
  - `tmdb.include-adult`: Switch.
- Valores `null` mostram o chip "Não configurado".

### 5. Cache (somente leitura)
- **Fila de downloads** (SSE `/v1/cache/events`):
  - Chip "SSE conectado" com um ponto pulsando e "Último evento HH:MM:SS".
  - Itens: título, episódio, provedor, status (Na fila / Baixando / Em cache), barra de progresso, "X de Y", velocidade e porcentagem.
  - Concluído entra no topo da tabela.
- **Arquivos em cache:** episódio, origem + caminho, qualidade, tamanho e último acesso. **Sem ações de remoção.**
- Provedores LOCAL nunca aparecem aqui.

### 6. Provedores (`/v1/storage/providers`)
- **Topo:** resumo ("N provedores cadastrados · M sem conexão"), "Testar todos" e "Novo provedor".
- **Card por provedor:**
  - Ícone do tipo e nome derivado do tipo + id ("MEGA #1", "Disco local #3"), porque a API não tem nome.
  - Chip do health (`GET …/health`): Não testado / Testando… / Conectado / Sem conexão. Sem conexão deixa a borda vermelha.
  - Comportamento do tipo (MEGA usa cache; LOCAL lê direto), data de cadastro e último teste.
  - Rodapé com quatro ações: Testar, Editar, Pastas (Catálogo filtrado por provedor) e Remover (confirmação dentro do card).
- **Estado vazio:** "Nenhum provedor cadastrado", com 3 passos numerados e o CTA "Cadastrar primeiro provedor".
- **Modal Novo provedor** (shadcn Dialog, 560px):
  - Passo 1: busca, chips de categoria (Nuvem, Local e rede) e lista compacta agrupada por categoria, com cabeçalhos fixos. O clique já avança.
  - Passo 2: formulário do tipo.
    - **MEGA:** e-mail e senha, com botão de mostrar/ocultar. A senha é ofuscada pelo backend.
    - **LOCAL:** `rootPath` absoluto.
    - Erros por campo vêm de `details` do `VALIDATION_ERROR`.
  - Ao "Cadastrar e testar": `POST` e depois `GET …/health`. Resultado: "Provedor cadastrado e conectado" ou "Cadastrado, mas sem conexão", com "Editar configuração".
  - **Editar** reaproveita o modal no passo 2, com o tipo travado e o aviso de que a configuração atual não é exibida e deve ser informada de novo (`PUT …/config`).
  - **Escalabilidade:** a lista de tipos deve ser dirigida por dados (`{type, label, icon, category, description, fields[]}`). O ideal é o backend expor esse catálogo de tipos e campos.

### 7. Ingestão (`POST /v1/ingestion/providers/{id}`, `GET …/available-folders`, `DELETE …?rootPath=`)
- **Não existe "sessão" ou "job" de ingestão.** O POST responde 202 e o resultado chega só por notificações. Não criar lista nem status de ingestões.
- **Aviso** quando `tmdb.api-key` não está configurado (o backend responde 400). "Iniciar" fica desativado, com link para Preferências.
- **Formulário:**
  1. Provedor: cards com radio e o chip do health.
  2. Tipo do conteúdo: segmented Anime/Série/Filme (`mediaType`, obrigatório). Texto: "Aplicado às pastas novas. Pastas já no catálogo mantêm o tipo que têm."
  3. Diretório raiz: prefixo com o nome do provedor e input (vazio = provedor inteiro), mais "Procurar".
- **Árvore** (`available-folders`): expandir e recolher, selecionar, chip "No catálogo" (`ingested`) e "N subpastas". Ações "Usar este diretório" e "Cancelar".
- **Rodapé:** resumo ("Ingerir {provedor · caminho} como anime."), "Remover do catálogo" (confirmação: "Nada é apagado no provedor") e **Iniciar ingestão**.
- **Depois do 202:** card "Ingestão iniciada em segundo plano", com as 4 etapas do backend, o botão "Ver notificações" e a nota de que um pedido repetido para o mesmo diretório em andamento é ignorado.

### 8. Notificações (`/v1/notifications`, SSE `/v1/notifications/events`)
- **Topo:** número de não lidas, chip "Ao vivo" e "Marcar todas como lidas" (`POST …/read-all`).
- **Grupos** Hoje / Ontem / Anteriores. **Item:**
  - Capa (`coverImageUrl`) com um badge do nível no canto, ou só o ícone do nível quando a notificação não é sobre um título.
  - Título (ou "Ingestão" / "Falha na ingestão"), chip Info/Aviso/Erro, mensagem e horário relativo.
  - Ponto de não lida; não lidas têm fundo levemente tingido.
  - O clique marca como lida (`POST …/{id}/read`).
  - Com `folderId`: link "Revisar título" (abre o item) ou "Abrir pasta no catálogo".
- **"Ver mais"** pagina (`page`). No fim: "Não há notificações mais antigas."
- **SSE (evento `NEW`):** inserir no topo com destaque de acento por cerca de 6s, mostrar o banner "Nova notificação · {texto}" e incrementar o badge da sidebar e do sino.
- Marcar como lida não gera evento SSE. Para sincronizar várias abas, refazer `unread-count` (ex.: ao focar a janela).

---

## Interações gerais
- Estados vazios sempre com explicação e um CTA.
- Ações destrutivas sempre com confirmação inline ou em modal, na cor `danger`.
- Botões primários desativados ficam com fundo `raised` e texto `muted`.
- Transições curtas (.15–.22s) em switches, sidebar e barras.
- Persistir no `localStorage` o tema e o estado da sidebar.
- **Erros da API:** usar `ApiError.message` em toast. Para `VALIDATION_ERROR`, mapear `details[].field` para os campos do formulário.

## Estado e dados
- Estado remoto via hooks gerados pelo Orval + TanStack Query. Invalidar as queries relacionadas depois de mutações (ex.: desvincular → catálogo, anime, tmdb, overrides).
- Estado local: rascunhos de overrides, rascunho de pareamento, seleção da árvore, filtros do catálogo (refletidos na URL via search params).
- SSE: um hook `useEventSource(url, onMessage)` com reconexão. Os eventos de cache atualizam a fila; os de notificação fazem `setQueryData` na lista e no contador.

## Limitações do backend (sugestões de evolução)
1. A listagem do catálogo não traz nem filtra por `reviewStatus`.
2. O grafo de relações tem profundidade 3 e os nós não trazem ano/data.
3. Não há catálogo de tipos de provedor com seus campos.
4. Provedores não têm nome.
5. Perfis de transcode não são listáveis; não há como encerrar uma sessão; a estratégia escolhida não é exposta.
6. Marcar notificação como lida não emite evento SSE.

## Assets
- `assets/logo.svg`: ícone da lanterna (laranja `#ff6900` com brilho amarelo `#ffff00`), do upload do usuário.
- Ícones: Material Symbols Rounded (Google Fonts).
- Fontes: Sora e JetBrains Mono (Google Fonts).
- Imagens de conteúdo: vêm da API (AniList e TMDB).

## Files
- `Portal Admin.dc.html`: protótipo completo (abrir no navegador junto com `support.js`).
- `support.js`: runtime necessário para abrir o protótipo.
- `assets/logo.svg`: logo.
- `screenshots/`: capturas de cada tela na variação A (01–13 no tema escuro, 14 no tema claro). As capturas mostram só a parte visível da tela; para ver o resto, use o protótipo.
