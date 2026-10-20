# Objetivo do Sistema — akari-portal

> Visão de produto do portal administrativo do Akari. O detalhe técnico fica em
> [`ARQUITETURA_DO_SISTEMA.md`](ARQUITETURA_DO_SISTEMA.md) e nos `README.md` de cada área em `src/`.
> Inferências não confirmadas estão marcadas como **Hipótese**; decisões do mantenedor, como
> **Aceito** ou **Backlog real**. Mudanças de produto devem atualizar este arquivo junto com as telas.

## Propósito principal do sistema

O akari-portal é o **painel do administrador do Akari**, o serviço de streaming de anime cujo
backend é o projeto [`akari`](../../akari). É por ele que o admin monta e mantém a biblioteca: liga
as fontes de arquivos, traz o conteúdo para o catálogo, faz a curadoria da metadata de cada título,
testa a reprodução e acompanha o que o sistema faz em segundo plano.

O portal não guarda regra nem dado próprio — tudo vem do backend pela API. O conteúdo curado aqui
vai ser consumido por um app de reprodução para o usuário final, que ainda não existe (confirmado
pelo mantenedor); o portal é a ferramenta de quem administra, e textos como "título exibido no app"
se referem a esse app futuro.

## Problemas que o sistema resolve

- **Configurar e operar o backend sem chamadas manuais à API.** Cadastro de provedores, ingestão,
  preferências e o cache viram telas, com validação e mensagens em português.
- **Curar a metadata que a ingestão automática não acerta.** A ingestão vincula cada pasta à
  AniList, ao TMDB e aos episódios sozinha, mas nem sempre acerta: o portal mostra o que ficou
  "Parcial" ou "Aguardando revisão" e dá as ferramentas para corrigir vínculos, escolher título,
  sinopse e imagens e parear cada arquivo com o episódio certo.
- **Ver o que acontece em segundo plano.** Ingestões e downloads rodam no backend sem bloquear
  ninguém; o portal acompanha ao vivo (fila de downloads, notificações) o progresso e as falhas.
- **Testar a reprodução antes de liberar um título.** A aba Reprodução toca o arquivo pelo mesmo
  transcode HLS que o backend usa.

## Principais fluxos de negócio

1. **Cadastrar um provedor** (MEGA ou disco local) e testar a conexão — tela Provedores.
2. **Ingerir um diretório** do provedor no catálogo, escolhendo o tipo do conteúdo — tela Ingestão.
   O backend cria as pastas e arquivos e tenta vincular tudo; o resultado chega por notificação.
3. **Curar os títulos** — Catálogo (filtrando por pendências de curadoria) → item do catálogo:
   1. AniList: confirmar ou trocar o anime vinculado, ajustar o início da franquia;
   2. TMDB: vincular a série ou o filme;
   3. Overrides: escolher título, sinopse, pôster, backdrop e logo;
   4. Pareamento: ligar cada arquivo ao episódio do TMDB (à mão ou por continuidade);
   5. marcar o título como revisado.
4. **Testar a reprodução** — aba Reprodução; arquivo de provedor remoto precisa ser baixado para o
   cache antes.
5. **Acompanhar** — Home (resumo e títulos pendentes), Cache (fila e arquivos baixados) e
   Notificações (resultado de ingestões e falhas de vínculo).
6. **Ajustar preferências** do backend (diretórios, cache, reprodução, TMDB, AniList).

## Atores envolvidos

- **Administrador** — único usuário do portal; faz todos os fluxos acima. Não há papéis nem login:
  **Aceito** (confirmado pelo mantenedor) — não há plano de autenticação por ora.
- **Backend `akari`** — dono das regras e dos dados; o portal só lê e pede ações pela API.
- **Serviços externos, via backend** — AniList e TMDB (metadata), MEGA via rclone (arquivos
  remotos). O portal nunca fala com eles diretamente, só carrega imagens do CDN do TMDB e da AniList
  pelas URLs que a API devolve.

## Funcionalidades centrais

- Cadastro, teste de conexão e remoção de provedores.
- Ingestão de diretórios e remoção do que foi ingerido, com navegador de pastas do provedor.
- Catálogo com busca, ordenação e filtros de curadoria (status de revisão, vínculo AniList, vínculo
  TMDB, episódios pareados).
- Curadoria do item em abas: AniList (vínculo, início da franquia, árvore de relações), TMDB,
  Overrides (com visualização das imagens em tamanho original), Pareamento de episódios (com
  auto-pair por continuidade) e Reprodução.
- Status de revisão de cada título, visível e acionável em todas as abas.
- Cache de vídeo ao vivo: fila de downloads com progresso, tentar de novo, cancelar, deletar e ações
  em massa.
- Notificações ao vivo, com contador de não lidas e atalho para o título.
- Preferências do sistema.

## Visão de produto

- **Curadoria rápida.** O portal é pensado para passar por muitos títulos seguidos: listas com
  filtros de pendência, painel lateral de pareamento que navega entre arquivos e lembra a
  temporada, notificações que não atrapalham os botões de salvar.
- **Sem jargão.** Textos em português, sem nomes de endpoint nem valores técnicos crus na
  interface (status e tipos aparecem traduzidos).
- **O backend decide.** Regras de negócio ficam no backend; as poucas que ainda são calculadas no
  portal (auto-pair, árvore da franquia, ações em massa do cache, troca de vínculo) são **Backlog
  real** (confirmado pelo mantenedor) para migrar para o backend aos poucos.

## Contexto operacional do sistema

- **Uso em desktop.** **Aceito** (confirmado pelo mantenedor): o portal não tem layout para celular.
- **Hospedagem separada do backend**, por um servidor estático próprio, com `VITE_API_BASE_URL` e a
  origem liberada no CORS do backend (confirmado pelo mantenedor).
- **Sem autenticação**, como dito em Atores.
- **Volume pequeno.** Várias decisões aceitas partem de uma biblioteca e de uma fila de tamanho
  modesto — por exemplo, listas sem paginação no Cache e a árvore inteira do provedor carregada de
  uma vez na Ingestão. O Akari é self-hosted e de uso pessoal, com um único admin (confirmado pelo
  mantenedor).
