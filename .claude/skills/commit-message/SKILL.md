---
name: commit-message
description: Compose a Conventional Commits message in Portuguese for the staged/unstaged changes of the akari-portal. Trigger on "commit", "mensagem de commit", "gerar commit", "faz o commit", or when the user asks to commit changes. Produces a short subject + detailed bullet list body. Never adds authorship attributions.
---

# commit-message

Generates a Conventional Commits message (in Portuguese) for the current diff of the akari-portal
(React + Vite + TanStack Query, cliente da API gerado pelo Orval). Subject on one line, blank line,
then bullet points describing what changed and why.

## Absolute rules

- **Never** add `Co-Authored-By:`, `Signed-off-by:`, `Generated with...`, `🤖`, "Claude", "AI", "assistant" or any other authorship/tool attribution. The commit is the user's, period.
- **Never** use `git commit -m "..."` with the message inline for multi-line bodies — use a HEREDOC. Newlines and quotes get mangled otherwise.
- **Never** use `--no-verify` or bypass hooks unless the user explicitly asks.
- **Never** run `git add -A` or `git add .` — stage explicit paths. If files are already staged, honor the current staging.

## Before writing the message

Run in parallel:

```bash
git status
git diff --staged
git diff             # only if nothing is staged, to see what would be added
git log -n 5 --oneline
```

Use `git log` to match existing tone and scope naming in the repo. If the repo has zero commits, follow the defaults below.

If there are no staged changes and no unstaged changes, do **not** create an empty commit — tell the user and stop.

If there are only unstaged changes, do **not** stage them automatically. Ask which files to include, or ask the user to `git add` first.

Before committing code changes, make sure the project is green — report failures instead of committing over them:

```bash
npm run typecheck
npm run lint
npm run format:check
```

## Format

```
<tipo>(<escopo>): <descrição curta no imperativo, minúscula, sem ponto final>

- <tópico 1: o que mudou e por quê>
- <tópico 2>
- <tópico 3>
```

### Subject

- **Tipo** (obrigatório) — um dos permitidos abaixo.
- **Escopo** (opcional, entre parênteses) — tela ou parte afetada (ver "Como escolher o escopo"). Omita quando a mudança for global.
- **Descrição** — verbo no imperativo, minúscula, em português, sem ponto final. Limite ≤ 72 caracteres incluindo tipo/escopo.

Verbos preferidos: `adiciona`, `remove`, `corrige`, `renomeia`, `move`, `extrai`, `atualiza`, `refatora`, `documenta`, `simplifica`, `padroniza`, `desabilita`, `sincroniza`.

### Body

- Linha em branco separando do subject (obrigatório).
- Bullets com `- ` no início.
- Cada bullet: uma alteração relevante. Descreva **o que** mudou e, se não for óbvio, **por quê**.
- Português, imperativo ou descrição direta. Sem ponto final nos bullets.
- Se um bullet precisar de mais contexto, quebre em sub-bullets com 2 espaços de indentação.
- Máximo ~5 bullets no nível principal. Se passar disso, considere se o commit não deveria ser dividido.

### Footer (opcional)

- `BREAKING CHANGE: <descrição>` — só quando há mudança incompatível.
- `Refs: #123` — só quando o usuário fornecer o número da issue.
- Nunca mais nada. Sem attribution.

## Tipos permitidos

| Tipo | Uso |
|---|---|
| `feat` | nova funcionalidade visível na interface |
| `fix` | correção de bug |
| `refactor` | mudança de código sem alterar comportamento visível |
| `perf` | ganho de performance |
| `test` | adição/ajuste de testes |
| `docs` | apenas documentação (README, docs, skills, comentários) |
| `style` | formatação, whitespace (ex.: rodar o Prettier) — sem lógica. Não é ajuste visual de CSS: mudança de layout/estilo da tela é `feat` ou `fix` |
| `build` | Vite, TypeScript, Tailwind, ESLint/Prettier, Orval, dependências do `package.json` |
| `ci` | pipelines, GitHub Actions, hooks |
| `chore` | tarefas de manutenção sem impacto no código da aplicação |
| `revert` | desfaz um commit anterior |

