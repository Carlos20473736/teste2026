/**
 * Spoof Engine — Fingerprint / Network / Browser / Device Spoofing
 * 
 * Faz cada sessão parecer um dispositivo/navegador/rede DIFERENTE para
 * o SDK de anúncios, aumentando o eCPM ao simular tráfego de usuários
 * únicos e diversos.
 *
 * DEVE ser carregado ANTES do telegram-env.js e do SDK de anúncios.
 *
 * Técnicas:
 * 1. User-Agent randomizado (dispositivos Android reais populares)
 * 2. Canvas fingerprint spoofing (ruído imperceptível)
 * 3. WebGL renderer/vendor spoofing
 * 4. Screen/window dimensions spoofing
 * 5. Timezone spoofing (regiões BR de alto valor)
 * 6. Language/platform spoofing
 * 7. Hardware concurrency + device memory spoofing
 * 8. AudioContext fingerprint spoofing
 * 9. Navigator plugins spoofing
 * 10. Connection/Network info spoofing
 */
(function() {
  'use strict';

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomFloat(min, max, decimals) {
    var val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals || 2));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Gera um ID de sessão único para esta "identidade"
  function generateSessionId() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var id = '';
    for (var i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  var SESSION_ID = generateSessionId();

  // ============================================================
  // 1. USER-AGENT SPOOFING — Dispositivos Android reais populares
  // ============================================================
  var ANDROID_DEVICES = [
    // Samsung Galaxy S series
    { model: 'SM-S928B', brand: 'Samsung Galaxy S24 Ultra', android: '14', chrome: '124.0.6367.' + randomInt(60, 200) },
    { model: 'SM-S926B', brand: 'Samsung Galaxy S24+', android: '14', chrome: '123.0.6312.' + randomInt(50, 150) },
    { model: 'SM-S921B', brand: 'Samsung Galaxy S24', android: '14', chrome: '125.0.6422.' + randomInt(30, 120) },
    { model: 'SM-S918B', brand: 'Samsung Galaxy S23 Ultra', android: '14', chrome: '122.0.6261.' + randomInt(40, 130) },
    { model: 'SM-S916B', brand: 'Samsung Galaxy S23+', android: '13', chrome: '121.0.6167.' + randomInt(40, 180) },
    { model: 'SM-S911B', brand: 'Samsung Galaxy S23', android: '13', chrome: '120.0.6099.' + randomInt(50, 200) },
    { model: 'SM-G998B', brand: 'Samsung Galaxy S21 Ultra', android: '13', chrome: '119.0.6045.' + randomInt(60, 170) },
    // Samsung Galaxy A series (popular no BR)
    { model: 'SM-A546B', brand: 'Samsung Galaxy A54', android: '14', chrome: '124.0.6367.' + randomInt(40, 160) },
    { model: 'SM-A346B', brand: 'Samsung Galaxy A34', android: '14', chrome: '123.0.6312.' + randomInt(30, 140) },
    { model: 'SM-A245M', brand: 'Samsung Galaxy A24', android: '13', chrome: '122.0.6261.' + randomInt(50, 150) },
    { model: 'SM-A155M', brand: 'Samsung Galaxy A15', android: '14', chrome: '125.0.6422.' + randomInt(20, 100) },
    { model: 'SM-A057M', brand: 'Samsung Galaxy A05s', android: '13', chrome: '121.0.6167.' + randomInt(30, 120) },
    // Motorola (muito popular no BR)
    { model: 'moto g84 5G', brand: 'Motorola Moto G84', android: '14', chrome: '124.0.6367.' + randomInt(40, 150) },
    { model: 'moto g73 5G', brand: 'Motorola Moto G73', android: '13', chrome: '123.0.6312.' + randomInt(30, 130) },
    { model: 'moto g54 5G', brand: 'Motorola Moto G54', android: '14', chrome: '125.0.6422.' + randomInt(20, 110) },
    { model: 'moto g34 5G', brand: 'Motorola Moto G34', android: '14', chrome: '122.0.6261.' + randomInt(40, 140) },
    { model: 'moto e22', brand: 'Motorola Moto E22', android: '12', chrome: '120.0.6099.' + randomInt(50, 160) },
    { model: 'edge 40 pro', brand: 'Motorola Edge 40 Pro', android: '14', chrome: '124.0.6367.' + randomInt(50, 170) },
    // Xiaomi / Redmi (popular no BR)
    { model: '23129RAA4G', brand: 'Xiaomi 14', android: '14', chrome: '125.0.6422.' + randomInt(30, 120) },
    { model: '2311DRK48C', brand: 'Redmi Note 13 Pro', android: '14', chrome: '124.0.6367.' + randomInt(40, 150) },
    { model: '23076RN4BI', brand: 'Redmi Note 12', android: '13', chrome: '123.0.6312.' + randomInt(30, 140) },
    { model: '22111317PI', brand: 'Poco X5 Pro', android: '13', chrome: '122.0.6261.' + randomInt(40, 130) },
    // Realme
    { model: 'RMX3771', brand: 'Realme 11 Pro+', android: '14', chrome: '124.0.6367.' + randomInt(30, 140) },
    { model: 'RMX3630', brand: 'Realme C55', android: '13', chrome: '121.0.6167.' + randomInt(40, 150) },
  ];

  var device = pick(ANDROID_DEVICES);
  var buildId = pick(['TP1A.220624.014', 'UP1A.231005.007', 'UQ1A.240205.002', 'AP2A.240805.005', 'SP1A.210812.016', 'TQ3A.230901.001']);
  var spoofedUA = 'Mozilla/5.0 (Linux; Android ' + device.android + '; ' + device.model + ' Build/' + buildId + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + device.chrome + ' Mobile Safari/537.36';

  try {
    Object.defineProperty(navigator, 'userAgent', { get: function() { return spoofedUA; }, configurable: true });
    Object.defineProperty(navigator, 'appVersion', { get: function() { return spoofedUA.replace('Mozilla/', ''); }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 2. PLATFORM / VENDOR SPOOFING
  // ============================================================
  try {
    Object.defineProperty(navigator, 'platform', { get: function() { return 'Linux armv8l'; }, configurable: true });
    Object.defineProperty(navigator, 'vendor', { get: function() { return 'Google Inc.'; }, configurable: true });
    Object.defineProperty(navigator, 'product', { get: function() { return 'Gecko'; }, configurable: true });
    Object.defineProperty(navigator, 'productSub', { get: function() { return '20030107'; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 3. HARDWARE SPOOFING (cores, memória, max touch points)
  // ============================================================
  var spoofedCores = pick([4, 6, 8]);
  var spoofedMemory = pick([3, 4, 6, 8, 12]);
  var spoofedMaxTouch = pick([5, 10]);

  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: function() { return spoofedCores; }, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { get: function() { return spoofedMemory; }, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return spoofedMaxTouch; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 4. SCREEN / WINDOW DIMENSIONS SPOOFING
  // ============================================================
  var SCREEN_PROFILES = [
    { w: 1080, h: 2400, dpr: 2.625, cw: 412, ch: 915 },  // Samsung S23/S24
    { w: 1080, h: 2340, dpr: 2.75, cw: 393, ch: 851 },    // Pixel 7
    { w: 1080, h: 2408, dpr: 2.625, cw: 412, ch: 917 },   // Galaxy A54
    { w: 1080, h: 2400, dpr: 2.5, cw: 432, ch: 960 },     // Moto G84
    { w: 1080, h: 2460, dpr: 2.625, cw: 412, ch: 937 },   // Galaxy S24 Ultra
    { w: 720, h: 1600, dpr: 2.0, cw: 360, ch: 800 },      // Galaxy A15 / budget
    { w: 1080, h: 2388, dpr: 2.75, cw: 393, ch: 868 },    // Xiaomi 14
    { w: 1080, h: 2412, dpr: 2.625, cw: 412, ch: 919 },   // Redmi Note 13 Pro
    { w: 720, h: 1612, dpr: 2.0, cw: 360, ch: 806 },      // Moto E22
    { w: 1080, h: 2376, dpr: 2.625, cw: 412, ch: 905 },   // Realme 11 Pro+
  ];

  var screenProfile = pick(SCREEN_PROFILES);

  try {
    Object.defineProperty(window, 'devicePixelRatio', { get: function() { return screenProfile.dpr; }, configurable: true });
    Object.defineProperty(screen, 'width', { get: function() { return screenProfile.w; }, configurable: true });
    Object.defineProperty(screen, 'height', { get: function() { return screenProfile.h; }, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: function() { return screenProfile.w; }, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: function() { return screenProfile.h - randomInt(40, 80); }, configurable: true });
    Object.defineProperty(screen, 'colorDepth', { get: function() { return 24; }, configurable: true });
    Object.defineProperty(screen, 'pixelDepth', { get: function() { return 24; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 5. CANVAS FINGERPRINT SPOOFING
  // ============================================================
  var _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  var _origGetContext = HTMLCanvasElement.prototype.getContext;
  var _noiseKey = randomFloat(-0.03, 0.03, 4);

  HTMLCanvasElement.prototype.toDataURL = function() {
    try {
      var ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        var imageData = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
          // Ruído imperceptível mas único por sessão
          data[i] = Math.max(0, Math.min(255, data[i] + Math.floor(_noiseKey * (i % 7))));
        }
        ctx.putImageData(imageData, 0, 0);
      }
    } catch(e) {}
    return _origToDataURL.apply(this, arguments);
  };

  // ============================================================
  // 6. WEBGL RENDERER / VENDOR SPOOFING
  // ============================================================
  var WEBGL_PROFILES = [
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 740' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 730' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 725' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 710' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 660' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 650' },
    { vendor: 'Qualcomm', renderer: 'Adreno (TM) 619' },
    { vendor: 'ARM', renderer: 'Mali-G715 Immortalis MC11' },
    { vendor: 'ARM', renderer: 'Mali-G710 MC10' },
    { vendor: 'ARM', renderer: 'Mali-G78 MC14' },
    { vendor: 'ARM', renderer: 'Mali-G68 MC4' },
    { vendor: 'ARM', renderer: 'Mali-G57 MC2' },
    { vendor: 'Imagination Technologies', renderer: 'PowerVR GE8320' },
  ];

  var webglProfile = pick(WEBGL_PROFILES);

  var _origGetParameter = null;
  var _origGetExtension = null;

  var _patchWebGL = function(gl) {
    if (!gl || gl.__spoofed) return gl;
    gl.__spoofed = true;

    _origGetParameter = gl.getParameter.bind(gl);
    _origGetExtension = gl.getExtension.bind(gl);

    gl.getParameter = function(param) {
      // UNMASKED_VENDOR_WEBGL
      if (param === 0x9245) return webglProfile.vendor;
      // UNMASKED_RENDERER_WEBGL
      if (param === 0x9246) return webglProfile.renderer;
      // MAX_TEXTURE_SIZE — variar levemente
      if (param === 0x0D33) return pick([4096, 8192, 16384]);
      return _origGetParameter(param);
    };

    gl.getExtension = function(name) {
      var ext = _origGetExtension(name);
      if (name === 'WEBGL_debug_renderer_info') {
        return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 };
      }
      return ext;
    };

    return gl;
  };

  HTMLCanvasElement.prototype.getContext = function(type) {
    var ctx = _origGetContext.apply(this, arguments);
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      _patchWebGL(ctx);
    }
    return ctx;
  };

  // ============================================================
  // 7. TIMEZONE SPOOFING — Regiões BR de alto valor
  // ============================================================
  var BR_TIMEZONES = [
    'America/Sao_Paulo',
    'America/Rio_Branco',
    'America/Manaus',
    'America/Bahia',
    'America/Fortaleza',
    'America/Recife',
    'America/Belem',
    'America/Cuiaba',
  ];

  var spoofedTZ = pick(BR_TIMEZONES);

  try {
    var _origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function() {
      var opts = _origResolvedOptions.call(this);
      opts.timeZone = spoofedTZ;
      return opts;
    };
  } catch(e) {}

  // ============================================================
  // 8. LANGUAGE SPOOFING
  // ============================================================
  var LANG_SETS = [
    { lang: 'pt-BR', langs: ['pt-BR', 'pt', 'en-US', 'en'] },
    { lang: 'pt-BR', langs: ['pt-BR', 'pt', 'en'] },
    { lang: 'pt-BR', langs: ['pt-BR', 'en-US'] },
    { lang: 'pt', langs: ['pt', 'pt-BR', 'en-US', 'en'] },
  ];

  var langSet = pick(LANG_SETS);

  try {
    Object.defineProperty(navigator, 'language', { get: function() { return langSet.lang; }, configurable: true });
    Object.defineProperty(navigator, 'languages', { get: function() { return langSet.langs; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 9. CONNECTION / NETWORK INFO SPOOFING
  // ============================================================
  var NET_PROFILES = [
    { type: 'wifi', effectiveType: '4g', downlink: randomFloat(15, 80, 1), rtt: randomInt(20, 60) },
    { type: 'wifi', effectiveType: '4g', downlink: randomFloat(20, 100, 1), rtt: randomInt(15, 50) },
    { type: 'cellular', effectiveType: '4g', downlink: randomFloat(8, 40, 1), rtt: randomInt(30, 80) },
    { type: 'cellular', effectiveType: '4g', downlink: randomFloat(5, 25, 1), rtt: randomInt(40, 100) },
    { type: 'wifi', effectiveType: '4g', downlink: randomFloat(30, 150, 1), rtt: randomInt(10, 35) },
  ];

  var netProfile = pick(NET_PROFILES);

  try {
    var connObj = {
      type: netProfile.type,
      effectiveType: netProfile.effectiveType,
      downlink: netProfile.downlink,
      rtt: netProfile.rtt,
      saveData: false,
      downlinkMax: Infinity,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; },
      onchange: null,
      ontypechange: null,
    };
    Object.defineProperty(navigator, 'connection', { get: function() { return connObj; }, configurable: true });
    Object.defineProperty(navigator, 'mozConnection', { get: function() { return connObj; }, configurable: true });
    Object.defineProperty(navigator, 'webkitConnection', { get: function() { return connObj; }, configurable: true });
    Object.defineProperty(navigator, 'onLine', { get: function() { return true; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 10. AUDIO CONTEXT FINGERPRINT SPOOFING
  // ============================================================
  try {
    var _OrigAudioContext = window.AudioContext || window.webkitAudioContext;
    if (_OrigAudioContext) {
      var _origCreateOscillator = _OrigAudioContext.prototype.createOscillator;
      var _origCreateDynamicsCompressor = _OrigAudioContext.prototype.createDynamicsCompressor;
      var _audioNoise = randomFloat(-0.001, 0.001, 6);

      _OrigAudioContext.prototype.createOscillator = function() {
        var osc = _origCreateOscillator.call(this);
        var _origFreqVal = Object.getOwnPropertyDescriptor(osc.frequency.__proto__, 'value') ||
                           Object.getOwnPropertyDescriptor(osc.frequency, 'value');
        if (_origFreqVal && _origFreqVal.set) {
          var _origSet = _origFreqVal.set;
          Object.defineProperty(osc.frequency, 'value', {
            get: _origFreqVal.get,
            set: function(v) { _origSet.call(this, v + _audioNoise); },
            configurable: true
          });
        }
        return osc;
      };
    }
  } catch(e) {}

  // ============================================================
  // 11. PLUGINS / MIME TYPES SPOOFING (parecer mobile real)
  // ============================================================
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: function() {
        return { length: 0, item: function() { return null; }, namedItem: function() { return null; }, refresh: function() {} };
      },
      configurable: true
    });
    Object.defineProperty(navigator, 'mimeTypes', {
      get: function() {
        return { length: 0, item: function() { return null; }, namedItem: function() { return null; } };
      },
      configurable: true
    });
  } catch(e) {}

  // ============================================================
  // 12. DO NOT TRACK / GLOBAL PRIVACY CONTROL
  // ============================================================
  try {
    Object.defineProperty(navigator, 'doNotTrack', { get: function() { return null; }, configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: function() { return false; }, configurable: true });
  } catch(e) {}

  // ============================================================
  // 13. BATTERY API SPOOFING
  // ============================================================
  try {
    var batteryLevel = randomFloat(0.25, 0.95, 2);
    var batteryCharging = Math.random() > 0.5;
    navigator.getBattery = function() {
      return Promise.resolve({
        charging: batteryCharging,
        chargingTime: batteryCharging ? randomInt(600, 7200) : Infinity,
        dischargingTime: batteryCharging ? Infinity : randomInt(3600, 28800),
        level: batteryLevel,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; },
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null,
      });
    };
  } catch(e) {}

  // ============================================================
  // 14. WEBRTC LOCAL IP MASKING
  // ============================================================
  try {
    var _origRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (_origRTCPeerConnection) {
      var fakeLocalIP = '192.168.' + randomInt(0, 254) + '.' + randomInt(2, 254);
      window.RTCPeerConnection = function(config) {
        if (config && config.iceServers) {
          config.iceServers = [];
        }
        var pc = new _origRTCPeerConnection(config);
        var _origCreateOffer = pc.createOffer.bind(pc);
        pc.createOffer = function(opts) {
          return _origCreateOffer(opts).then(function(offer) {
            if (offer && offer.sdp) {
              // Substituir IPs locais por IP fake
              offer.sdp = offer.sdp.replace(/(\d{1,3}\.){3}\d{1,3}/g, fakeLocalIP);
            }
            return offer;
          });
        };
        return pc;
      };
      window.RTCPeerConnection.prototype = _origRTCPeerConnection.prototype;
      if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = window.RTCPeerConnection;
    }
  } catch(e) {}

  // ============================================================
  // 15. STORAGE FINGERPRINT ISOLATION
  // ============================================================
  // Limpa fingerprints de sessões anteriores do SDK a cada nova sessão
  // para que o SDK não reconheça como mesmo usuário
  try {
    var SDK_FINGERPRINT_KEYS = [
      // Padrões comuns de SDKs de ad
      '_fpd', '_fph', 'fp_', 'fingerprint', 'device_id', 'did',
      'visitor_id', 'vid', '_vid', 'uid_', '_uid',
      'monetag_', 'propeller_', 'libtl_', 'sdk_',
      '__cfduid', '_ga', '_gid', '_fbp',
    ];

    // Limpar cookies que possam ser de tracking do SDK
    var cookies = document.cookie.split(';');
    for (var c = 0; c < cookies.length; c++) {
      var cookieName = cookies[c].split('=')[0].trim().toLowerCase();
      for (var k = 0; k < SDK_FINGERPRINT_KEYS.length; k++) {
        if (cookieName.indexOf(SDK_FINGERPRINT_KEYS[k]) !== -1) {
          document.cookie = cookies[c].split('=')[0].trim() + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          document.cookie = cookies[c].split('=')[0].trim() + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + window.location.hostname;
          break;
        }
      }
    }

    // Limpar localStorage/sessionStorage de fingerprints do SDK
    // (preservar user_id, user_email e auto_ad que são do app)
    var APP_KEYS = ['user_id', 'user_email', 'auto_ad.spin', 'auto_ad.candy', 'auto_ad.scratch', 'tg_cloud_', 'tg_device_', 'tg_secure_'];
    function isAppKey(key) {
      for (var a = 0; a < APP_KEYS.length; a++) {
        if (key.indexOf(APP_KEYS[a]) !== -1) return true;
      }
      return false;
    }

    // sessionStorage: limpar tudo exceto app keys e telegram
    var ssKeysToRemove = [];
    for (var s = 0; s < sessionStorage.length; s++) {
      var ssKey = sessionStorage.key(s);
      if (ssKey && !isAppKey(ssKey) && ssKey.indexOf('__telegram') === -1) {
        for (var sk = 0; sk < SDK_FINGERPRINT_KEYS.length; sk++) {
          if (ssKey.toLowerCase().indexOf(SDK_FINGERPRINT_KEYS[sk]) !== -1) {
            ssKeysToRemove.push(ssKey);
            break;
          }
        }
      }
    }
    for (var sr = 0; sr < ssKeysToRemove.length; sr++) {
      sessionStorage.removeItem(ssKeysToRemove[sr]);
    }
  } catch(e) {}

  // ============================================================
  // LOG
  // ============================================================
  console.log('[SPOOF] Engine inicializado — sessão: ' + SESSION_ID);
  console.log('[SPOOF] Device: ' + device.brand + ' (' + device.model + ') Android ' + device.android);
  console.log('[SPOOF] Screen: ' + screenProfile.w + 'x' + screenProfile.h + ' @' + screenProfile.dpr + 'x');
  console.log('[SPOOF] GPU: ' + webglProfile.vendor + ' ' + webglProfile.renderer);
  console.log('[SPOOF] Network: ' + netProfile.type + ' ' + netProfile.effectiveType + ' ' + netProfile.downlink + 'Mbps');
  console.log('[SPOOF] Timezone: ' + spoofedTZ);
  console.log('[SPOOF] Cores: ' + spoofedCores + ' | RAM: ' + spoofedMemory + 'GB');

  // Expor para debug (opcional)
  window.__spoofSession = {
    id: SESSION_ID,
    device: device,
    screen: screenProfile,
    gpu: webglProfile,
    network: netProfile,
    timezone: spoofedTZ,
    ua: spoofedUA,
  };

})();
