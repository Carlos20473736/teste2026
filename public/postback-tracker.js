/**
 * ============================================================
 *  POSTBACK TRACKER — Clique + Impressão + Preço Real
 * ============================================================
 * 
 * Extraído e adaptado da Roleta (Young Money).
 * 
 * Funcionalidades:
 *   1. sendPostback(eventType) — envia impression/click ao servidor Monetag
 *   2. Hook no SDK para capturar estimated_price REAL
 *   3. Detecção de clique via blur/visibilitychange (usuário saiu da aba)
 *   4. Anti-duplicação (25s cooldown por tipo de evento)
 *   5. Expõe window.__postbackTracker para o React usar
 * 
 * Deve ser carregado DEPOIS do telegram-env.js e ANTES do React.
 * ============================================================
 */
(function() {
  'use strict';

  // ============================================================
  //  CONFIGURAÇÃO
  // ============================================================
  var ZONE_ID = '10670317';
  var SDK_NAME = 'show_' + ZONE_ID;
  var POSTBACK_URL = 'https://monetag-postback-server-production.up.railway.app/api/postback';
  var STATS_URL = 'https://monetag-postback-server-production.up.railway.app/api/stats/user/';

  // ============================================================
  //  ESTADO
  // ============================================================
  var __lastPostbackTime = 0;
  var __lastPostbackType = '';
  var __adInProgress = false;
  var __adStartTime = 0;

  // Preço real capturado do SDK
  window.__lastRealMonetagPrice = null;

  // ============================================================
  //  SEND POSTBACK
  // ============================================================
  function sendPostback(eventType) {
    var now = Date.now();
    // Anti-duplicação: ignorar se mesmo tipo em menos de 25s
    if (now - __lastPostbackTime < 25000 && __lastPostbackType === eventType) {
      console.log('[POSTBACK] Ignorando ' + eventType + ' — duplicado (< 25s)');
      return;
    }
    __lastPostbackTime = now;
    __lastPostbackType = eventType;

    var userId = localStorage.getItem('user_id') || '';
    var userEmail = localStorage.getItem('user_email') || '';

    if (!userId) {
      console.warn('[POSTBACK] Sem YMID — postback não enviado');
      return;
    }

    // Preço real do Monetag ou fallback
    var price;
    if (window.__lastRealMonetagPrice && window.__lastRealMonetagPrice > 0) {
      price = window.__lastRealMonetagPrice.toFixed(6);
      console.log('[POSTBACK] Preço REAL do Monetag: $' + price);
    } else {
      price = eventType === 'click' ? '0.0045' : '0.0023';
      console.log('[POSTBACK] Fallback: $' + price);
    }

    var params = new URLSearchParams({
      event_type: eventType,
      zone_id: ZONE_ID,
      ymid: userId,
      user_email: userEmail,
      estimated_price: price
    });

    console.log('[POSTBACK] Enviando ' + eventType + ' para YMID ' + userId + '...');
    fetch(POSTBACK_URL + '?' + params.toString(), { method: 'GET', mode: 'cors' })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        console.log('[POSTBACK] ' + eventType + ' enviado com sucesso:', data);
        // Disparar evento custom para o React atualizar
        window.dispatchEvent(new CustomEvent('postback-sent', { detail: { type: eventType, data: data } }));
      })
      .catch(function(err) {
        console.error('[POSTBACK] Erro ao enviar ' + eventType + ':', err);
      });
  }

  // ============================================================
  //  FETCH STATS
  // ============================================================
  function fetchStats(userId, callback) {
    if (!userId) { if (callback) callback(null); return; }
    fetch(STATS_URL + userId, { method: 'GET', mode: 'cors' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (callback) callback(data);
        window.dispatchEvent(new CustomEvent('stats-updated', { detail: data }));
      })
      .catch(function(err) {
        console.error('[STATS] Erro:', err);
        if (callback) callback(null);
      });
  }

  // ============================================================
  //  HOOK NO SDK — Captura preço real + detecção de clique
  // ============================================================
  function hookSDKForRealPrice() {
    var checkInterval = setInterval(function() {
      if (window[SDK_NAME] && !window._sdkPriceHooked) {
        var originalShow = window[SDK_NAME];

        window[SDK_NAME] = function(options) {
          var result;
          try {
            result = originalShow.call(this, options);
          } catch(err) {
            console.error('[SDK HOOK] Erro:', err);
            throw err;
          }

          if (result && typeof result.then === 'function') {
            return result.then(function(data) {
              if (data) {
                // Capturar preço REAL
                if (data.estimated_price !== undefined && data.estimated_price !== null) {
                  var realPrice = parseFloat(data.estimated_price);
                  window.__lastRealMonetagPrice = realPrice;
                  console.log('[SDK HOOK] Preço REAL: $' + realPrice.toFixed(6));
                }
                if (data.reward_event_type) {
                  console.log('[SDK HOOK] Tipo: ' + data.reward_event_type +
                    (data.reward_event_type === 'valued' ? ' — MONETIZADO' : ' — NÃO MONETIZADO'));
                }
              }
              return data;
            }).catch(function(promiseErr) {
              console.warn('[SDK HOOK] Erro na Promise:', promiseErr);
              throw promiseErr;
            });
          }
          return result;
        };

        window._sdkPriceHooked = true;
        clearInterval(checkInterval);
        console.log('[SDK HOOK] SDK hookado — capturando preço real');
      }
    }, 1000);
  }

  // ============================================================
  //  DETECÇÃO DE CLIQUE VIA BLUR / VISIBILITYCHANGE
  //  Quando o usuário clica no anúncio, a aba perde foco.
  //  Isso indica um clique real no ad.
  // ============================================================
  var __clickDetectionActive = false;
  var __lastBlurTime = 0;

  function startClickDetection() {
    if (__clickDetectionActive) return;
    __clickDetectionActive = true;

    // Quando a janela perde foco durante um anúncio = clique
    window.addEventListener('blur', function() {
      if (__adInProgress) {
        var now = Date.now();
        // Evitar duplicação: só conta se > 3s desde o último blur
        if (now - __lastBlurTime < 3000) return;
        __lastBlurTime = now;
        console.log('[CLICK DETECT] Janela perdeu foco durante anúncio — CLIQUE detectado!');
        sendPostback('click');
      }
    });

    // Visibilitychange como backup
    document.addEventListener('visibilitychange', function() {
      if (document.hidden && __adInProgress) {
        var now = Date.now();
        if (now - __lastBlurTime < 3000) return;
        __lastBlurTime = now;
        console.log('[CLICK DETECT] Aba ficou oculta durante anúncio — CLIQUE detectado!');
        sendPostback('click');
      }
    });

    console.log('[CLICK DETECT] Detecção de clique via blur/visibilitychange ativada');
  }

  // ============================================================
  //  SAFETY RESET — evitar __adInProgress preso
  // ============================================================
  setInterval(function() {
    if (__adInProgress && __adStartTime && (Date.now() - __adStartTime > 30000)) {
      console.warn('[AD] Safety reset: __adInProgress preso há 30s+');
      __adInProgress = false;
      __adStartTime = 0;
    }
  }, 5000);

  // ============================================================
  //  API PÚBLICA — window.__postbackTracker
  // ============================================================
  window.__postbackTracker = {
    sendPostback: sendPostback,
    fetchStats: fetchStats,
    getZoneId: function() { return ZONE_ID; },
    getSdkName: function() { return SDK_NAME; },
    getPostbackUrl: function() { return POSTBACK_URL; },
    getStatsUrl: function() { return STATS_URL; },

    // Chamado pelo React quando o anúncio começa
    markAdStart: function() {
      __adInProgress = true;
      __adStartTime = Date.now();
    },
    // Chamado pelo React quando o anúncio termina
    markAdEnd: function() {
      __adInProgress = false;
      __adStartTime = 0;
    },
    isAdInProgress: function() { return __adInProgress; }
  };

  // Iniciar hooks
  hookSDKForRealPrice();
  startClickDetection();

  console.log('[POSTBACK TRACKER] Inicializado | Zone: ' + ZONE_ID + ' | Postback: ' + POSTBACK_URL);
})();
