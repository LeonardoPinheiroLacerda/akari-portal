# src/features/providers

Lógica compartilhada sobre os provedores de arquivos (MEGA, disco local), usada pela tela de
Provedores e por várias outras telas que mostram de onde um arquivo vem (Catálogo, Cache,
Ingestão, Reprodução, Home).

| Arquivo                              | Papel                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- |
| [`useProviders.ts`](useProviders.ts) | Lista de provedores e um mapa por id (`byId`).                              |
| [`types.ts`](types.ts)               | Catálogo de tipos de provedor, nome exibido (`providerName`) e `usesCache`. |
| [`health.ts`](health.ts)             | Teste de conexão e o último resultado de cada provedor.                     |

## Lista de provedores (`useProviders`)

Pede todos os provedores numa página só (`size: 100`), já que a lista é pequena, e devolve também
um `Map` por id para as telas resolverem o provedor de uma pasta (`folder.storageProviderId`) ou de
um arquivo sem nova requisição.

## Catálogo de tipos (`types.ts`)

`PROVIDER_TYPES` descreve cada tipo aceito pelo backend: rótulo, ícone, categoria (nuvem ou local),
textos do card e os campos do formulário de cadastro — `email` e `password` para MEGA, `rootPath`
(caminho absoluto) para LOCAL. O formulário da tela de Provedores é montado a partir dessa lista.

O contrato só traz o enum `StorageProviderType` (`MEGA`, `LOCAL`) e descreve em texto os campos de
`config` de cada tipo; não há operação que liste os tipos e seus campos. **Confirmado**
(contrato, schema `StorageProviderType`). Por isso o catálogo é escrito no portal, e um tipo
novo no backend exige uma entrada nova aqui — até lá, `providerTypeDef` devolve uma definição
genérica para não quebrar a tela. **Backlog real** (confirmado pelo mantenedor, pela política geral
de regras de negócio no cliente de [`ARQUITETURA_DO_SISTEMA.md`](../../../docs/ARQUITETURA_DO_SISTEMA.md#regras-arquiteturais)):
o catálogo de tipos e campos deveria vir do backend.

`usesCache(type)` diz se os arquivos do provedor passam pelo cache de vídeo (todo tipo remoto) ou
são lidos direto do disco (LOCAL); a aba Reprodução usa isso para decidir se oferece "Enfileirar
download".

### Nome do provedor

`StorageProviderResponse` não tem nome — só `id`, `type` e `createdAt`. **Confirmado**
(contrato). O portal mostra `<rótulo do tipo> #<id>`, como "MEGA #3" ou "Disco local #5".
**Aceito** (confirmado pelo mantenedor): tipo e id bastam para identificar o provedor.

## Teste de conexão (`health.ts`)

- `testProvider(id)` chama o teste de conectividade da API e guarda o resultado: `ok`, `fail`
  (com o motivo quando a chamada falha) ou `testing` enquanto roda. `healthChip` traduz o estado
  para o chip exibido ("Conectado", "Sem conexão", "Testando…", "Não testado").
- A API responde `healthy: true/false`, sem motivo, e reserva o erro `502` para quando o próprio
  rclone está fora do ar — nesse caso o motivo exibido é a mensagem do erro. **Confirmado**
  (contrato, operação `checkStorageProviderHealth`).
- O backend não guarda o resultado do teste. O portal guarda o último resultado de cada provedor
  no navegador (`akari.providerHealth`) e o compartilha entre as telas com um store próprio
  (`useSyncExternalStore`). Um "Testando…" de uma sessão anterior é descartado ao recarregar.
  Outra máquina vê "Não testado" até testar de novo. **Aceito** (confirmado pelo mantenedor): é
  só uma conveniência local.
- **Falso positivo no MEGA.** O backend do rclone guarda em memória a sessão autenticada do MEGA
  por e-mail; enquanto o rclone não reinicia, o teste pode dar "Conectado" mesmo com a senha atual
  errada. **Confirmado** (`../akari/.../provider/client/RemoteStorageProviderClient.java`, Javadoc
  de `checkConnection`), aceito como trade-off no backend.
