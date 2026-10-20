# src/components/layout

Moldura comum a todas as telas: menu lateral, cabeçalho e área de conteúdo. O `AppLayout` é a rota
pai de todas as rotas em [`App.tsx`](../../App.tsx), então cada tela renderiza só o próprio
conteúdo dentro dele.

| Arquivo                          | Papel                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`AppLayout.tsx`](AppLayout.tsx) | Junta menu, cabeçalho e conteúdo; guarda o estado do menu e do tema; mostra o aviso de notificação nova. |
| [`Sidebar.tsx`](Sidebar.tsx)     | Menu lateral com as entradas de navegação (`NAV`), expansível.                                           |
| [`Header.tsx`](Header.tsx)       | Título e breadcrumb da tela, botão de tema e atalho para as notificações.                                |
| [`PageMeta.tsx`](PageMeta.tsx)   | Contexto do título e breadcrumb do cabeçalho (`usePageMeta`).                                            |

A pasta irmã [`../domain`](../domain) guarda componentes visuais ligados a um conceito do domínio
— hoje só o `NotificationAvatar` (capa do título com o selo do nível da notificação), usado na tela
de Notificações.

## AppLayout

- O conteúdo rola dentro do `<main>`, não na página; ao trocar de rota, o `<main>` volta ao topo.
- A largura do conteúdo é limitada a 1280 px (`max-w-content` no Tailwind).
- O menu expandido ou recolhido fica salvo no navegador (`akari.sidebarExpanded`); começa
  expandido.
- O tema fica salvo em `akari.theme` (`useTheme`, em [`src/lib/storage.ts`](../../lib/storage.ts)).
  Um script no [`index.html`](../../../index.html) aplica o tema salvo antes do React carregar,
  para a página não piscar no tema errado. Sem preferência salva, o tema é o escuro.
- Quando chega uma notificação nova pelo stream, aparece um aviso no topo do conteúdo por 6
  segundos; clicar nele leva a Notificações. O estado vem de `useNotificationsLive`
  ([`src/features/notifications`](../../features/notifications)), que também alimenta o contador de
  não lidas do menu e do cabeçalho.

## Sidebar

- As entradas ficam em `NAV`, na ordem do menu. Uma entrada fica ativa na própria rota e nas rotas
  abaixo dela — "Catálogo" continua ativo nas páginas de um item (`/catalogo/:id/...`); "Home" usa
  `end` para só ficar ativa em `/`.
- Recolhido (68 px), o menu mostra só os ícones, com o nome num tooltip. Expandido (248 px),
  mostra os nomes e o contador de não lidas em Notificações.
- O estado ativo é calculado com `useMatch` no `NavItem`, e não pelo `className` em função do
  `NavLink`, porque o tooltip junta o `className` do filho como string (ver
  [`../ui/README.md`](../ui/README.md#cuidados)).

## Header e PageMeta

Cada tela chama `usePageMeta(título, breadcrumb?)` para definir o que o cabeçalho mostra; o mesmo
título vai para a aba do navegador (`<título> · Akari`). O breadcrumb padrão é "Akari admin".
**Confirmado**: todas as telas em `src/pages` chamam `usePageMeta`.

O cabeçalho traz só o botão de tema e o atalho para Notificações, com o contador de não lidas. Não
há área de usuário, porque o portal não tem login (ver [`OBJETIVO_DO_SISTEMA.md`](../../../docs/OBJETIVO_DO_SISTEMA.md#atores-envolvidos)).

## Observações

- **Telas estreitas.** O layout tem altura mínima de 560 px e só reduz o espaçamento lateral do
  conteúdo em telas pequenas; o menu não recolhe sozinho nem vira gaveta, e tabelas largas (catálogo,
  cache) rolam na horizontal. **Aceito** (confirmado pelo mantenedor): o portal é pensado para
  desktop e não tem layout para celular.
- **Tema do sistema.** Sem preferência salva, o portal abre sempre no tema escuro, sem seguir o
  tema do sistema operacional (`prefers-color-scheme`). **Backlog real** (confirmado pelo
  mantenedor): sem preferência salva, o portal deveria seguir o tema do sistema.
