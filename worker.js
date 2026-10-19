const ALLOWED_ORIGINS = new Set([
  'https://docedleite.com.br',
  'https://www.docedleite.com.br',
  'https://m.docedleite.com.br'
]);
const KEY_LIMIT = 100000;
const encoder = new TextEncoder();

function cors(origin) {
  const h = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,apikey,x-client-info,Prefer,Range',
    'Access-Control-Max-Age': '86400'
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) h.set('Access-Control-Allow-Origin', origin);
  return h;
}
function json(body, status, origin) {
  const headers = cors(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}
function getBearer(request) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}
function bytesToHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex || '')) throw new Error('Invalid encryption secret');
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
async function sha256Hex(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function encryptKey(rawKey, secretHex) {
  const cryptoKey = await crypto.subtle.importKey('raw', hexToBytes(secretHex), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoder.encode(rawKey));
  return { alg: 'A256GCM', iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}
function checkEnv(env) {
  for (const name of ['SUPABASE_PROJECT_URL', 'SUPABASE_PUBLISHABLE_KEY', 'API_KEY_ENCRYPTION_SECRET', 'API_KEY_RPC_SECRET']) {
    if (!env[name]) throw new Error(`Missing Worker secret/config: ${name}`);
  }
}
function supabaseUrl(env, path) {
  return env.SUPABASE_PROJECT_URL.replace(/\/+$/, '') + path;
}
async function supabaseFetch(env, path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', env.SUPABASE_PUBLISHABLE_KEY);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return fetch(supabaseUrl(env, path), {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual'
  });
}
async function getAuthenticatedUser(env, token) {
  if (!token || token.startsWith('dl_')) return null;
  const response = await supabaseFetch(env, '/auth/v1/user', { token });
  if (!response.ok) return null;
  return response.json();
}
async function ensurePrivateKey(request, env, origin) {
  const token = getBearer(request);
  const user = await getAuthenticatedUser(env, token);
  if (!user?.id) return json({ error: 'Sessão inválida.' }, 401, origin);

  // A candidate is generated server-side. It is never returned to the browser.
  const rawKey = `dl_${bytesToHex(crypto.getRandomValues(new Uint8Array(32)))}`;
  const keyHash = await sha256Hex(rawKey);
  const cipher = await encryptKey(rawKey, env.API_KEY_ENCRYPTION_SECRET);
  const response = await supabaseFetch(env, '/rest/v1/rpc/dl_ensure_api_key', {
    method: 'POST', token,
    body: {
      p_id: crypto.randomUUID(),
      p_hash: keyHash,
      p_cifra: cipher,
      p_internal_secret: env.API_KEY_RPC_SECRET
    }
  });
  if (!response.ok) return json({ error: 'Não foi possível provisionar a chave privada.' }, 503, origin);
  return json({ ok: true }, 200, origin);
}
async function privateKeyStatus(request, env, origin) {
  const token = getBearer(request);
  const user = await getAuthenticatedUser(env, token);
  if (!user?.id) return json({ error: 'Sessão inválida.' }, 401, origin);
  const response = await supabaseFetch(env, '/rest/v1/rpc/dl_private_key_status', {
    method: 'POST', token,
    body: { p_internal_secret: env.API_KEY_RPC_SECRET }
  });
  if (!response.ok) return json({ error: 'Não foi possível consultar o status da chave.' }, 503, origin);
  const result = await response.json();
  return json({ active: Boolean(result?.active), used: Number(result?.used || 0), limit: KEY_LIMIT }, 200, origin);
}
async function meterApiKey(request, env, origin) {
  const key = getBearer(request);
  if (!/^dl_[a-f0-9]{64}$/i.test(key)) return json({ error: 'Chave de API inválida.' }, 401, origin);
  const response = await supabaseFetch(env, '/rest/v1/rpc/dl_consume_api_key', {
    method: 'POST',
    body: { p_key_hash: await sha256Hex(key), p_internal_secret: env.API_KEY_RPC_SECRET }
  });
  if (!response.ok) return json({ error: 'Não foi possível validar o uso da chave.' }, 503, origin);
  const result = await response.json();
  if (!result?.allowed) return json({ error: 'Limite de 100.000 usos atingido.', used: Number(result?.used || KEY_LIMIT), limit: KEY_LIMIT }, 429, origin);
  return json({ ok: true, used: Number(result.used), limit: KEY_LIMIT }, 200, origin);
}
async function proxySupabase(request, env, origin, url) {
  const target = new URL(env.SUPABASE_PROJECT_URL);
  target.pathname = url.pathname;
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.set('apikey', env.SUPABASE_PUBLISHABLE_KEY);
  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual'
  });
  const outHeaders = new Headers(response.headers);
  const corsHeaders = cors(origin);
  for (const [key, value] of corsHeaders) outHeaders.set(key, value);
  outHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não permitida.' }, 403, origin);

    try {
      checkEnv(env);
      if (url.pathname === '/api/private-key/ensure') {
        if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);
        return await ensurePrivateKey(request, env, origin);
      }
      if (url.pathname === '/api/private-key/status') {
        if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, origin);
        return await privateKeyStatus(request, env, origin);
      }
      // Todos os endpoints públicos da API devem ficar sob /api/v1/ para aplicar a quota.
      if (url.pathname === '/api/v1/usage') {
        if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, origin);
        return await meterApiKey(request, env, origin);
      }
      if (url.pathname.startsWith('/api/v1/')) return json({ error: 'Endpoint de API ainda não implementado.' }, 404, origin);
      if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/v1/')) {
        return await proxySupabase(request, env, origin, url);
      }
      return json({ error: 'Não encontrado.' }, 404, origin);
    } catch (error) {
      console.error('Worker error:', error?.message || 'unknown');
      return json({ error: 'Erro interno do servidor.' }, 500, origin);
    }
  }
};
