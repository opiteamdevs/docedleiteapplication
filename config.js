// Config pública do site — NÃO contém segredo.
// O navegador fala com o proxy (Worker em server.docedleite.com.br); a chave real fica só nos secrets dele.
export const SUPABASE_URL = 'https://aoenxxscghmtzzbarnyy.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvZW54eHNjZ2htdHp6YmFybnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTMxNjksImV4cCI6MjEwMzc2OTE2OX0.xpDzrKo9N5y27GSTiBYs7VI6nl0UtFjI9TLPG7ZSmUY';
// Chave pública do Stripe (pode ficar no navegador, só a secreta não pode)
export const STRIPE_PUBLIC_KEY = 'pk_test_SUA_CHAVE_PUBLICA_DO_STRIPE';
export const STRIPE_PRICE_ID = 'price_SEU_PRICE_ID_AQUI';
