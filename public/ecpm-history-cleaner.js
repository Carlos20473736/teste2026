/**
 * ============================================================
 *  eCPM HISTORY CLEANER v1.0
 * ============================================================
 *
 * OBJETIVO:
 *   Limpar todo o histórico/rastro do usuário no navegador
 *   para que o Monetag trate cada sessão como um "usuário novo".
 *   Isso evita que o eCPM caia por frequência excessiva.
 *
 * O QUE LIMPA:
 *   - Cookies do Monetag e redes de anúncios
 *   - Cache do Service Worker
 *   - IndexedDB de tracking
 *   - Dados de fingerprint armazenados
 *   - SessionStorage de tracking
 *   - Entradas do Performance/Navigation API
 *   - Referrer spoofing para parecer tráfego orgânico
 *
 * O QUE PRESERVA:
 *   - user_id, user_email (login do usuário)
 *   - saved_ymid, ymid_mode (preferências de login)
 *   - user_logged_in (estado de autenticação)
 *   - ym_lang, ym_lang_ts (idioma detectado)
 *   - graninha_completed_* (progresso de missões)
 *
 * DEVE CARREGAR ANTES DO device-ecpm-boost.js E DO SDK MONETAG.
 * ============================================================
 */

(function() {
  'use strict';

  // ============================================================
  //  CONFIGURAÇÃO
  // ============================================================
  var CLEANER_CONFIG = {
    enabled: true,
    debug: true,
    // Intervalo entre limpezas automáticas (ms) — 4 minutos
    autoCleanInterval: 240000,
    // Limpar ao carregar a página
    cleanOnLoad: true,
    // Limpar antes de cada anúncio
    cleanBeforeAd: true,
    // Chaves do localStorage que devem ser PRESERVADAS (não apagar)
    preserveKeys: [
      'user_id',
      'user_email',
      'user_logged_in',
      'saved_ymid',
      'saved_email',
      'ymid_mode',
      'ym_lang',
      'ym_lang_ts',
      'theme',
      'fallback_mode'
    ],
    // Prefixos de chaves que devem ser PRESERVADAS
    preservePrefixes: [
      'graninha_completed_'
    ],
    // Domínios de cookies de ad networks para limpar
    adCookieDomains: [
      'monetag',
      'libtl',
      'tgads',
      'pushnotix',
      'onclckmn',
      'doubleclick',
      'googlesyndication',
      'googleadservices',
      'google-analytics',
      'facebook',
      'fbcdn',
      'adsrvr',
      'adnxs',
      'criteo',
      'outbrain',
      'taboola',
      'propellerads',
      'hilltopads',
      'evadav',
      'exoclick',
      'trafficstars',
      'adsterra',
      'richpush',
      'megapush',
      'pushhouse',
      'pushground',
      'clickadu',
      'galaksion',
      'bidvertiser'
    ],
    // Nomes de IndexedDB usados por ad networks
    adIndexedDBNames: [
      'monetag',
      'libtl',
      'tgads',
      'pushnotix',
      '__tcfapi',
      'FLEDGE',
      'shared_storage',
      'topics'
    ]
  };

  // ============================================================
  //  ESTADO
  // ============================================================
  var cleanerState = {
    totalCleans: 0,
    lastCleanTime: 0,
    cookiesRemoved: 0,
    storageKeysRemoved: 0,
    cacheCleared: false,
    indexedDBCleared: false
  };

  // ============================================================
  //  UTILS
  // ============================================================
  function clog(msg, data) {
    if (!CLEANER_CONFIG.debug) return;
    if (data !== undefined) console.log('[eCPM-CLEANER] ' + msg, data);
    else console.log('[eCPM-CLEANER] ' + msg);
  }

  function shouldPreserveKey(key) {
    // Verificar lista exata
    if (CLEANER_CONFIG.preserveKeys.indexOf(key) !== -1) return true;
    // Verificar prefixos
    for (var i = 0; i < CLEANER_CONFIG.preservePrefixes.length; i++) {
      if (key.indexOf(CLEANER_CONFIG.preservePrefixes[i]) === 0) return true;
    }
    return false;
  }

  // ============================================================
  //  1. LIMPEZA DE COOKIES
  // ============================================================
  function clearAdCookies() {
    var removed = 0;
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        var cookieName = cookie.split('=')[0].trim();
        if (!cookieName) continue;

        // Verificar se é cookie de ad network ou tracking
        var isAdCookie = false;
        var nameLower = cookieName.toLowerCase();

        // Cookies genéricos de tracking
        if (nameLower.indexOf('_ga') === 0 ||
            nameLower.indexOf('_gid') === 0 ||
            nameLower.indexOf('_fbp') === 0 ||
            nameLower.indexOf('_fbc') === 0 ||
            nameLower.indexOf('__gads') === 0 ||
            nameLower.indexOf('__gpi') === 0 ||
            nameLower.indexOf('_gcl') === 0 ||
            nameLower.indexOf('IDE') === 0 ||
            nameLower.indexOf('DSID') === 0 ||
            nameLower.indexOf('id5') === 0 ||
            nameLower.indexOf('uid') === 0 ||
            nameLower.indexOf('uuid') === 0 ||
            nameLower.indexOf('visitor') === 0 ||
            nameLower.indexOf('session') === 0 ||
            nameLower.indexOf('track') === 0 ||
            nameLower.indexOf('pixel') === 0 ||
            nameLower.indexOf('imp') === 0 ||
            nameLower.indexOf('freq') === 0 ||
            nameLower.indexOf('capping') === 0 ||
            nameLower.indexOf('retarget') === 0) {
          isAdCookie = true;
        }

        // Verificar domínios de ad networks
        for (var j = 0; j < CLEANER_CONFIG.adCookieDomains.length; j++) {
          if (nameLower.indexOf(CLEANER_CONFIG.adCookieDomains[j]) !== -1) {
            isAdCookie = true;
            break;
          }
        }

        if (isAdCookie) {
          // Tentar remover em vários paths e domínios
          var paths = ['/', '/sdk', '/ads', ''];
          var domains = [window.location.hostname, '.' + window.location.hostname, ''];
          for (var p = 0; p < paths.length; p++) {
            for (var d = 0; d < domains.length; d++) {
              var expiry = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
              var pathStr = paths[p] ? ';path=' + paths[p] : '';
              var domainStr = domains[d] ? ';domain=' + domains[d] : '';
              document.cookie = cookieName + '=' + expiry + pathStr + domainStr;
              document.cookie = cookieName + '=;max-age=0' + pathStr + domainStr;
            }
          }
          removed++;
        }
      }

      // Limpar TODOS os cookies restantes (abordagem agressiva)
      // Exceto os essenciais do site
      cookies = document.cookie.split(';');
      for (var k = 0; k < cookies.length; k++) {
        var c = cookies[k].trim();
        var cName = c.split('=')[0].trim();
        if (!cName) continue;
        // Remover tudo — cookies de ad network não devem persistir
        document.cookie = cName + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        document.cookie = cName + '=;max-age=0;path=/';
        document.cookie = cName + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
        document.cookie = cName + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + window.location.hostname;
        removed++;
      }
    } catch(e) {
      clog('Erro ao limpar cookies: ' + e.message);
    }

    cleanerState.cookiesRemoved += removed;
    if (removed > 0) clog('Cookies removidos: ' + removed);
    return removed;
  }

  // ============================================================
  //  2. LIMPEZA DE LOCALSTORAGE (preservando dados do app)
  // ============================================================
  function clearAdLocalStorage() {
    var removed = 0;
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        // Preservar chaves do app
        if (shouldPreserveKey(key)) continue;

        var keyLower = key.toLowerCase();
        // Remover chaves de tracking/ad networks
        var isAdKey = false;

        // Chaves de sessão do site que precisam ser limpas para "resetar" o usuário
        // para o Monetag (sem perder o login)
        if (keyLower.indexOf('ad_clicks_count') !== -1 ||
            keyLower.indexOf('_active_session') !== -1 ||
            keyLower.indexOf('_session_heartbeat') !== -1 ||
            keyLower.indexOf('pixassistindo') !== -1 ||
            keyLower.indexOf('graninha_user_id') !== -1) {
          isAdKey = true;
        }

        // Chaves genéricas de tracking de ad networks
        if (keyLower.indexOf('monetag') !== -1 ||
            keyLower.indexOf('libtl') !== -1 ||
            keyLower.indexOf('tgads') !== -1 ||
            keyLower.indexOf('pushnotix') !== -1 ||
            keyLower.indexOf('_imp') !== -1 ||
            keyLower.indexOf('_freq') !== -1 ||
            keyLower.indexOf('_cap') !== -1 ||
            keyLower.indexOf('_track') !== -1 ||
            keyLower.indexOf('_pixel') !== -1 ||
            keyLower.indexOf('_visitor') !== -1 ||
            keyLower.indexOf('_uid') !== -1 ||
            keyLower.indexOf('_uuid') !== -1 ||
            keyLower.indexOf('fingerprint') !== -1 ||
            keyLower.indexOf('_session') !== -1 ||
            keyLower.indexOf('__tcf') !== -1 ||
            keyLower.indexOf('consent') !== -1 ||
            keyLower.indexOf('gdpr') !== -1 ||
            keyLower.indexOf('cmp_') !== -1 ||
            keyLower.indexOf('optout') !== -1 ||
            keyLower.indexOf('_retarget') !== -1 ||
            keyLower.indexOf('adblock') !== -1 ||
            keyLower.indexOf('_capping') !== -1 ||
            keyLower.indexOf('show_count') !== -1 ||
            keyLower.indexOf('last_show') !== -1 ||
            keyLower.indexOf('impression') !== -1 ||
            keyLower.indexOf('_click') !== -1 ||
            keyLower.indexOf('zone_') !== -1 ||
            keyLower.indexOf('sdk_') !== -1) {
          isAdKey = true;
        }

        if (isAdKey) {
          keysToRemove.push(key);
        }
      }

      for (var j = 0; j < keysToRemove.length; j++) {
        localStorage.removeItem(keysToRemove[j]);
        removed++;
      }
    } catch(e) {
      clog('Erro ao limpar localStorage: ' + e.message);
    }

    cleanerState.storageKeysRemoved += removed;
    if (removed > 0) clog('localStorage keys removidas: ' + removed);
    return removed;
  }

  // ============================================================
  //  3. LIMPEZA DE SESSIONSTORAGE
  // ============================================================
  function clearAdSessionStorage() {
    var removed = 0;
    try {
      var keysToRemove = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var key = sessionStorage.key(i);
        if (!key) continue;
        var keyLower = key.toLowerCase();

        // Remover tudo de tracking, mas preservar dados essenciais
        if (key === 'graninha_user_id') {
          // Preservar — necessário para o fluxo do app
          continue;
        }

        // Remover chaves de ad networks
        if (keyLower.indexOf('monetag') !== -1 ||
            keyLower.indexOf('libtl') !== -1 ||
            keyLower.indexOf('tgads') !== -1 ||
            keyLower.indexOf('pushnotix') !== -1 ||
            keyLower.indexOf('_imp') !== -1 ||
            keyLower.indexOf('_freq') !== -1 ||
            keyLower.indexOf('_track') !== -1 ||
            keyLower.indexOf('_visitor') !== -1 ||
            keyLower.indexOf('_uid') !== -1 ||
            keyLower.indexOf('fingerprint') !== -1 ||
            keyLower.indexOf('__tcf') !== -1 ||
            keyLower.indexOf('consent') !== -1 ||
            keyLower.indexOf('sdk_') !== -1 ||
            keyLower.indexOf('zone_') !== -1 ||
            keyLower.indexOf('show_') !== -1 ||
            keyLower.indexOf('capping') !== -1) {
          keysToRemove.push(key);
        }
      }

      for (var j = 0; j < keysToRemove.length; j++) {
        sessionStorage.removeItem(keysToRemove[j]);
        removed++;
      }
    } catch(e) {
      clog('Erro ao limpar sessionStorage: ' + e.message);
    }

    if (removed > 0) clog('sessionStorage keys removidas: ' + removed);
    return removed;
  }

  // ============================================================
  //  4. LIMPEZA DE SERVICE WORKERS E CACHE API
  // ============================================================
  function clearServiceWorkersAndCache() {
    // Desregistrar todos os Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        var count = 0;
        registrations.forEach(function(registration) {
          registration.unregister().then(function(success) {
            if (success) {
              count++;
              clog('Service Worker desregistrado: ' + registration.scope);
            }
          });
        });
        if (registrations.length > 0) {
          clog('Service Workers encontrados: ' + registrations.length);
        }
      }).catch(function(e) {
        clog('Erro ao desregistrar SW: ' + e.message);
      });
    }

    // Limpar Cache API
    if ('caches' in window) {
      caches.keys().then(function(cacheNames) {
        var count = 0;
        cacheNames.forEach(function(cacheName) {
          caches.delete(cacheName).then(function(success) {
            if (success) {
              count++;
              clog('Cache removido: ' + cacheName);
            }
          });
        });
        if (cacheNames.length > 0) {
          clog('Caches encontrados: ' + cacheNames.length);
          cleanerState.cacheCleared = true;
        }
      }).catch(function(e) {
        clog('Erro ao limpar caches: ' + e.message);
      });
    }
  }

  // ============================================================
  //  5. LIMPEZA DE INDEXEDDB
  // ============================================================
  function clearAdIndexedDB() {
    if (!window.indexedDB) return;

    // Tentar deletar databases conhecidas de ad networks
    CLEANER_CONFIG.adIndexedDBNames.forEach(function(dbName) {
      try {
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function() {
          clog('IndexedDB removido: ' + dbName);
          cleanerState.indexedDBCleared = true;
        };
        req.onerror = function() {};
        req.onblocked = function() {};
      } catch(e) {}
    });

    // Tentar listar e limpar todas as databases (se suportado)
    if (indexedDB.databases) {
      indexedDB.databases().then(function(databases) {
        databases.forEach(function(db) {
          var name = db.name || '';
          var nameLower = name.toLowerCase();
          // Remover databases de tracking
          var isAdDB = false;
          for (var i = 0; i < CLEANER_CONFIG.adCookieDomains.length; i++) {
            if (nameLower.indexOf(CLEANER_CONFIG.adCookieDomains[i]) !== -1) {
              isAdDB = true;
              break;
            }
          }
          if (nameLower.indexOf('track') !== -1 ||
              nameLower.indexOf('pixel') !== -1 ||
              nameLower.indexOf('visitor') !== -1 ||
              nameLower.indexOf('fingerprint') !== -1 ||
              nameLower.indexOf('impression') !== -1 ||
              nameLower.indexOf('freq') !== -1 ||
              nameLower.indexOf('capping') !== -1) {
            isAdDB = true;
          }
          if (isAdDB) {
            try {
              indexedDB.deleteDatabase(name);
              clog('IndexedDB removido: ' + name);
            } catch(e) {}
          }
        });
      }).catch(function() {});
    }
  }

  // ============================================================
  //  6. SPOOFING DE REFERRER (parecer tráfego orgânico)
  // ============================================================
  function spoofReferrer() {
    try {
      // Referrers orgânicos de alto valor para eCPM
      var organicReferrers = [
        'https://www.google.com/',
        'https://www.google.com.br/',
        'https://www.google.co.uk/',
        'https://search.yahoo.com/',
        'https://www.bing.com/',
        'https://duckduckgo.com/',
        'https://t.co/',
        'https://www.facebook.com/',
        'https://www.instagram.com/'
      ];

      var fakeReferrer = organicReferrers[Math.floor(Math.random() * organicReferrers.length)];

      Object.defineProperty(document, 'referrer', {
        get: function() { return fakeReferrer; },
        configurable: true
      });

      clog('Referrer spoofado: ' + fakeReferrer);
    } catch(e) {
      clog('Erro ao spoofar referrer: ' + e.message);
    }
  }

  // ============================================================
  //  7. LIMPAR PERFORMANCE ENTRIES (remove rastros de navegação)
  // ============================================================
  function clearPerformanceEntries() {
    try {
      if (window.performance) {
        if (typeof performance.clearResourceTimings === 'function') {
          performance.clearResourceTimings();
        }
        if (typeof performance.clearMarks === 'function') {
          performance.clearMarks();
        }
        if (typeof performance.clearMeasures === 'function') {
          performance.clearMeasures();
        }
        clog('Performance entries limpas');
      }
    } catch(e) {}
  }

  // ============================================================
  //  8. BLOQUEAR STORAGE DE AD NETWORKS (interceptar escritas)
  // ============================================================
  function interceptAdStorage() {
    try {
      // Interceptar localStorage.setItem para bloquear tracking de ad networks
      var originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(key, value) {
        var keyLower = (key || '').toLowerCase();
        // Bloquear chaves de tracking de ad networks
        if (keyLower.indexOf('monetag') !== -1 && keyLower.indexOf('ecpm') === -1 ||
            keyLower.indexOf('_imp_count') !== -1 ||
            keyLower.indexOf('_freq_cap') !== -1 ||
            keyLower.indexOf('_visitor_id') !== -1 ||
            keyLower.indexOf('_fingerprint') !== -1 ||
            keyLower.indexOf('_capping') !== -1 ||
            keyLower.indexOf('_retarget') !== -1) {
          clog('Bloqueado localStorage.setItem: ' + key);
          return; // Não salvar
        }
        return originalSetItem(key, value);
      };

      // Interceptar document.cookie setter para bloquear cookies de tracking
      var cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                       Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

      if (cookieDesc && cookieDesc.set) {
        var originalCookieSetter = cookieDesc.set;
        Object.defineProperty(document, 'cookie', {
          get: cookieDesc.get,
          set: function(val) {
            var valLower = (val || '').toLowerCase();
            // Bloquear cookies de tracking
            for (var i = 0; i < CLEANER_CONFIG.adCookieDomains.length; i++) {
              if (valLower.indexOf(CLEANER_CONFIG.adCookieDomains[i]) !== -1) {
                clog('Bloqueado cookie de ad network: ' + val.substring(0, 50));
                return;
              }
            }
            // Bloquear cookies genéricos de tracking
            if (valLower.indexOf('_ga=') === 0 ||
                valLower.indexOf('_gid=') === 0 ||
                valLower.indexOf('_fbp=') === 0 ||
                valLower.indexOf('uid=') === 0 ||
                valLower.indexOf('uuid=') === 0 ||
                valLower.indexOf('visitor=') === 0 ||
                valLower.indexOf('track') !== -1 && valLower.indexOf('=') < 20) {
              clog('Bloqueado cookie de tracking: ' + val.substring(0, 50));
              return;
            }
            return originalCookieSetter.call(document, val);
          },
          configurable: true
        });
        clog('Interceptação de cookies ativada');
      }
    } catch(e) {
      clog('Erro ao interceptar storage: ' + e.message);
    }
  }

  // ============================================================
  //  9. RANDOMIZAR IDENTIFIERS (parecer usuário novo)
  // ============================================================
  function randomizeIdentifiers() {
    try {
      // Randomizar WebRTC local IPs (evitar fingerprint por IP local)
      if (window.RTCPeerConnection) {
        var OrigRTC = window.RTCPeerConnection;
        window.RTCPeerConnection = function(config) {
          // Forçar uso de relay para esconder IP local
          if (config && config.iceServers) {
            config.iceTransportPolicy = 'relay';
          }
          return new OrigRTC(config);
        };
        window.RTCPeerConnection.prototype = OrigRTC.prototype;
      }

      // Randomizar AudioContext fingerprint
      if (window.AudioContext || window.webkitAudioContext) {
        var OrigAC = window.AudioContext || window.webkitAudioContext;
        var origCreateOscillator = OrigAC.prototype.createOscillator;
        OrigAC.prototype.createOscillator = function() {
          var osc = origCreateOscillator.call(this);
          var origConnect = osc.connect.bind(osc);
          osc.connect = function(dest) {
            // Adicionar variação sutil para mudar fingerprint
            try {
              var gain = osc.context.createGain();
              gain.gain.value = 0.999 + Math.random() * 0.002;
              origConnect(gain);
              gain.connect(dest);
              return;
            } catch(e) {
              return origConnect(dest);
            }
          };
          return osc;
        };
      }

      clog('Identifiers randomizados');
    } catch(e) {
      clog('Erro ao randomizar identifiers: ' + e.message);
    }
  }

  // ============================================================
  //  FUNÇÃO PRINCIPAL: LIMPEZA COMPLETA
  // ============================================================
  function fullClean(reason) {
    if (!CLEANER_CONFIG.enabled) return;

    var startTime = Date.now();
    clog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    clog('🧹 LIMPEZA INICIADA — Motivo: ' + (reason || 'manual'));

    // 1. Limpar cookies
    var cookiesRemoved = clearAdCookies();

    // 2. Limpar localStorage (preservando dados do app)
    var lsRemoved = clearAdLocalStorage();

    // 3. Limpar sessionStorage
    var ssRemoved = clearAdSessionStorage();

    // 4. Limpar Service Workers e Cache
    clearServiceWorkersAndCache();

    // 5. Limpar IndexedDB
    clearAdIndexedDB();

    // 6. Limpar Performance entries
    clearPerformanceEntries();

    // Atualizar estado
    cleanerState.totalCleans++;
    cleanerState.lastCleanTime = Date.now();

    var elapsed = Date.now() - startTime;
    clog('✅ LIMPEZA CONCLUÍDA em ' + elapsed + 'ms');
    clog('   Cookies: ' + cookiesRemoved + ' | localStorage: ' + lsRemoved + ' | sessionStorage: ' + ssRemoved);
    clog('   Total de limpezas na sessão: ' + cleanerState.totalCleans);
    clog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // ============================================================
  //  HOOK NO triggerAd — limpar ANTES de cada anúncio
  // ============================================================
  function hookTriggerAdForCleaning() {
    if (!CLEANER_CONFIG.cleanBeforeAd) return;

    var checkInterval = setInterval(function() {
      if (typeof window.triggerAd === 'function' && !window._cleanerTriggerHooked) {
        var originalTrigger = window.triggerAd;
        window.triggerAd = function() {
          clog('🧹 Limpando antes do anúncio...');
          clearAdCookies();
          clearPerformanceEntries();
          // Chamar o triggerAd original
          return originalTrigger.apply(this, arguments);
        };
        window._cleanerTriggerHooked = true;
        clearInterval(checkInterval);
        clog('✅ triggerAd hookado para limpeza pré-anúncio');
      }
    }, 1000);
  }

  // ============================================================
  //  API PÚBLICA
  // ============================================================
  window.EcpmHistoryCleaner = {
    // Executar limpeza completa manualmente
    clean: function() {
      fullClean('manual');
    },

    // Ver estatísticas
    getStats: function() {
      return {
        totalCleans: cleanerState.totalCleans,
        lastCleanTime: cleanerState.lastCleanTime > 0
          ? new Date(cleanerState.lastCleanTime).toLocaleTimeString()
          : 'Nunca',
        cookiesRemoved: cleanerState.cookiesRemoved,
        storageKeysRemoved: cleanerState.storageKeysRemoved,
        cacheCleared: cleanerState.cacheCleared,
        indexedDBCleared: cleanerState.indexedDBCleared,
        enabled: CLEANER_CONFIG.enabled,
        autoCleanInterval: (CLEANER_CONFIG.autoCleanInterval / 1000) + 's'
      };
    },

    // Diagnóstico completo
    diagnose: function() {
      console.log('\n========================================');
      console.log('  eCPM HISTORY CLEANER v1.0 — DIAGNÓSTICO');
      console.log('========================================');
      console.log('\n🧹 LIMPEZAS:');
      console.log('  Total: ' + cleanerState.totalCleans);
      console.log('  Última: ' + (cleanerState.lastCleanTime > 0 ? new Date(cleanerState.lastCleanTime).toLocaleTimeString() : 'Nunca'));
      console.log('  Cookies removidos: ' + cleanerState.cookiesRemoved);
      console.log('  Storage keys removidas: ' + cleanerState.storageKeysRemoved);
      console.log('  Cache limpo: ' + cleanerState.cacheCleared);
      console.log('  IndexedDB limpo: ' + cleanerState.indexedDBCleared);

      console.log('\n🔒 DADOS PRESERVADOS:');
      CLEANER_CONFIG.preserveKeys.forEach(function(key) {
        var val = localStorage.getItem(key);
        console.log('  ' + key + ': ' + (val ? val.substring(0, 30) : '(vazio)'));
      });

      console.log('\n📊 COOKIES ATUAIS:');
      var cookies = document.cookie.split(';').filter(function(c) { return c.trim(); });
      console.log('  Total: ' + cookies.length);
      cookies.forEach(function(c) {
        console.log('  ' + c.trim().substring(0, 60));
      });

      console.log('\n📦 LOCALSTORAGE ATUAL:');
      console.log('  Total keys: ' + localStorage.length);
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        console.log('  ' + key + ': ' + (localStorage.getItem(key) || '').substring(0, 40));
      }

      console.log('\n========================================\n');
    },

    // Ativar/desativar
    setEnabled: function(val) {
      CLEANER_CONFIG.enabled = !!val;
      clog(val ? '✅ Cleaner ATIVADO' : '❌ Cleaner DESATIVADO');
    },

    // Ajustar intervalo de limpeza automática (em segundos)
    setInterval: function(seconds) {
      CLEANER_CONFIG.autoCleanInterval = Math.max(60, seconds) * 1000;
      clog('Intervalo ajustado para ' + seconds + 's');
    }
  };

  // ============================================================
  //  INICIALIZAÇÃO
  // ============================================================
  function init() {
    if (!CLEANER_CONFIG.enabled) return;

    clog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    clog('🧹 eCPM HISTORY CLEANER v1.0');
    clog('   Limpeza de histórico para manter eCPM alto');
    clog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Spoofar referrer (parecer tráfego orgânico)
    spoofReferrer();

    // 2. Randomizar identifiers
    randomizeIdentifiers();

    // 3. Interceptar storage de ad networks
    interceptAdStorage();

    // 4. Limpeza inicial
    if (CLEANER_CONFIG.cleanOnLoad) {
      fullClean('page_load');
    }

    // 5. Hook no triggerAd
    hookTriggerAdForCleaning();

    // 6. Limpeza automática periódica
    setInterval(function() {
      fullClean('auto_interval');
    }, CLEANER_CONFIG.autoCleanInterval);

    clog('');
    clog('💡 Comandos:');
    clog('   EcpmHistoryCleaner.clean()     → Limpeza manual');
    clog('   EcpmHistoryCleaner.diagnose()  → Diagnóstico completo');
    clog('   EcpmHistoryCleaner.getStats()  → Estatísticas');
    clog('');
  }

  init();

})();
