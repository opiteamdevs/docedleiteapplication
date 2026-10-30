export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // REGRA 1: Se acessar "/u/" contendo o parâmetro "?q=nome", força o redirecionamento para "/@nome"
    if (path.startsWith('/u/')) {
      const usernameParam = url.searchParams.get('q');
      if (usernameParam) {
        // Redireciona o navegador para o formato limpo com @
        const newUrl = `${url.origin}/@${usernameParam}`;
        return Response.redirect(newUrl, 302);
      }
    }

    // REGRA 2: Se o link na barra de endereço for "/@nome", mantém o visual mas processa a pasta "/u/" internamente
    if (path.startsWith('/@')) {
      const username = path.substring(2); // Extrai o nome após o "/@"

      // Altera o caminho interno para a sua rota real (/u/)
      url.pathname = '/u/'; 
      // Injeta o parâmetro que seu index.html ou backend dentro de /u/ já espera
      url.searchParams.set('q', username);

      // Busca o conteúdo em segundo plano sem mudar a URL do usuário
      return fetch(new Request(url, request));
    }

    // Para qualquer outra página ou arquivo estático do site, roda normal
    return fetch(request);
  }
};
