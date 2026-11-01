# src/pages/preferences

Tela **Preferências** (`/preferencias`): edição das preferências do sistema guardadas no backend
(diretórios, cache, reprodução, TMDB, AniList). Cada preferência é salva sozinha, com o próprio
botão.

| Arquivo                                      | Papel                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| [`PreferencesPage.tsx`](PreferencesPage.tsx) | Lista agrupada, filtro por chave e o editor de cada preferência (`SettingRow`). |

## Lista

- Vem de `GET /v1/settings`; o filtro por chave vai para o backend (parâmetro `name`) e fica na URL
  (`?filtro=`).
- As preferências são agrupadas pelo prefixo da chave: Cache de vídeo (`cache.*`), Reprodução
  (`playback.*`), TMDB (`tmdb.*`), AniList (`anilist.*`) e Outras.
- Só preferências que já existem no backend aparecem e podem ser alteradas — a API não cria chaves
  novas. **Confirmado** (contrato, `updateSetting`: chave inexistente responde `404`).

## Editor de cada preferência

O mapa `META` dá a cada chave conhecida um rótulo, uma explicação e um tipo de controle:

| Tipo              | Controle                                        | Chaves                                                                                                                                                              |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`            | texto                                           | `cache.dir`, `playback.work.base-dir`                                                                                                                               |
| `bytes`           | texto em bytes, com o equivalente em GB ao lado | `cache.max-size-bytes`                                                                                                                                              |
| `duration`        | texto ISO-8601, com a duração legível ao lado   | `playback.session.heartbeat-ttl`, `tmdb.cache.ttl`, `anilist.cache.ttl`                                                                                             |
| `enum`            | controle segmentado                             | `playback.transcode.hardware-acceleration` (`NONE`, `VIDEOTOOLBOX`, `NVENC`, `QSV`, `VAAPI`), `playback.default.subtitle-forced` (`false` Completa, `true` Forçada) |
| `secret`          | senha                                           | `tmdb.api-key`                                                                                                                                                      |
| `locale` / `lang` | select de idiomas                               | `tmdb.default-language` / `tmdb.image.logo-language`, `tmdb.image.backdrop-language`                                                                                |
| `trackLang`       | select de idiomas ISO 639-2 (`ISO639_2`)        | `playback.default.audio-language`, `playback.default.subtitle-language`                                                                                             |
| `bool`            | switch                                          | `tmdb.include-adult`                                                                                                                                                |

Os idiomas de faixa usam o código de 3 letras porque o backend compara o valor, sem diferenciar
maiúsculas, com a tag `language` das faixas do probe, que vem do arquivo (no Matroska, ISO
639-2/B: `fre`, `ger`, `chi`). **Confirmado** (`playback/README.md` do backend, "Faixas padrão").
Um valor fora da lista aparece como opção com o próprio código. A legenda tem também "Sem legenda"
(valor vazio), que o backend trata como "começar sem legenda"; por isso, vazio nela não ganha o
chip "Não configurado". **Confirmado** (contrato, `StartPlaybackSessionRequest.subtitleTrackIndex`).

Uma chave fora do mapa aparece com a própria chave como rótulo e um campo de texto (ou senha, se
for secreta).

- O backend valida o valor; erros de validação ou de regra aparecem embaixo do campo, e os demais
  erros num toast.
- Preferências secretas vêm mascaradas da API e nunca mostram o valor; um chip diz se estão
  "Configurado" ou "Não configurado", e o campo vazio significa "manter o atual".
- Salvar atualiza a lista no cache do React Query e invalida as queries de preferências (o
  `useSetting` de outras telas lê a mesma lista).

Os valores de aceleração de hardware batem com o enum `HwAccel` do backend. **Confirmado**
(`domain/playback/transcode/spec/HwAccel.java`). Mas o contrato só traz `key`, `value`, `secret`,
`configured` e `updatedAt` de cada preferência — sem rótulo, descrição, tipo ou valores aceitos —,
por isso essas informações ficam no `META` do portal. **Backlog real** (confirmado pelo mantenedor,
pela política geral de regras de negócio no cliente de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais)): os metadados de cada preferência
deveriam vir do backend.

## Observações

- **Secret não pode ser apagado.** Como o campo vazio significa "manter o atual", o botão Salvar só
  habilita depois de digitar algo: dá para trocar o token do TMDB, mas não para apagá-lo pela tela.
  **Backlog real** (confirmado pelo mantenedor): falta uma ação explícita para limpar uma
  preferência secreta.
