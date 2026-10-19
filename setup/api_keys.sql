-- Doce de Leite: chaves privadas automáticas e limite de 100.000 usos.
-- Execute no SQL Editor do projeto Supabase. Não use SUPABASE_SERVICE_ROLE_KEY.
create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  key_hash text not null unique,
  cifra jsonb not null,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);

create unique index if not exists api_keys_uma_automatica_ativa
  on public.api_keys (user_id, nome)
  where nome = 'chave-automatica' and revoked = false;

create table if not exists public.api_usage (
  dono text not null,
  janela bigint not null default 0,
  total integer not null default 0 check (total >= 0),
  primary key (dono, janela)
);

alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
revoke all on public.api_keys from anon, authenticated;
revoke all on public.api_usage from anon, authenticated;

-- Execute esta linha UMA vez, substituindo o texto pelo mesmo API_KEY_RPC_SECRET
-- que será configurado como secret no Cloudflare Worker. Nunca use o segredo de criptografia aqui.
-- select vault.create_secret('SUBSTITUA_PELO_API_KEY_RPC_SECRET', 'ddl_worker_rpc_secret', 'Segredo interno do Worker Doce de Leite');

create or replace function public.dl_ensure_api_key(
  p_id text, p_hash text, p_cifra jsonb, p_internal_secret text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_expected_secret text;
begin
  if v_user_id is null then raise exception 'Sessão não autenticada'; end if;
  select decrypted_secret into v_expected_secret
    from vault.decrypted_secrets where name = 'ddl_worker_rpc_secret' limit 1;
  if v_expected_secret is null or p_internal_secret is distinct from v_expected_secret then
    raise exception 'Não autorizado';
  end if;
  if p_id !~ '^[a-f0-9-]{36}$' or p_hash !~ '^[a-f0-9]{64}$' or p_cifra is null then
    raise exception 'Dados inválidos';
  end if;
  insert into public.api_keys (id,user_id,nome,key_hash,cifra,revoked)
  values (p_id,v_user_id,'chave-automatica',p_hash,p_cifra,false)
  on conflict do nothing;
  return exists (
    select 1 from public.api_keys
    where user_id = v_user_id and nome = 'chave-automatica' and revoked = false
  );
end;
$$;
revoke all on function public.dl_ensure_api_key(text,text,jsonb,text) from public, anon;
grant execute on function public.dl_ensure_api_key(text,text,jsonb,text) to authenticated;

create or replace function public.dl_private_key_status(p_internal_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_expected_secret text;
  v_key_id text;
  v_used integer := 0;
begin
  if v_user_id is null then raise exception 'Sessão não autenticada'; end if;
  select decrypted_secret into v_expected_secret
    from vault.decrypted_secrets where name = 'ddl_worker_rpc_secret' limit 1;
  if v_expected_secret is null or p_internal_secret is distinct from v_expected_secret then
    raise exception 'Não autorizado';
  end if;
  select id into v_key_id from public.api_keys
   where user_id = v_user_id and nome = 'chave-automatica' and revoked = false limit 1;
  if v_key_id is null then return jsonb_build_object('active',false,'used',0,'limit',100000); end if;
  select total into v_used from public.api_usage where dono = v_key_id and janela = 0;
  return jsonb_build_object('active',true,'used',coalesce(v_used,0),'limit',100000);
end;
$$;
revoke all on function public.dl_private_key_status(text) from public, anon;
grant execute on function public.dl_private_key_status(text) to authenticated;

-- Chamado apenas pelo Worker. A quota é vitalícia por chave (janela=0).
create or replace function public.dl_consume_api_key(p_key_hash text, p_internal_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_expected_secret text;
  v_key_id text;
  v_total integer;
begin
  select decrypted_secret into v_expected_secret
    from vault.decrypted_secrets where name = 'ddl_worker_rpc_secret' limit 1;
  if v_expected_secret is null or p_internal_secret is distinct from v_expected_secret then
    raise exception 'Não autorizado';
  end if;
  select id into v_key_id from public.api_keys
   where key_hash = p_key_hash and revoked = false limit 1;
  if v_key_id is null then return jsonb_build_object('allowed',false,'used',0,'limit',100000); end if;
  insert into public.api_usage (dono,janela,total) values (v_key_id,0,1)
  on conflict (dono,janela) do update
    set total = api_usage.total + 1
    where api_usage.total < 100000
  returning total into v_total;
  if v_total is null then
    return jsonb_build_object('allowed',false,'used',100000,'limit',100000);
  end if;
  return jsonb_build_object('allowed',true,'used',v_total,'limit',100000);
end;
$$;
revoke all on function public.dl_consume_api_key(text,text) from public;
grant execute on function public.dl_consume_api_key(text,text) to anon, authenticated;
