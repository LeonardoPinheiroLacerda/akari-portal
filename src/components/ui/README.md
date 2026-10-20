# src/components/ui

Componentes base do portal: botões, campos, chips, diálogos e estados de carregamento. São escritos
no próprio projeto, com Tailwind e os tokens do design, sobre primitivos do Radix UI onde há
comportamento de acessibilidade a herdar (diálogo, select, tooltip, radio, checkbox, switch). Não
há CLI do shadcn/ui configurado: os componentes seguem o estilo dele, mas são mantidos à mão.

Os textos e o visual seguem a variação **A · Lanterna** do protótipo de design (handoff mantido
fora do repositório).

## Tokens

As cores vêm de variáveis CSS em [`src/index.css`](../../index.css), uma por tema
(`[data-theme='dark']` e `[data-theme='light']`), e são expostas ao Tailwind em
[`tailwind.config.ts`](../../../tailwind.config.ts): `bg`, `panel`, `raised`, `line`, `text`,
`muted`, `accent`, `accent-ink`, `accent-text`, `tint`, `danger`, `code`, `hover`… Os tons de
status usam pares `--<tom>-bg` / `--<tom>-fg` (`ok`, `warn`, `err`, `info`). Componentes e telas
usam só esses tokens — nunca cores fixas —, o que faz os dois temas funcionarem sem código extra.

Tamanhos de fonte e raios também são tokens do Tailwind (`text-13`, `text-15`, `rounded-rs`,
`rounded-r`, `rounded-chip`…). A classe utilitária `card` (painel com borda e raio) fica no
`index.css`.

## Componentes

| Arquivo                                                    | Exporta                                              | Uso                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`button.tsx`](button.tsx)                                 | `Button`                                             | Variantes `primary`, `secondary` (padrão), `ghost`, `link`, `danger`, `danger-solid`; tamanhos `xs`–`lg`, `icon`, `icon-sm`. Aceita `icon`, `loading` (troca o ícone por um spinner e desabilita) e `asChild`.                |
| [`chip.tsx`](chip.tsx)                                     | `Chip`, `Tone`                                       | Pílula de status com `tone` (`ok`, `warn`, `err`, `info`, `neutral`, `accent`), `icon`, `mono` e `dashed`.                                                                                                                    |
| [`icon.tsx`](icon.tsx)                                     | `Icon`                                               | Ícone do Material Symbols Rounded pelo nome (`name="delete"`), com `size` e `fill`. A largura padrão é igual ao `size`; uma classe de largura de quem usa (ex.: `w-[22px]`) a substitui. A fonte é carregada no `index.html`. |
| [`input.tsx`](input.tsx)                                   | `Input`, `Textarea`, `SearchInput`                   | Campos de texto no estilo do design; `SearchInput` com ícone de lupa.                                                                                                                                                         |
| [`select.tsx`](select.tsx)                                 | `Select`                                             | Select do Radix com lista de `options`. O valor `''` representa "nenhum" (convertido internamente, porque o Radix não aceita valor vazio).                                                                                    |
| [`segmented.tsx`](segmented.tsx)                           | `Segmented`                                          | Controle segmentado de opção única (ex.: filtros Todos / Com / Sem).                                                                                                                                                          |
| [`radio.tsx`](radio.tsx)                                   | `RadioGroup`, `RadioCard`, `RadioDot`                | Grupo do Radix, cartão de opção e o indicador visual solto (para listas que já são `role="radio"`).                                                                                                                           |
| [`checkbox.tsx`](checkbox.tsx), [`switch.tsx`](switch.tsx) | `Checkbox`, `Switch`                                 | Sobre os primitivos do Radix.                                                                                                                                                                                                 |
| [`dialog.tsx`](dialog.tsx)                                 | `Dialog`, `DialogContent`                            | Diálogo modal centralizado com título, descrição e botão de fechar; `width` define a largura máxima.                                                                                                                          |
| [`tooltip.tsx`](tooltip.tsx)                               | `Tooltip`, `TooltipProvider`                         | Tooltip do Radix; `disabled` renderiza só o filho. O `TooltipProvider` fica no `App`.                                                                                                                                         |
| [`section.tsx`](section.tsx)                               | `Section`                                            | Card com cabeçalho (título, subtítulo, ações), corpo e rodapé opcional.                                                                                                                                                       |
| [`states.tsx`](states.tsx)                                 | `Loading`, `ErrorState`, `EmptyState`                | Estados de carregamento, erro (com "Tentar de novo" e a mensagem de `errorMessage`) e vazio.                                                                                                                                  |
| [`thumb.tsx`](thumb.tsx)                                   | `Thumb`                                              | Imagem com proporção fixa e placeholder listrado quando falta a imagem ou ela falha ao carregar.                                                                                                                              |
| [`misc.tsx`](misc.tsx)                                     | `Progress`, `KeyValue`, `Pagination`, `ExternalLink` | Barra de progresso, lista rótulo/valor, paginação 0-based (como a da API) e link para site externo em nova aba (ids da AniList, MyAnimeList e TMDB).                                                                          |

## Cuidados

- **`Tooltip` com filho de `className` em função.** O `Tooltip` usa o `Trigger` do Radix com
  `asChild`, que junta o `className` do filho como string. Um `className` em função — como o do
  `NavLink` do React Router — vira o código-fonte da função e as classes se perdem. **Confirmado**
  (motivo do `NavItem` em [`Sidebar.tsx`](../layout/Sidebar.tsx) calcular o estado ativo com
  `useMatch` e passar `className` comum). Dentro de um `Tooltip`, passe sempre `className` string.
- **Só o que é usado.** A pasta exporta apenas componentes em uso, e o `package.json` só traz os
  primitivos do Radix importados aqui (confirmado pelo mantenedor). Um componente novo entra quando
  uma tela precisar dele.
