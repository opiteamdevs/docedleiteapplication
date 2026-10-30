export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const usernameParam = url.searchParams.get('q');

    // REGRA 1: Se alguém tentar acessar usando "?q=nome", força ir para "/@nome"
    if (usernameParam) {
      // Cria a nova URL limpa: ex: docedleite.com.br/@nome
      const newUrl = `${url.origin}/@${usernameParam}`;
      
      // Envia o usuário instantaneamente para o link com @
      return Response.redirect(newUrl, 302); 
    }

    // REGRA 2: Se o link já for "/@nome", mantém o visual mas processa a lógica antiga
    if (url.pathname.startsWith('/@')) {
      const username = url.pathname.substring(2); // Remove o "/@" para pegar só o nome

      // Transforma a requisição internamente para o formato que seu código precisa
      url.pathname = '/'; // Altere aqui se a sua página principal de perfil for outra (ex: /perfil)
      url.searchParams.set('q', username);

      // Entrega o conteúdo mantendo o "@nome" brilhando na barra de endereço
      return fetch(new Request(url, request));
    }

    // Se não for nenhuma das rotas acima, carrega o site normalmente
    return fetch(request);
  }
};
