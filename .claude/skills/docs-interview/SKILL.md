---
name: docs-interview
description: Faz curadoria da documentação do akari-portal (docs/ARQUITETURA_DO_SISTEMA.md, docs/OBJETIVO_DO_SISTEMA.md, o README.md da raiz e os README.md de cada área em src/) resolvendo marcas de "Hipótese" e pontos em aberto via entrevista com o usuário. Trigger em "revisar os docs", "curadoria da documentação", "entrevista sobre os READMEs", "tirar dúvidas dos docs/READMEs", "deixar a documentação mais confiável", "vamos revisar os READMEs um por um", ou sempre que o usuário pedir pra passar pelas áreas do portal perguntando sobre pontos em aberto. Só pergunta ao usuário o que é decisão de produto/intenção — tudo que é verificável lendo o código, o contrato ou rodando o portal é resolvido sozinho, sem pergunta.
---

# docs-interview

Resolve pontos em aberto na documentação do akari-portal (`docs/ARQUITETURA_DO_SISTEMA.md`,
`docs/OBJETIVO_DO_SISTEMA.md`, o `README.md` da raiz e os `README.md` de cada área em `src/`) fazendo perguntas objetivas ao usuário — só sobre o que *só
ele* pode responder — e verificando tudo o mais sozinho, lendo o código. O objetivo final é nunca
deixar uma marca de "Hipótese" ou uma observação em aberto sem resolução: todo ponto vira
**Confirmado** (fato verificado em código), **Aceito** (decisão deliberada do mantenedor, não é
dívida), ou **Backlog real** (dívida técnica reconhecida, não urgente).

A forma de escrever cada resolução segue a skill `docs-style`.

## Por que a divisão pergunta-vs-verificação importa

Perguntar algo que já dá pra responder lendo o código desperdiça o tempo do usuário e sinaliza que
você não leu o projeto direito. Mas assumir uma intenção de produto (se um comportamento da tela é
aceitável, se algo é roadmap, se vale reestruturar uma página) sem perguntar é pior — vira
documentação que parece confiável mas reflete só a sua suposição. A regra de ouro:

- **Dá pra confirmar com uma ferramenta** (grep, `Read`, o `openapi.yaml`, o código do backend em
  `../akari`, `npm run typecheck`, abrir a tela no preview) → verifique você mesmo, nunca pergunte.
  Isso cobre quase todo "não verificado"/"a confirmar" deixado por uma análise anterior.
- **Só o mantenedor sabe** (esse comportamento da tela é o esperado? é intencional ou falta
  implementar? essa regra deveria morar no backend? vale reestruturar agora?) → pergunte, com
  opções objetivas.

## Processo

### 1. Escopo e ordem

Primeiro passam os dois documentos de visão geral, nesta ordem:

1. `docs/OBJETIVO_DO_SISTEMA.md` — o porquê do portal: propósito, problemas que resolve para o
   admin, principais fluxos (cadastrar provedor → ingerir → curar → reproduzir → acompanhar),
   atores, funcionalidades centrais, visão de produto e contexto operacional (backend `akari`,
   hospedagem separada, uso só em desktop, sem login).
2. `docs/ARQUITETURA_DO_SISTEMA.md` — o como: visão arquitetural (SPA cliente do `akari`, contrato
   `openapi.yaml` + Orval, SSE), padrões e regras (organização por `api` → `components` →
   `features` → `pages`, só tokens do design, textos em português), convenções técnicas, separação
   de responsabilidades, fluxo de comunicação entre as camadas, dependências críticas (contrato,
   streams code-first, TMDB/AniList via backend), riscos e acoplamentos (regras de negócio no
   cliente, tipos de SSE à mão) e diretrizes para novas telas.

Os dois podem exigir também apontar divergências entre o portal e o contrato `openapi.yaml` ou o
backend. Em seguida vem o `README.md` da raiz (como rodar, scripts, estrutura e o resumo do estado
atual), que deve apontar para os dois documentos em vez de repetir o conteúdo deles. Se algum dos
três não existir, pergunte ao usuário se quer criá-lo nesta rodada — e, ao criar, consolide nele o
que já estiver decidido nos READMEs das áreas, em vez de perguntar de novo.

Depois os `README.md` de cada área, **um de cada vez**, perguntando ao final de cada um se segue
para o próximo — nunca emende várias áreas na mesma leva sem o usuário pedir.