Se a mudança combina tipos, escolha o que descreve o **efeito principal** e explique o resto nos bullets.

## Como escolher o escopo

O portal é organizado por tela em `src/pages/<tela>/`, com lógica compartilhada em
`src/features/<área>/`, componentes em `src/components/` e a camada de API em `src/api/`. Uma
funcionalidade costuma tocar a página e a feature da mesma área ao mesmo tempo, então o escopo é a
**área funcional**, não a pasta técnica.

- Tela ou área afetada: `catalog`, `item`, `cache`, `ingestion`, `providers`, `preferences`,
  `notifications`, `home`.
- Dentro do item de catálogo, quando a mudança é de uma aba só, use a aba: `anilist`, `tmdb`,
  `overrides`, `pairing`, `playback`. Mudança no cabeçalho ou nas abas como um todo é `item`.
- Partes transversais: `layout` (sidebar, header, `components/layout`), `ui` (`components/ui`),
  `api` (`src/api/http.ts`, `sse.ts`, `query.ts`, `errors.ts`).
- Use `contract` para sincronizar o `openapi.yaml` com o backend e regenerar o cliente do Orval
  (`npm run api:sync`) — o commit leva junto `openapi.yaml` e `src/api/generated/`. Se a tela já
  passa a usar o contrato novo no mesmo commit, prefira o escopo da tela e cite a sincronização
  num bullet.
- Mudanças em configuração de build/lint (`package.json`, `vite.config.ts`, `tailwind.config.ts`,
  `eslint.config.js`, `.prettierrc.json`, `orval.config.ts`) usam o tipo `build`, sem escopo (ou
  com o nome da ferramenta, se ajudar: `build(eslint)`).
- Use `skills` para mudanças em `.claude/skills/*`.
- Omita o escopo quando a mudança atravessa várias telas.

## Exemplos

**Funcionalidade numa tela:**

```
feat(cache): adiciona cancelar tudo e deletar tudo

- cancela as linhas na fila antes do download em andamento, pra o scheduler não iniciar o próximo
- deleta os arquivos em cache um a um, já que o contrato não tem endpoint em lote
- linhas que mudaram de estado no meio contam como ignoradas no resumo
```

**Sincronização do contrato:**

```
feat(catalog): adiciona filtros de curadoria na listagem

- sincroniza o openapi.yaml e regenera o cliente com reviewStatus, hasAnilist, hasTmdb e allEpisodesPaired
- agrupa os filtros num painel retrátil com os ativos exibidos como chips
```

**Fix pontual:**

```
fix(layout): alinha os ícones do menu contraído

- o Trigger do tooltip juntava o className em função do NavLink como string
- o estado ativo passa a vir do useMatch, com className comum
```

**Build:**

```
build: configura eslint e prettier

- adiciona eslint.config.js com typescript-eslint, react-hooks e eslint-config-prettier
- adiciona .prettierrc.json com o estilo do projeto e o plugin do tailwind
```

## Como criar o commit

Sempre via HEREDOC para preservar quebras e crases:

```bash
git commit -m "$(cat <<'EOF'
<tipo>(<escopo>): <descrição>

- <bullet 1>
- <bullet 2>
EOF
)"
```

Depois, rode `git status` para confirmar o commit.

Se o pre-commit hook falhar, **não** use `--amend` — o commit anterior não existe ainda. Corrija o problema, re-stage os arquivos alterados e crie um novo commit.

## Reject

- Mensagens em inglês (a menos que o usuário explicitamente peça).
- Subject terminando em ponto final.
- Verbos no gerúndio (`adicionando`, `corrigindo`) ou passado (`adicionou`) — sempre imperativo.
- Body sem linha em branco após o subject.
- Bullets com formatação irregular (`*`, `•`, sem hífen).
- Menção a Claude, IA, assistente, autoria automatizada ou ferramenta de geração — em qualquer campo, incluindo footer.
- `git add -A` / `git add .` — stage explícito.
- `--no-verify`, `--no-gpg-sign` — só se o usuário pedir.
- Commits que misturam refactor + feature + fix num body genérico. Sugira dividir.
- Formatação em massa (Prettier no projeto inteiro) misturada com mudança de lógica. Sugira um commit `style` separado.
