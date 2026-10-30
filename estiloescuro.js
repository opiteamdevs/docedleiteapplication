// ==========================================================
// 🌙 GERENCIADOR GLOBAL DE MODO ESCURO
// ==========================================================

(function() {
    // 1. Aplica o tema imediatamente antes da página renderizar (evita flash branco)
    const temaSalvo = localStorage.getItem('ddl_theme');
    if (temaSalvo === 'dark') {
        document.documentElement.classList.add('dark-theme');
    }

    // 2. Função global para alternar e salvar o tema em qualquer página
    window.alternarModoEscuro = function(ativar) {
        if (ativar) {
            document.documentElement.classList.add('dark-theme');
            localStorage.setItem('ddl_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark-theme');
            localStorage.setItem('ddl_theme', 'light');
        }
    };

    // 3. Sincroniza automaticamente com um switch/checkbox se ele existir na página atual
    document.addEventListener('DOMContentLoaded', () => {
        const darkToggle = document.getElementById('darkModeToggle');
        if (darkToggle) {
            darkToggle.checked = (localStorage.getItem('ddl_theme') === 'dark');
            
            darkToggle.addEventListener('change', () => {
                window.alternarModoEscuro(darkToggle.checked);
            });
        }
    });
})();