Ordem sugerida, da base para as telas (quem é usado por muitos vem antes de quem usa — o fluxo
entre as camadas fica documentado em `ARQUITETURA_DO_SISTEMA.md`, seção "Fluxo de comunicação";
releia de lá se o projeto tiver crescido):

1. `src/api` — cliente HTTP, SSE, React Query e invalidação; o cliente gerado pelo Orval
   (`src/api/generated`) não é documentado à mão, só como ele é gerado e sincronizado.
2. `src/components/ui` → `src/components/layout`.
3. `src/features/*` — `providers` → `settings` → `notifications` → `playback` → `item`.
4. `src/pages/*` — `providers` → `preferences` → `ingestion` → `catalog` → `item` (abas: AniList,
   TMDB, Overrides, Pareamento, Reprodução) → `cache` → `notifications` → `home`.

Releia a estrutura de `src/` antes de começar — se o projeto tiver crescido, encaixe as áreas novas
nessa mesma lógica. Se uma área ainda não tem README, pergunte ao usuário se quer criá-lo nesta
rodada antes de seguir.

Motivo da ordem: a base (API, componentes, features) esclarece conceitos — como a invalidação de
cache ou a reconexão do SSE — que reaparecem nas telas. Resolver a base primeiro evita repetir a
mesma pergunta em cada página.

### 2. Levantar os pontos em aberto do arquivo

Leia o arquivo inteiro e liste os candidatos a pergunta/verificação. Os sinais mais comuns:

- Qualquer marca **`Hipótese:`** explícita no texto — por convenção do projeto, essas marcas
  existem justamente para indicar "isto não foi confirmado, resolva depois".
- Frases como "não verificado", "a confirmar", "candidato a dívida", "vale a pena considerar",
  "parece ser X mas não há evidência" — qualquer hedge que sinaliza que quem escreveu não teve
  certeza.
- Itens de "Observações técnicas e débitos" que descrevem um comportamento sem dizer se é
  aceitável ou se precisa de correção.
- Regra de negócio calculada no portal (ex.: auto-pair, árvore da franquia, ações em massa do
  cache) sem dizer se deve continuar no cliente ou ir para o backend.

### 3. Verificar sozinho o que for factual

Antes de perguntar qualquer coisa, tente resolver via ferramenta:

- **Existe algo no código?** `grep`/`Read` direto (ex.: "há tratamento de 404 aqui?" → leia o
  hook; "existem testes?" → procure arquivos `*.test.*`). Prefira delegar essa varredura a um
  subagente (`Explore`) quando envolver vasculhar várias áreas de uma vez — isso evita poluir seu
  contexto com grep bruto.
- **Quem usa o quê?** Siga os imports e as chamadas reais antes de supor um acoplamento.
- **O contrato garante algo?** Leia o `openapi.yaml` (e o código do backend em `../akari`, quando
  o contrato não for claro). Se o portal está defasado, `npm run api:generate` com o backend no ar
  mostra a diferença no cliente gerado.
- **A tela se comporta assim?** Abra no preview (servidor de `.claude/launch.json`) numa aba
  própria e confira — sem salvar, deletar ou disparar ações com efeito em dados reais.

Atualize o arquivo com o resultado, usando a marca **Confirmado** (ou, quando for o caso de
corrigir um texto desatualizado, corrija o texto direto). Cite `arquivo:linha` quando ajudar quem
for reler depois.

### 4. Perguntar só o que sobrar

O que não dá pra resolver em código vira pergunta via `AskUserQuestion`. Agrupe até 4 perguntas por
chamada (o limite da ferramenta) e prefira este formato:

- Pergunta objetiva, citando o trecho/comportamento exato (não "o que você acha de X", mas "a tela
  faz Y quando Z — isso é problema ou é esperado?").
- 2 a 4 opções concisas, cada uma com uma frase de consequência. O par mais comum é:
  - **Aceito** / **Intencional** — decisão deliberada, não precisa virar tarefa.
  - **Backlog real** / **Lacuna a cobrir** — dívida reconhecida, mas sem pressa — ou, quando for
    algo que o usuário quer corrigir no ato, ofereça essa opção também.
- Não pergunte duas vezes pela mesma coisa: se o usuário já estabeleceu uma **política geral**
  (ex.: "regra de negócio no front é backlog real, vai para o backend aos poucos"), aplique essa
  política a todo item equivalente nas áreas seguintes sem perguntar de novo — só marque
  "**Backlog real** (confirmado pelo mantenedor)" e, se fizer sentido, referencie a decisão geral.
  Só pergunte de novo quando o item for genuinamente diferente do que a política já cobriu.

### 5. Atualizar o arquivo

Troque a marca de incerteza pela resolução, direto no texto (não deixe a pergunta e a resposta só
na conversa — o ganho da entrevista é a documentação ficar confiável sozinha, sem precisar reler o
chat). Vocabulário padrão a usar inline, em negrito:

- **Confirmado** (+ evidência: arquivo:linha, operação do contrato etc.) — fato verificado.
- **Aceito** (confirmado pelo mantenedor) — comportamento deliberado, não é dívida.
- **Backlog real** (confirmado pelo mantenedor) — dívida reconhecida, candidata a correção futura,
  sem compromisso de prazo.
- Quando a resposta implica um **item concreto que o usuário aprovou fazer agora**, não documente
  só a intenção — execute a mudança de verdade (ver seção abaixo) e documente o resultado, não a
  promessa.

Essas marcas (`Aceito`/`Backlog real`/`Confirmado`/`(confirmado pelo mantenedor)`) são o produto
da entrevista — nunca remova nem resuma. O que não entra no texto é a jornada de como chegamos à
resolução: ver skill `docs-style` pro critério exato do que cortar e do que manter.

Se a resolução de um item também afeta o README de uma área **já fechada** nesta sessão (ex.: uma
decisão sobre o SSE que vale para Cache e Notificações), volte e atualize os outros arquivos também
— não force o usuário a repetir a mesma resposta quando você já sabe que ela se aplica em outro
lugar.

Se a resposta revelar uma divergência no **contrato ou no backend** (não no portal), registre no
README do portal só o efeito na tela e avise o usuário — a correção é no repositório `../akari`,
fora do escopo desta entrevista.

### 6. Fechar a área e seguir

Resuma em 1-2 frases o que foi resolvido (quantas perguntas novas, o que foi resolvido sozinho) e
pergunte explicitamente se segue para o próximo item da ordem. Não pule a confirmação — o ritmo
"uma área por vez" é do usuário, não seu.

## Quando a entrevista vira mudança de código de verdade

Às vezes uma resposta não é só "documenta isso" — é "sim, corrige/renomeia agora". Quando o usuário
aprovar explicitamente uma ação concreta:

1. Levante **todas** as referências antes de tocar em qualquer arquivo (`grep -rn` pelo nome
   antigo, em `.ts`, `.tsx` e `.md` — não esqueça os READMEs de áreas já fechadas).
2. Para renomear arquivo ou componente: mova o arquivo (com `git mv` se o projeto estiver no git)
   e atualize todos os imports e usos.
3. Rode `npm run typecheck` e `npm run lint` antes de dar o fluxo por encerrado — pegar um import
   esquecido agora é muito mais barato que descobrir depois. Se a mudança é visível, confira a
   tela no preview.
4. Só então atualize os READMEs/docs afetados (inclusive os de áreas que só *mencionam* o que foi
   renomeado, não só a área dona).
5. Nunca comitar essa mudança sem aprovação explícita e separada — mesma regra de sempre para
   commits (skill `commit-message`).

## O que NÃO fazer

- Não pergunte algo que um `grep`/`Read`/olhar o contrato resolve — isso é o erro mais caro desta
  metodologia.
- Não invente opções de resposta fora do que a pergunta realmente admite; mantenha 2-4 opções
  claras, não uma lista longa de nuances.
- Não acumule perguntas de várias áreas numa pergunta só — cada `AskUserQuestion` deve ser sobre
  a área em curso.
- Não avance para a próxima área sem o usuário confirmar.
- Não deixe uma marca de `Hipótese` sem resolução — se você leu o arquivo e viu uma, ela entra na
  lista de pontos a cobrir nesta rodada, mesmo que pareça trivial.
- Não documente à mão o cliente gerado pelo Orval (`src/api/generated`) — ele é refeito a cada
  `npm run api:generate`.
- Não rode a bateria de evals/benchmarks do skill-creator para este fluxo — é uma metodologia de
  trabalho interno do projeto, não uma skill genérica a ser distribuída/otimizada por eval.
