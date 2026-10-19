// Config pública do site — NÃO contém segredo.
// O navegador fala com o proxy (Worker em server.docedleite.com.br); a chave real fica só nos secrets dele.
export const SUPABASE_URL = 'https://server.docedleite.com.br';
export const SUPABASE_PUBLISHABLE_KEY = 'via-proxy';
// Chave pública do Stripe (pode ficar no navegador, só a secreta não pode)
export const STRIPE_PUBLIC_KEY = 'pk_test_SUA_CHAVE_PUBLICA_DO_STRIPE';
export const STRIPE_PRICE_ID = 'price_SEU_PRICE_ID_AQUI';
