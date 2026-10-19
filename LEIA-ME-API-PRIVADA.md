# Doce de Leite — alterações da API privada

Este pacote preserva os arquivos recebidos e adiciona a integração da chave privada automática. Foram alterados os fluxos de login/cadastro, o FYP e a autenticação da página de criar post; foi adicionada a página `/chaves/`, o Worker e o SQL de configuração.

## O que foi feito

- Depois do login e, quando a sessão já existe, no FYP e no fluxo de login da página de posts, o navegador pede ao Worker para garantir que a conta tenha uma chave privada.
- O valor `dl_...` é gerado no Worker, cifrado com AES-GCM e armazenado como cifra + hash no Supabase. O valor original não é retornado ao navegador.
- A página `/chaves/` mostra apenas o estado e o total de usos; não revela a chave.
- O Worker usa apenas a chave pública/publishable do Supabase e segredos configurados no servidor. Não usa `SUPABASE_SERVICE_ROLE_KEY`.
- O SQL cria as tabelas e funções necessárias para contabilizar até 100.000 usos por chave. O limite se aplica às requisições que passam pela rota de API `/api/v1/` quando o endpoint for implementado e passar pelo medidor; ainda não existe integração de pagamento nem bloqueio/desbloqueio automático por pagamento.

## Configuração necessária antes de publicar

### 1. Segredos do Worker

Configure estes valores em **Cloudflare Workers → Settings → Variables and Secrets** (os dois últimos devem ser do tipo Secret):

- `SUPABASE_PROJECT_URL`: URL real do projeto Supabase, por exemplo `https://SEU-PROJETO.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY`: chave pública/publishable do projeto Supabase.
- `API_KEY_ENCRYPTION_SECRET`: segredo aleatório de 32 bytes, em hexadecimal (64 caracteres).
- `API_KEY_RPC_SECRET`: outro segredo aleatório, diferente do de criptografia.

O valor de `API_KEY_RPC_SECRET` deve ser igual ao valor guardado no Supabase Vault com o nome `ddl_worker_rpc_secret`. Não coloque nenhum desses segredos em `config.js`, HTML, JavaScript público ou no repositório. Se algum segredo já foi compartilhado em conversa ou publicado, gere outro antes de usar.

### 2. Supabase Vault e SQL

No SQL Editor, execute `setup/api_keys.sql`. Antes, remova o comentário da linha `select vault.create_secret(...)` e substitua o placeholder pelo valor do `API_KEY_RPC_SECRET`. Execute essa linha apenas uma vez, ou confira/atualize o segredo Vault se já existir. O Vault precisa estar habilitado no projeto. Não coloque `API_KEY_ENCRYPTION_SECRET` no Vault; ele fica apenas como Secret do Worker.

### 3. Worker e domínio

Publique `worker.js` como Worker dedicado e configure `server.docedleite.com.br` para apontar para ele. O site em `m.docedleite.com.br` continua sendo servido pelo seu hosting estático. O Worker recebe `/api/private-key/*`, faz proxy de `/auth/v1/*` e `/rest/v1/*` para o Supabase e permite somente as origens configuradas no início do arquivo. Se o domínio de origem do site mudar, atualize `ALLOWED_ORIGINS`.

A configuração `config.js` deste ZIP já aponta para `https://server.docedleite.com.br` e usa `via-proxy` como chave pública fictícia para que o Worker substitua o header `apikey`. Confirme que esse é o domínio correto do Worker antes de publicar.

### 4. Verificação

1. Confirme que o Worker tem os quatro valores acima.
2. Execute o SQL e confirme que não houve erro de função/Vault.
3. Publique os arquivos estáticos e o Worker.
4. Entre com uma conta de teste e abra `/chaves/`.
5. Confirme que a página mostra `Ativa` e que o navegador não recebe uma chave `dl_...` em nenhuma resposta.

## Limitações conhecidas / não publicar às cegas

- Este pacote foi validado por inspeção estática e checagem de sintaxe do Worker, mas não foi possível testar contra seu projeto Supabase/Cloudflare real sem os segredos e sem acesso de implantação.
- O código existente de login/cadastro e o esquema atual do banco podem ter requisitos adicionais. Teste login, cadastro, OAuth, FYP e criação de post com uma conta de teste antes de substituir o site publicado.
- A chave é intencionalmente privada e não é recuperável pelo navegador. Se a intenção era mostrar uma chave ao usuário para copiar e usar em integrações externas, isso é um requisito diferente e exige outro desenho de segurança.
- O limite de 100.000 usos é contabilizado pela função SQL `dl_consume_api_key`; a API pública ainda precisa ter cada endpoint real implementado atrás desse medidor. Não há integração de cobrança automática incluída.
