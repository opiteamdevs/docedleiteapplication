import { SUPABASE_URL } from '/config.js';

export async function ensurePrivateApiKey(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  if (!session?.access_token) return { ok: false, reason: 'no-session' };

  // Evita gerar uma chave candidata a cada visita quando a conta já tem uma ativa.
  const current = await getPrivateApiKeyStatus(supabase);
  if (current.active) return { ok: true, alreadyActive: true };

  const response = await fetch(`${SUPABASE_URL}/api/private-key/ensure`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!response.ok) throw new Error(`Falha ao provisionar chave privada (HTTP ${response.status}).`);
  return response.json();
}

export async function getPrivateApiKeyStatus(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  if (!session?.access_token) throw new Error('Entre na sua conta primeiro.');
  const response = await fetch(`${SUPABASE_URL}/api/private-key/status`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) throw new Error(`Falha ao consultar status (HTTP ${response.status}).`);
  return response.json();
}
