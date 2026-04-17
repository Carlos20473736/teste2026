// ============================================
// PROTEÇÃO DE ROTAS - GRANINHA BOT
// ============================================
// Este script protege o acesso ao graninha-bot.html
// Exige que o usuário tenha completado 20 impressões + 2 cliques
// ============================================

(function() {
    'use strict';
    
    const API_BASE_URL = 'https://monetag-postback-server-production.up.railway.app/api/stats/user/';
    const REQUIRED_IMPRESSIONS = 20;
    const REQUIRED_CLICKS = 2;
    
    // Função para obter o ID da URL
    function getIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        // Tentar diferentes parâmetros possíveis
        return urlParams.get('id') || urlParams.get('ymid') || urlParams.get('user_id') || null;
    }
    
    // Função para redirecionar para a página de login
    function redirectToLogin(message) {
        console.log('[ROUTE PROTECTION] ' + message);
        alert(message);
        window.location.href = '/index.html';
    }
    
    // Função para verificar se o usuário completou as tarefas (20 impressões + 2 cliques)
    async function checkUserTasks(userId) {
        try {
            const response = await fetch(API_BASE_URL + userId);
            const data = await response.json();
            
            console.log('[ROUTE PROTECTION] Dados da API:', data);
            
            if (data.success) {
                const impressions = parseInt(data.total_impressions) || 0;
                const clicks = parseInt(data.total_clicks) || 0;
                
                console.log(`[ROUTE PROTECTION] Progresso: ${impressions}/${REQUIRED_IMPRESSIONS} impressões, ${clicks}/${REQUIRED_CLICKS} cliques`);
                
                // ========================================
                // VERIFICAÇÃO PRINCIPAL: Exigir 20 impressões + 2 cliques
                // Não basta ter impressões > 0, precisa ter completado TUDO
                // ========================================
                if (impressions < REQUIRED_IMPRESSIONS || clicks < REQUIRED_CLICKS) {
                    return {
                        authorized: false,
                        message: `Você precisa completar as tarefas primeiro!\n\nProgresso atual:\n- Impressões: ${impressions}/${REQUIRED_IMPRESSIONS}\n- Cliques: ${clicks}/${REQUIRED_CLICKS}\n\nVolte à página de missões para completar.`
                    };
                }
                
                return {
                    authorized: true,
                    impressions: impressions,
                    clicks: clicks
                };
            } else {
                return {
                    authorized: false,
                    message: 'ID inválido ou não encontrado. Faça login novamente.'
                };
            }
        } catch (error) {
            console.error('[ROUTE PROTECTION] Erro ao verificar API:', error);
            return {
                authorized: false,
                message: 'Erro ao verificar sua conta. Tente novamente.'
            };
        }
    }
    
    // Função principal de proteção
    async function protectRoute() {
        // 1. Verificar se tem ID na URL
        const userId = getIdFromUrl();
        
        if (!userId) {
            redirectToLogin('Acesso negado! Você precisa acessar esta página através do login com seu ID.');
            return false;
        }
        
        console.log('[ROUTE PROTECTION] ID encontrado na URL:', userId);
        
        // 2. Verificar se o usuário completou as tarefas (20 impressões + 2 cliques)
        const taskCheck = await checkUserTasks(userId);
        
        if (!taskCheck.authorized) {
            redirectToLogin(taskCheck.message);
            return false;
        }
        
        console.log(`[ROUTE PROTECTION] ✅ Acesso autorizado! Impressões: ${taskCheck.impressions}/${REQUIRED_IMPRESSIONS}, Cliques: ${taskCheck.clicks}/${REQUIRED_CLICKS}`);
        
        // 3. Armazenar o ID para uso posterior
        window.GRANINHA_USER_ID = userId;
        sessionStorage.setItem('graninha_user_id', userId);
        
        return true;
    }
    
    // Executar proteção imediatamente
    // Esconder o conteúdo até verificar
    document.documentElement.style.visibility = 'hidden';
    
    protectRoute().then(function(authorized) {
        if (authorized) {
            // Mostrar conteúdo se autorizado
            document.documentElement.style.visibility = 'visible';
        }
        // Se não autorizado, já foi redirecionado
    });
    
})();
