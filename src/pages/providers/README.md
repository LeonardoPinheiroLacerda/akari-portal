# src/pages/providers

Tela **Provedores** (`/provedores`): cadastro, edição, teste de conexão e remoção dos provedores
de arquivos. A lógica compartilhada (tipos, nome exibido, teste de conexão) fica em
[`src/features/providers`](../../features/providers/README.md).

| Arquivo                                    | Papel                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| [`ProvidersPage.tsx`](ProvidersPage.tsx)   | Lista de provedores em cards, "Testar todos", estado vazio e remoção.   |
| [`ProviderDialog.tsx`](ProviderDialog.tsx) | Diálogo de cadastro e edição: tipo → configuração → resultado do teste. |

## Lista

- Cada card mostra o nome ("MEGA #3"), o tipo, o comportamento (com ou sem cache), a data de
  cadastro, o chip do último teste de conexão e as ações: Testar, Editar, Pastas e Remover.
- "Pastas" abre o Catálogo filtrado pelo provedor (`/catalogo?storageProviderId=<id>`).
- "Testar todos" dispara o teste de todos os provedores ao mesmo tempo; o resumo do topo conta
  quantos estão sem conexão.
- Sem provedores, a tela mostra os três passos para começar e o botão de cadastrar.

## Cadastro e edição (`ProviderDialog`)

1. **Tipo** — só no cadastro: busca e filtro por categoria (Nuvem, Local e rede) sobre o catálogo
   de tipos de `src/features/providers`.
2. **Configuração** — formulário montado a partir dos campos do tipo, validado com Zod (obrigatório,
   e-mail, caminho absoluto). Erros de validação do backend (`VALIDATION_ERROR`) voltam para o
   campo certo (`config.email` → `email`); outros erros viram toast.
3. **Resultado** — depois de salvar, o portal testa a conexão na hora e mostra se o provedor
   respondeu. Sem conexão, oferece voltar ao formulário; o provedor já fica salvo mesmo assim.

O tipo não muda depois do cadastro: a edição só troca a configuração. **Confirmado**
(contrato, `updateStorageProviderConfig`: "`type` é imutável").

### Edição começa vazia

A API nunca devolve a configuração de um provedor — `config` é omitido de propósito para não expor
credenciais — e o `PUT` de configuração substitui o mapa inteiro. **Confirmado** (contrato,
`StorageProviderResponse` e `updateStorageProviderConfig`). Por isso o formulário de edição abre
vazio e todos os campos, inclusive e-mail e caminho, precisam ser digitados de novo. **Aceito**
(confirmado pelo mantenedor): as credenciais nunca voltam do backend, e redigitar é o preço disso.

## Remoção

O botão de remover pede confirmação no próprio card e chama `DELETE /v1/storage/providers/{id}`.

A confirmação diz que as pastas e os arquivos ingeridos a partir do provedor também saem do
catálogo — é o comportamento esperado da remoção. Hoje o backend não faz isso:
`media_folder.storage_provider_id` não tem `ON DELETE CASCADE` (`V2__create-catalog-tables.sql`)
e `StorageProviderService.deleteStorageProvider` só apaga o provedor, então remover um provedor que
ainda tem pastas falha por violação de chave estrangeira e a tela mostra o erro. **Confirmado** no
código do backend (sem teste na tela, para não apagar dados). **Backlog real** (confirmado pelo
mantenedor): a correção é no backend `akari`, removendo pastas, arquivos e vínculos junto com o
provedor; o texto do portal já descreve o comportamento desejado.
