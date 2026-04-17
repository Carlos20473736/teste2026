/**
 * ============================================================
 *  BLOQUEIO DE CLIQUES BASEADO NA API DO MONETAG
 * ============================================================
 * 
 * Copiado e adaptado da Roleta (Young Money / pix-assistindo).
 * 
 * Funcionalidades:
 *   1. Consulta a API de stats para verificar total de cliques
 *   2. Se atingiu MAX_CLICKS, cria overlay transparente bloqueando
 *      TODOS os eventos de interação (click, touch, etc.)
 *   3. Mostra mensagem de "Limite Atingido" com countdown
 *   4. Recarrega a página após countdown
 *   5. Polling a cada 1s para detectar mudanças em tempo real
 * 
 * Deve ser carregado DEPOIS do telegram-env.js e postback-tracker.js.
 * ============================================================
 */
(function() {
  'use strict';

  var MAX_CLICKS = 2;
  var API_URL = 'https://monetag-postback-server-production.up.railway.app/api/stats/user/';
  var blockingActive = false;
  var pollingInterval = null;

  console.log('[MONETAG BLOCKER] Sistema iniciado');
  console.log('[MONETAG BLOCKER] Limite: ' + MAX_CLICKS + ' clicks');

  var userId = localStorage.getItem('user_id');

  if (!userId) {
    console.warn('[MONETAG BLOCKER] user_id não encontrado no localStorage — bloqueio inativo');
    return;
  }

  console.log('[MONETAG BLOCKER] User ID: ' + userId);
  console.log('[MONETAG BLOCKER] API URL: ' + API_URL + userId);

  // ============================================================
  //  CAMADA DE BLOQUEIO TRANSPARENTE
  //  Bloqueia TODOS os eventos de interação quando limite atingido
  // ============================================================
  function createBlockingLayer() {
    if (blockingActive) return;
    blockingActive = true;

    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    var overlay = document.createElement('div');
    overlay.id = 'monetag-click-blocker';
    overlay.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;background:transparent !important;z-index:2147483647 !important;cursor:not-allowed !important;pointer-events:auto !important;';

    var events = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'contextmenu', 'dblclick', 'pointerdown', 'pointerup'];
    events.forEach(function(eventType) {
      overlay.addEventListener(eventType, function(e) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        console.log('[MONETAG BLOCKER] Evento ' + eventType + ' bloqueado — limite de cliques atingido');
        return false;
      }, true);
    });

    document.body.appendChild(overlay);
    console.log('[MONETAG BLOCKER] Camada de bloqueio ativada!');

    // Mostrar mensagem após 500ms
    setTimeout(showSuccessMessage, 500);
  }

  // ============================================================
  //  MENSAGEM DE LIMITE ATINGIDO + COUNTDOWN
  // ============================================================
  function showSuccessMessage() {
    if (document.getElementById('success-overlay')) return;

    var successOverlay = document.createElement('div');
    successOverlay.id = 'success-overlay';
    successOverlay.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;background:rgba(15,23,42,0.98) !important;z-index:2147483648 !important;display:flex !important;align-items:center !important;justify-content:center !important;animation:blocker-fadeIn 0.3s ease !important;';

    var timeLeft = 15;

    var message = document.createElement('div');
    message.style.cssText = 'text-align:center !important;';
    message.innerHTML = '<div style="width:80px;height:80px;margin:0 auto 24px;background:rgba(239,68,68,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '</div>' +
      '<h1 style="margin:0 0 12px;color:#fff;font-size:28px;font-weight:700;font-family:Inter,sans-serif;">Limite Atingido</h1>' +
      '<p style="margin:0 0 32px;color:rgba(255,255,255,0.6);font-size:15px;font-family:Inter,sans-serif;">' +
        'Voce completou <strong style="color:#3b82f6;">' + MAX_CLICKS + ' clicks</strong> com sucesso.' +
      '</p>' +
      '<div style="padding:16px 32px;background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.1);">' +
        '<p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;font-family:Inter,sans-serif;">Redirecionando em</p>' +
        '<div id="blocker-countdown" style="font-size:48px;font-weight:800;color:#3b82f6;font-family:Inter,sans-serif;">' + timeLeft + '</div>' +
      '</div>';

    successOverlay.appendChild(message);
    document.body.appendChild(successOverlay);

    // Countdown
    var countdownInterval = setInterval(function() {
      timeLeft--;
      var countdownElement = document.getElementById('blocker-countdown');
      if (countdownElement) {
        countdownElement.textContent = timeLeft;
      }
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        window.location.reload();
      }
    }, 1000);

    // Animação fadeIn
    if (!document.getElementById('monetag-blocker-animations')) {
      var style = document.createElement('style');
      style.id = 'monetag-blocker-animations';
      style.textContent = '@keyframes blocker-fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      document.head.appendChild(style);
    }

    console.log('[MONETAG BLOCKER] Mensagem de limite exibida — countdown de ' + timeLeft + 's');
  }

  // ============================================================
  //  CONSULTA API DE STATS
  // ============================================================
  function checkClicks() {
    fetch(API_URL + userId, { method: 'GET', mode: 'cors' })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.success && typeof data.total_clicks === 'number') {
          var totalClicks = data.total_clicks;
          console.log('[MONETAG BLOCKER] Cliques atuais: ' + totalClicks + '/' + MAX_CLICKS);

          if (totalClicks >= MAX_CLICKS) {
            console.log('[MONETAG BLOCKER] Limite atingido! Ativando bloqueio...');
            createBlockingLayer();
          }
        }
      })
      .catch(function(error) {
        console.error('[MONETAG BLOCKER] Erro ao consultar API:', error);
      });
  }

  // ============================================================
  //  INICIALIZAÇÃO
  // ============================================================
  // Verificar imediatamente
  checkClicks();

  // Polling a cada 1 segundo
  pollingInterval = setInterval(function() {
    if (!blockingActive) {
      checkClicks();
    }
  }, 1000);

  console.log('[MONETAG BLOCKER] Polling ativo — verificando a cada 1s');
})();
