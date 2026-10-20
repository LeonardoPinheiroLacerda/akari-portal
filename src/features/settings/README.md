# src/features/settings

Leitura das preferências do sistema fora da tela de Preferências. A edição fica na própria tela
([`src/pages/preferences`](../../pages/preferences)); aqui só há o hook de leitura usado por outras
telas.

## `useSetting(key)`

Devolve a preferência da chave pedida (`setting`), junto com o estado da query.

- O contrato não tem leitura de uma preferência pela chave: `/v1/settings/{key}` só aceita `PUT`.
  **Confirmado** (contrato, operações `listSettings` e `updateSetting`). Por isso o hook
  lista todas e filtra; a lista é pequena e fica em cache por 1 minuto, compartilhada entre todas as
  chamadas.
- Preferências secretas vêm com `value` mascarado (`***`), nunca o valor cru; para saber se uma
  delas está preenchida, use `configured`. **Confirmado** (contrato, schema
  `SettingResponse`).

### Onde é usado

| Tela        | Chave                   | Para quê                                                                          |
| ----------- | ----------------------- | --------------------------------------------------------------------------------- |
| Ingestão    | `tmdb.api-key`          | Com a chave vazia (`configured: false`), avisar e desabilitar "Iniciar ingestão". |
| Item › TMDB | `tmdb.default-language` | Idioma inicial da busca no TMDB.                                                  |

O bloqueio da Ingestão antecipa uma regra do backend, que recusa a ingestão com `400` quando
`tmdb.api-key` está vazia. **Confirmado** (contrato, operação de ingestão; `IngestionService`
no backend). A regra vale no backend mesmo que o aviso do portal falhe.
