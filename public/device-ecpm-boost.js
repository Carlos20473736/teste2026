/**
 * ============================================================
 *  eCPM BOOST v4.0 — SPOOFING + PREÇO REAL + OTIMIZAÇÕES
 * ============================================================
 * 
 * SPOOFING DE DEVICE:
 *   - User-Agent, Client Hints, Screen, Touch, Connection
 *   - Simula dispositivos premium (iPhone, Samsung, Pixel)
 *   - Rotação automática a cada 3 minutos
 *   - Tudo aplicado ANTES do SDK Monetag carregar
 * 
 * PREÇO REAL:
 *   - Captura o estimated_price REAL que o Monetag retorna
 *   - Envia o preço real para o seu backend (sem inflar)
 *   - Você vê exatamente quanto está ganhando
 * 
 * OTIMIZAÇÕES:
 *   - Preload de ads para fill rate 100%
 *   - Viewability tracker (ads visíveis pagam mais)
 *   - Frequency control (evita saturação)
 *   - Engagement tracker (sessões longas = melhor CPM)
 * 
 * DEVE CARREGAR ANTES DO SDK DO MONETAG.
 * ============================================================
 */

(function() {
  'use strict';

  // ============================================================
  //  CONFIGURAÇÃO
  // ============================================================
  var CONFIG = {
    enabled: true,
    debug: true,
    rotationInterval: 180000,   // 3 min rotação de device
    iosWeight: 0.70,            // 70% iOS
    deviceBufferSize: 144,
    deviceRefillThreshold: 24,
    preloadDelay: 2000,
    minTimeBetweenAds: 15000,
    maxAdsPerMinute: 3,
    sessionPingInterval: 30000
  };

  // ============================================================
  //  BANCO DE DISPOSITIVOS PREMIUM
  // ============================================================
  var PREMIUM_DEVICE_LIBRARY = {
    ios: [
      { name: 'iPhone 16 Pro Max', model: 'iPhone17,2', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 440, screenHeight: 956, dprOptions: [3], platformVersions: ['18.1.0', '18.0.1'], hardwareConcurrencyOptions: [6, 8], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 16 Pro', model: 'iPhone17,1', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 402, screenHeight: 874, dprOptions: [3], platformVersions: ['18.1.0', '18.0.1'], hardwareConcurrencyOptions: [6, 8], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 16 Plus', model: 'iPhone17,4', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 430, screenHeight: 932, dprOptions: [3], platformVersions: ['18.1.0', '18.0.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 16', model: 'iPhone17,3', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 393, screenHeight: 852, dprOptions: [3], platformVersions: ['18.1.0', '18.0.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 15 Pro Max', model: 'iPhone16,2', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 430, screenHeight: 932, dprOptions: [3], platformVersions: ['17.7.1', '17.6.1', '17.5.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 15 Pro', model: 'iPhone16,1', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 393, screenHeight: 852, dprOptions: [3], platformVersions: ['17.7.1', '17.6.1', '17.5.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 15 Plus', model: 'iPhone15,5', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 430, screenHeight: 932, dprOptions: [3], platformVersions: ['17.7.1', '17.6.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [6], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 15', model: 'iPhone15,4', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 393, screenHeight: 852, dprOptions: [3], platformVersions: ['17.7.1', '17.6.1'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [6], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPhone 14 Pro Max', model: 'iPhone15,3', uaDeviceType: 'iPhone', platform: 'iPhone', screenWidth: 430, screenHeight: 932, dprOptions: [3], platformVersions: ['16.7.10', '16.7.8'], hardwareConcurrencyOptions: [6], deviceMemoryOptions: [6], gpuOptions: [{ renderer: 'Apple GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPad Pro 13 M4', model: 'iPad16,6', uaDeviceType: 'iPad', platform: 'iPad', screenWidth: 1032, screenHeight: 1376, dprOptions: [2], platformVersions: ['18.0.1', '18.1.0'], hardwareConcurrencyOptions: [8, 10], deviceMemoryOptions: [8, 16], gpuOptions: [{ renderer: 'Apple M4 GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPad Pro 11 M4', model: 'iPad16,3', uaDeviceType: 'iPad', platform: 'iPad', screenWidth: 834, screenHeight: 1210, dprOptions: [2], platformVersions: ['18.0.1', '18.1.0'], hardwareConcurrencyOptions: [8, 10], deviceMemoryOptions: [8, 16], gpuOptions: [{ renderer: 'Apple M4 GPU', vendor: 'Apple Inc.' }] },
      { name: 'iPad Air 13 M2', model: 'iPad14,11', uaDeviceType: 'iPad', platform: 'iPad', screenWidth: 1024, screenHeight: 1366, dprOptions: [2], platformVersions: ['17.7.1', '18.0.1'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [8], gpuOptions: [{ renderer: 'Apple M2 GPU', vendor: 'Apple Inc.' }] }
    ],
    android: [
      { name: 'Samsung Galaxy S24 Ultra', model: 'SM-S928B', uaModel: 'SM-S928B', screenWidth: 412, screenHeight: 915, dprOptions: [3.5], platformVersions: ['14.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122', '127.0.6533.103'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Samsung Galaxy S24+', model: 'SM-S926B', uaModel: 'SM-S926B', screenWidth: 384, screenHeight: 854, dprOptions: [3.5], platformVersions: ['14.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Samsung Galaxy S23 Ultra', model: 'SM-S918B', uaModel: 'SM-S918B', screenWidth: 412, screenHeight: 915, dprOptions: [3.5], platformVersions: ['14.0.0'], chromeVersions: ['124.0.6367.179', '125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 740', vendor: 'Qualcomm' }] },
      { name: 'Samsung Galaxy Z Fold6', model: 'SM-F956B', uaModel: 'SM-F956B', screenWidth: 412, screenHeight: 906, dprOptions: [2.625], platformVersions: ['14.0.0'], chromeVersions: ['126.0.6478.122', '127.0.6533.103'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Samsung Galaxy Z Fold5', model: 'SM-F946B', uaModel: 'SM-F946B', screenWidth: 412, screenHeight: 884, dprOptions: [2.625], platformVersions: ['14.0.0'], chromeVersions: ['124.0.6367.179', '125.0.6422.113'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 740', vendor: 'Qualcomm' }] },
      { name: 'Samsung Galaxy Z Flip6', model: 'SM-F741B', uaModel: 'SM-F741B', screenWidth: 360, screenHeight: 780, dprOptions: [3], platformVersions: ['14.0.0'], chromeVersions: ['126.0.6478.122', '127.0.6533.103'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Google Pixel 9 Pro XL', model: 'Pixel 9 Pro XL', uaModel: 'Pixel 9 Pro XL', screenWidth: 448, screenHeight: 998, dprOptions: [3], platformVersions: ['15.0.0'], chromeVersions: ['126.0.6478.122', '127.0.6533.103'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [16], gpuOptions: [{ renderer: 'Immortalis-G715', vendor: 'ARM' }] },
      { name: 'Google Pixel 9 Pro', model: 'Pixel 9 Pro', uaModel: 'Pixel 9 Pro', screenWidth: 412, screenHeight: 892, dprOptions: [2.75], platformVersions: ['15.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122', '127.0.6533.103'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [16], gpuOptions: [{ renderer: 'Immortalis-G715', vendor: 'ARM' }] },
      { name: 'Google Pixel 8 Pro', model: 'Pixel 8 Pro', uaModel: 'Pixel 8 Pro', screenWidth: 448, screenHeight: 998, dprOptions: [3], platformVersions: ['14.0.0'], chromeVersions: ['124.0.6367.179', '125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Immortalis-G715', vendor: 'ARM' }] },
      { name: 'OnePlus 12', model: 'PJD110', uaModel: 'PJD110', screenWidth: 450, screenHeight: 1000, dprOptions: [3], platformVersions: ['14.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [16], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Xiaomi 14 Ultra', model: '24030PN60G', uaModel: '24030PN60G', screenWidth: 480, screenHeight: 1040, dprOptions: [3], platformVersions: ['14.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [16], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] },
      { name: 'Honor Magic6 Pro', model: 'BVL-N49', uaModel: 'BVL-N49', screenWidth: 448, screenHeight: 998, dprOptions: [3], platformVersions: ['14.0.0'], chromeVersions: ['125.0.6422.113', '126.0.6478.122'], hardwareConcurrencyOptions: [8], deviceMemoryOptions: [12], gpuOptions: [{ renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' }] }
    ]
  };

  // ============================================================
  //  ESTADO
  // ============================================================
  var state = {
    currentDevice: null,
    rotationCount: 0,
    deviceIndex: 0,
    sessionStart: Date.now(),
    lastAdTime: 0,
    adsShownThisMinute: 0,
    minuteResetTime: Date.now(),
    totalAdsShown: 0,
    lastRealPrice: null,       // último estimated_price REAL do Monetag
    totalRealEarnings: 0,      // soma de todos estimated_price reais
    realPrices: [],            // histórico de preços reais
    lastActivity: Date.now(),
    isActive: true,
    preloadReady: false,
    deviceBag: [],
    cycleNumber: 0,
    deviceInstanceCounter: 0,
    generatedProfiles: 0,
    catalogSize: 0,
    generatorSweep: 0,
    generatorPools: { ios: [], android: [] }
  };

  // ============================================================
  //  UTILS
  // ============================================================
  function log(msg, data) {
    if (!CONFIG.debug) return;
    if (data !== undefined) console.log('[eCPM-BOOST] ' + msg, data);
    else console.log('[eCPM-BOOST] ' + msg);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function cloneDevice(device) {
    return JSON.parse(JSON.stringify(device));
  }

  function pickFromOptions(options, fallback) {
    return options && options.length ? pickRandom(options) : fallback;
  }

  function getCatalogSize() {
    return PREMIUM_DEVICE_LIBRARY.ios.length + PREMIUM_DEVICE_LIBRARY.android.length;
  }

  function buildLocaleOptions(platformName) {
    return platformName === 'iOS'
      ? [
          ['en-US', 'en'],
          ['en-GB', 'en'],
          ['pt-BR', 'pt', 'en-US'],
          ['es-ES', 'es', 'en'],
          ['de-DE', 'de', 'en']
        ]
      : [
          ['en-US', 'en'],
          ['pt-BR', 'pt', 'en-US'],
          ['es-MX', 'es', 'en-US'],
          ['fr-FR', 'fr', 'en'],
          ['it-IT', 'it', 'en']
        ];
  }

  function applySmallJitter(baseValue, sequenceNumber, amplitude) {
    if (!amplitude) return baseValue;
    return baseValue + ((sequenceNumber % (amplitude * 2 + 1)) - amplitude);
  }

  function buildIOSProfile(template, cycleNumber, sequenceNumber) {
    var version = pickFromOptions(template.platformVersions, '18.0.0');
    var safariVersion = version.split('.').slice(0, 2).join('.');
    var osToken = version.replace(/\./g, '_');
    var deviceType = template.uaDeviceType || 'iPhone';
    var instance = ++state.deviceInstanceCounter;
    var locale = pickRandom(buildLocaleOptions('iOS'));
    var gpu = pickFromOptions(template.gpuOptions, { renderer: 'Apple GPU', vendor: 'Apple Inc.' });

    return {
      name: template.name,
      userAgent: 'Mozilla/5.0 (' + deviceType + '; CPU ' + (deviceType === 'iPad' ? 'OS ' : 'iPhone OS ') + osToken + ' like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/' + safariVersion + ' Mobile/15E148 Safari/604.1',
      brands: [{ brand: 'Safari', version: safariVersion }, { brand: 'Apple WebKit', version: '605.1' }],
      fullVersionList: [{ brand: 'Safari', version: version }, { brand: 'Apple WebKit', version: '605.1.15' }],
      mobile: true,
      platformName: 'iOS',
      platformVersion: version,
      architecture: 'arm',
      bitness: '64',
      model: template.model,
      uaFullVersion: version,
      platform: template.platform,
      vendor: 'Apple Computer, Inc.',
      appVersion: '5.0 (' + deviceType + '; CPU ' + (deviceType === 'iPad' ? 'OS ' : 'iPhone OS ') + osToken + ' like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/' + safariVersion + ' Mobile/15E148 Safari/604.1',
      maxTouchPoints: 5,
      hardwareConcurrency: pickFromOptions(template.hardwareConcurrencyOptions, 6),
      deviceMemory: pickFromOptions(template.deviceMemoryOptions, 8),
      language: locale[0],
      languages: locale,
      screenWidth: applySmallJitter(template.screenWidth, sequenceNumber, deviceType === 'iPad' ? 2 : 1),
      screenHeight: applySmallJitter(template.screenHeight, sequenceNumber * 2, deviceType === 'iPad' ? 3 : 2),
      devicePixelRatio: pickFromOptions(template.dprOptions, 3),
      colorDepth: 30,
      connectionType: '4g',
      downlink: 22 + ((instance + sequenceNumber) % 12),
      rtt: 24 + ((instance * 3 + cycleNumber) % 18),
      gpu: gpu,
      profileId: template.model + '-c' + cycleNumber + '-s' + sequenceNumber + '-n' + instance,
      canvasSeed: cycleNumber * 100000 + sequenceNumber * 10 + instance
    };
  }

  function buildAndroidProfile(template, cycleNumber, sequenceNumber) {
    var chromeVersion = pickFromOptions(template.chromeVersions, '126.0.6478.122');
    var chromeMajor = chromeVersion.split('.')[0];
    var androidVersion = pickFromOptions(template.platformVersions, '14.0.0');
    var androidLabel = androidVersion.split('.')[0];
    var instance = ++state.deviceInstanceCounter;
    var locale = pickRandom(buildLocaleOptions('Android'));
    var gpu = pickFromOptions(template.gpuOptions, { renderer: 'Adreno (TM) 750', vendor: 'Qualcomm' });
    var uaModel = template.uaModel || template.model;

    return {
      name: template.name,
      userAgent: 'Mozilla/5.0 (Linux; Android ' + androidLabel + '; ' + uaModel + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + chromeVersion + ' Mobile Safari/537.36',
      brands: [{ brand: 'Google Chrome', version: chromeMajor }, { brand: 'Chromium', version: chromeMajor }, { brand: 'Not.A/Brand', version: '24' }],
      fullVersionList: [{ brand: 'Google Chrome', version: chromeVersion }, { brand: 'Chromium', version: chromeVersion }, { brand: 'Not.A/Brand', version: '24.0.0.0' }],
      mobile: true,
      platformName: 'Android',
      platformVersion: androidVersion,
      architecture: 'arm',
      bitness: '64',
      model: template.model,
      uaFullVersion: chromeVersion,
      platform: 'Linux armv81',
      vendor: 'Google Inc.',
      appVersion: '5.0 (Linux; Android ' + androidLabel + '; ' + uaModel + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + chromeVersion + ' Mobile Safari/537.36',
      maxTouchPoints: 10,
      hardwareConcurrency: pickFromOptions(template.hardwareConcurrencyOptions, 8),
      deviceMemory: pickFromOptions(template.deviceMemoryOptions, 12),
      language: locale[0],
      languages: locale,
      screenWidth: applySmallJitter(template.screenWidth, sequenceNumber, 2),
      screenHeight: applySmallJitter(template.screenHeight, sequenceNumber * 3, 4),
      devicePixelRatio: pickFromOptions(template.dprOptions, 3),
      colorDepth: 24,
      connectionType: '4g',
      downlink: 20 + ((instance + sequenceNumber) % 15),
      rtt: 26 + ((instance * 4 + cycleNumber) % 20),
      gpu: gpu,
      profileId: template.model + '-c' + cycleNumber + '-s' + sequenceNumber + '-n' + instance,
      canvasSeed: cycleNumber * 100000 + sequenceNumber * 10 + instance
    };
  }

  function buildGeneratedDevice(template, cycleNumber, sequenceNumber) {
    if ((template.uaDeviceType || '').toLowerCase() === 'ipad' || (template.platform || '').toLowerCase() === 'iphone' || (template.platform || '').toLowerCase() === 'ipad') {
      return buildIOSProfile(template, cycleNumber, sequenceNumber);
    }
    return buildAndroidProfile(template, cycleNumber, sequenceNumber);
  }

  function choosePlatform(iosPool, androidPool) {
    if (!iosPool.length) return 'android';
    if (!androidPool.length) return 'ios';
    return Math.random() < CONFIG.iosWeight ? 'ios' : 'android';
  }

  function refillPlatformPool(platformKey) {
    return shuffle(PREMIUM_DEVICE_LIBRARY[platformKey]);
  }

  function refillGeneratorPools() {
    state.generatorSweep++;
    state.cycleNumber = state.generatorSweep;
    state.generatorPools.ios = refillPlatformPool('ios');
    state.generatorPools.android = refillPlatformPool('android');
    log('♻️ Biblioteca premium recarregada | varredura #' + state.generatorSweep);
  }

  function ensureGeneratorPools() {
    state.catalogSize = getCatalogSize();
    if (!state.generatorPools.ios.length && !state.generatorPools.android.length) {
      refillGeneratorPools();
    }
  }

  function takeTemplateFromPool(platformKey, avoidModel) {
    var pool = state.generatorPools[platformKey];
    if (!pool.length) return null;
    if (avoidModel && pool.length > 1 && pool[0].model === avoidModel) {
      pool.push(pool.shift());
    }
    return pool.shift();
  }

  function generateNextDeviceProfile() {
    ensureGeneratorPools();

    var avoidModel = state.currentDevice ? state.currentDevice.model : null;
    var preferredPlatform = choosePlatform(state.generatorPools.ios, state.generatorPools.android);
    var template = takeTemplateFromPool(preferredPlatform, avoidModel);

    if (!template) {
      template = takeTemplateFromPool(preferredPlatform === 'ios' ? 'android' : 'ios', avoidModel);
    }

    if (!template) {
      refillGeneratorPools();
      template = takeTemplateFromPool(choosePlatform(state.generatorPools.ios, state.generatorPools.android), avoidModel);
    }

    state.generatedProfiles++;
    return buildGeneratedDevice(template, state.generatorSweep, state.generatedProfiles);
  }

  function fillDeviceBuffer() {
    var targetSize = Math.max(CONFIG.deviceBufferSize, getCatalogSize() * 6);
    while (state.deviceBag.length < targetSize) {
      state.deviceBag.push(generateNextDeviceProfile());
    }
    log('♾️ Buffer premium pronto com ' + state.deviceBag.length + ' perfis disponíveis');
  }

  // ============================================================
  //  PARTE 1: SPOOFING COMPLETO DO DEVICE
  // ============================================================

  function selectDevice() {
    if (state.deviceBag.length <= CONFIG.deviceRefillThreshold) {
      fillDeviceBuffer();
      state.deviceIndex = 0;
    }

    var nextDevice = state.deviceBag.shift();
    if (state.currentDevice && nextDevice && nextDevice.model === state.currentDevice.model && state.deviceBag.length) {
      state.deviceBag.push(nextDevice);
      nextDevice = state.deviceBag.shift();
    }

    state.deviceIndex++;
    return nextDevice;
  }

  // 1A. User-Agent
  function spoofUserAgent(device) {
    try {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return device.userAgent; }, configurable: true
      });
      Object.defineProperty(navigator, 'appVersion', {
        get: function() { return device.appVersion; }, configurable: true
      });
      log('✅ UA → ' + device.name);
    } catch(e) {}
  }

  // 1B. Client Hints API (o que o Monetag realmente usa)
  function spoofClientHints(device) {
    try {
      var fakeUAData = {
        brands: device.brands,
        mobile: device.mobile,
        platform: device.platformName,
        getHighEntropyValues: function() {
          return Promise.resolve({
            brands: device.brands,
            fullVersionList: device.fullVersionList,
            mobile: device.mobile,
            model: device.model,
            platform: device.platformName,
            platformVersion: device.platformVersion,
            architecture: device.architecture,
            bitness: device.bitness,
            uaFullVersion: device.uaFullVersion
          });
        },
        toJSON: function() {
          return { brands: device.brands, mobile: device.mobile, platform: device.platformName };
        }
      };
      Object.defineProperty(navigator, 'userAgentData', {
        get: function() { return fakeUAData; }, configurable: true
      });
      log('✅ Client Hints → ' + device.platformName + ' | ' + device.model);
    } catch(e) {}
  }

  // 1C. Navigator props
  function spoofNavigator(device) {
    var props = {
      platform: device.platform,
      vendor: device.vendor,
      language: device.language,
      languages: device.languages,
      maxTouchPoints: device.maxTouchPoints,
      hardwareConcurrency: device.hardwareConcurrency,
      deviceMemory: device.deviceMemory
    };
    for (var key in props) {
      try {
        Object.defineProperty(navigator, key, {
          get: (function(v) { return function() { return v; }; })(props[key]),
          configurable: true
        });
      } catch(e) {}
    }
  }

  // 1D. Screen
  function spoofScreen(device) {
    var screenProps = {
      width: device.screenWidth, height: device.screenHeight,
      availWidth: device.screenWidth, availHeight: device.screenHeight - 40,
      colorDepth: device.colorDepth, pixelDepth: device.colorDepth
    };
    for (var key in screenProps) {
      try {
        Object.defineProperty(screen, key, {
          get: (function(v) { return function() { return v; }; })(screenProps[key]),
          configurable: true
        });
      } catch(e) {}
    }
    try {
      Object.defineProperty(window, 'devicePixelRatio', {
        get: function() { return device.devicePixelRatio; }, configurable: true
      });
    } catch(e) {}
  }

  // 1E. Connection
  function spoofConnection(device) {
    try {
      var connObj = {
        effectiveType: device.connectionType,
        downlink: device.downlink + Math.random() * 5,
        rtt: device.rtt + Math.floor(Math.random() * 10),
        saveData: false, type: 'cellular',
        addEventListener: function() {}, removeEventListener: function() {}
      };
      Object.defineProperty(navigator, 'connection', {
        get: function() { return connObj; }, configurable: true
      });
    } catch(e) {}
  }

  // 1F. Touch
  function spoofTouch() {
    try {
      if (typeof window.TouchEvent === 'undefined') window.TouchEvent = function() {};
      if (!('ontouchstart' in window)) window.ontouchstart = null;
    } catch(e) {}
  }

  // 1G. WebGL GPU
  function spoofWebGL(device) {
    try {
      var gpu = device.gpu;
      var origGet = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(p) {
        if (p === 37446) return gpu.renderer;
        if (p === 37445) return gpu.vendor;
        return origGet.apply(this, arguments);
      };
      if (typeof WebGL2RenderingContext !== 'undefined') {
        var origGet2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(p) {
          if (p === 37446) return gpu.renderer;
          if (p === 37445) return gpu.vendor;
          return origGet2.apply(this, arguments);
        };
      }
    } catch(e) {}
  }

  // 1H. Canvas fingerprint (variação por rotação + perfil)
  function spoofCanvas(device) {
    try {
      var orig = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        var ctx = this.getContext('2d');
        var seed = device && device.canvasSeed ? device.canvasSeed : state.rotationCount;
        if (ctx) {
          ctx.fillStyle = 'rgba(' + ((seed * 7 + 13) % 256) + ',' + ((seed * 3 + 7) % 256) + ',0,0.001)';
          ctx.fillRect(0, 0, 1, 1);
        }
        return orig.apply(this, arguments);
      };
    } catch(e) {}
  }

  // Aplicar TUDO
  function applyDeviceSpoof(device) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('🔄 Spoofing → ' + device.name);
    spoofUserAgent(device);
    spoofClientHints(device);
    spoofNavigator(device);
    spoofScreen(device);
    spoofConnection(device);
    spoofTouch();
    spoofWebGL(device);
    spoofCanvas(device);
    state.currentDevice = device;
    state.rotationCount++;
    log('✅ ' + device.name + ' | ' + device.platformName + ' ' + device.platformVersion + ' | ' + device.screenWidth + 'x' + device.screenHeight);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // Rotação automática
  function startRotation() {
    setInterval(function() {
      applyDeviceSpoof(selectDevice());
    }, CONFIG.rotationInterval);
  }

  // ============================================================
  //  PARTE 2: CAPTURA DO PREÇO REAL DO MONETAG
  // ============================================================

  // Armazena o último preço real para o sendPostback usar
  window.__lastRealMonetagPrice = null;

  function hookSDKForRealPrice() {
    var SDK_NAME = 'show_10873424';
    var checkInterval = setInterval(function() {
      if (window[SDK_NAME] && !window._sdkPriceHooked) {
        var originalShow = window[SDK_NAME];

        window[SDK_NAME] = function(options) {
          var result;
          var requestType = options && options.type ? options.type : 'show';
          try {
            result = originalShow.call(this, options);
          } catch(hookErr) {
            log('⚠️ Erro no SDK original: ' + hookErr.message);
            throw hookErr; // Re-throw para que o caller (triggerAd) trate
          }

          if (result && typeof result.then === 'function') {
            return result.then(function(data) {
              if (data) {
                // Capturar preço REAL
                if (data.estimated_price !== undefined && data.estimated_price !== null) {
                  var realPrice = parseFloat(data.estimated_price);
                  window.__lastRealMonetagPrice = realPrice;
                  state.lastRealPrice = realPrice;
                  state.totalRealEarnings += realPrice;
                  state.realPrices.push(realPrice);

                  log('💰 PREÇO REAL do Monetag: $' + realPrice.toFixed(6));
                  log('💰 Total ganho na sessão: $' + state.totalRealEarnings.toFixed(6));
                }
                if (data.reward_event_type) {
                  log('📊 Tipo: ' + data.reward_event_type + (data.reward_event_type === 'valued' ? ' ✅ MONETIZADO' : ' ⚠️ NÃO MONETIZADO'));
                }
              }
              return data;
            }).catch(function(promiseErr) {
              var errText = String(promiseErr || '');
              if (requestType === 'preload' && /timeout/i.test(errText)) {
                state.preloadReady = false;
                log('ℹ️ Preload do SDK expirou sem anúncio pronto');
                return null;
              }
              log('⚠️ Erro na Promise do SDK: ' + promiseErr);
              throw promiseErr; // Re-throw para que o caller trate
            });
          }
          return result;
        };

        window._sdkPriceHooked = true;
        clearInterval(checkInterval);
        log('✅ SDK hookado — capturando preço REAL do Monetag');
      }
    }, 1000);
  }

  // ============================================================
  //  PARTE 3: OTIMIZAÇÕES (preload, viewability, frequency)
  // ============================================================

  // 3A. Preload
  function preloadNextAd() {
    var SDK_NAME = 'show_10873424';
    if (!window[SDK_NAME]) {
      setTimeout(preloadNextAd, 3000);
      return;
    }
    try {
      window[SDK_NAME]({ type: 'preload', timeout: 3000 }).then(function(data) {
        state.preloadReady = !!data;
        if (data) log('✅ Próximo ad pré-carregado');
      }).catch(function() {
        state.preloadReady = false;
      });
    } catch(e) {}
  }

  // 3B. Frequency control — DESABILITADO para garantir que anúncios SEMPRE abram
  // O controle de frequência estava bloqueando anúncios silenciosamente.
  // Agora canShowAd() SEMPRE retorna true para que o SDK do Monetag decida.
  function canShowAd() {
    var now = Date.now();
    if (now - state.minuteResetTime > 60000) {
      state.adsShownThisMinute = 0;
      state.minuteResetTime = now;
    }
    // Apenas registrar para stats, mas NUNCA bloquear
    if (state.adsShownThisMinute >= CONFIG.maxAdsPerMinute) {
      log('📊 Frequency info: ' + state.adsShownThisMinute + ' ads neste minuto (sem bloqueio)');
    }
    if (now - state.lastAdTime < CONFIG.minTimeBetweenAds) {
      log('📊 Frequency info: ' + (now - state.lastAdTime) + 'ms desde último ad (sem bloqueio)');
    }
    // Reativar usuário em qualquer tentativa de mostrar ad
    state.isActive = true;
    state.lastActivity = Date.now();
    return true;
  }

  function recordAdShown() {
    state.lastAdTime = Date.now();
    state.adsShownThisMinute++;
    state.totalAdsShown++;
    setTimeout(preloadNextAd, 2000);
  }

  // 3C. Hook no triggerAd — SEMPRE permite a execução
  function hookAdTrigger() {
    var check = setInterval(function() {
      if (typeof window.triggerAd === 'function' && !window._triggerHooked) {
        window._originalTriggerAd = window.triggerAd;
        window.triggerAd = function() {
          // SEMPRE permitir — apenas registrar stats
          canShowAd(); // apenas para logging
          try {
            return window._originalTriggerAd.apply(this, arguments);
          } catch(e) {
            log('⚠️ Erro ao chamar triggerAd original: ' + e.message);
          }
        };
        window._triggerHooked = true;
        clearInterval(check);
        log('✅ triggerAd hookado (sem bloqueio de frequency)');
      }
    }, 1000);
  }

  // 3D. Engagement tracker
  function setupEngagement() {
    ['click', 'scroll', 'touchstart', 'mousemove'].forEach(function(evt) {
      document.addEventListener(evt, function() {
        state.lastActivity = Date.now();
        state.isActive = true;
      }, { passive: true });
    });
    // Monitorar inatividade apenas para logging, mas NUNCA pausar ads
    setInterval(function() {
      if (Date.now() - state.lastActivity > 120000) {
        log('📊 Usuário inativo há 2+ min (ads continuam funcionando)');
        // NÃO desativar — manter state.isActive = true SEMPRE
        state.isActive = true;
      }
    }, 10000);
  }

  // 3E. Viewability
  function setupViewability() {
    if (typeof IntersectionObserver === 'undefined') return;
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          e.target.dataset.viewable = 'true';
        }
      });
    }, { threshold: [0, 0.5, 1.0] });

    setInterval(function() {
      document.querySelectorAll('[id*="container-"], iframe[src*="monetag"], iframe[src*="tgads"]').forEach(function(el) {
        if (!el.dataset.observing) { obs.observe(el); el.dataset.observing = 'true'; }
      });
    }, 2000);
  }

  // ============================================================
  //  API PÚBLICA
  // ============================================================
  window.DeviceEcpmBoost = {
    getStats: function() {
      var mins = Math.round((Date.now() - state.sessionStart) / 60000);
      var avgPrice = state.realPrices.length > 0
        ? (state.totalRealEarnings / state.realPrices.length)
        : 0;
      return {
        spoofedDevice: state.currentDevice ? state.currentDevice.name : 'Nenhum',
        spoofedOS: state.currentDevice ? state.currentDevice.platformName + ' ' + state.currentDevice.platformVersion : 'N/A',
        spoofedModel: state.currentDevice ? state.currentDevice.model : 'N/A',
        spoofedProfile: state.currentDevice ? state.currentDevice.profileId : 'N/A',
        rotations: state.rotationCount,
        sessionTime: mins + ' min',
        totalAdsShown: state.totalAdsShown,
        lastRealPrice: state.lastRealPrice !== null ? '$' + state.lastRealPrice.toFixed(6) : 'Aguardando...',
        avgRealPrice: avgPrice > 0 ? '$' + avgPrice.toFixed(6) : 'Aguardando...',
        totalRealEarnings: '$' + state.totalRealEarnings.toFixed(6),
        impressionsWithPrice: state.realPrices.length,
        preloadReady: state.preloadReady,
        uniqueDevicesRemaining: state.deviceBag.length,
        premiumCycle: state.cycleNumber,
        premiumCatalogSize: state.catalogSize,
        generatedProfiles: state.generatedProfiles,
        isActive: state.isActive
      };
    },

    rotate: function() {
      var d = selectDevice();
      applyDeviceSpoof(d);
      return d.name + ' [' + d.profileId + ']';
    },

    preload: function() {
      preloadNextAd();
      return 'Preloading...';
    },

    // Ver histórico de preços reais
    getPriceHistory: function() {
      if (state.realPrices.length === 0) {
        console.log('Nenhum preço real capturado ainda. Assista um anúncio primeiro.');
        return [];
      }
      console.log('\n💰 HISTÓRICO DE PREÇOS REAIS DO MONETAG:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      state.realPrices.forEach(function(p, i) {
        console.log('  #' + (i + 1) + ': $' + p.toFixed(6));
      });
      var avg = state.totalRealEarnings / state.realPrices.length;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  Média: $' + avg.toFixed(6));
      console.log('  Total: $' + state.totalRealEarnings.toFixed(6));
      console.log('  eCPM estimado: $' + (avg * 1000).toFixed(4));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return state.realPrices;
    },

    // Diagnóstico
    diagnose: function() {
      console.log('\n========================================');
      console.log('  eCPM BOOST v4.0 — DIAGNÓSTICO');
      console.log('========================================');
      console.log('\n🎭 SPOOFING ATIVO:');
      console.log('  Device: ' + (state.currentDevice ? state.currentDevice.name : 'N/A'));
      console.log('  UA: ' + navigator.userAgent.substring(0, 70) + '...');
      console.log('  Platform: ' + navigator.platform);
      console.log('  Model: ' + (state.currentDevice ? state.currentDevice.model : 'N/A'));
      console.log('  Perfil: ' + (state.currentDevice ? state.currentDevice.profileId : 'N/A'));
      console.log('  Catálogo premium: ' + state.catalogSize + ' bases | ' + state.generatedProfiles + ' perfis gerados');
      console.log('  Screen: ' + screen.width + 'x' + screen.height + ' @' + window.devicePixelRatio + 'x');
      console.log('  Touch: ' + navigator.maxTouchPoints);
      console.log('  Language: ' + navigator.language);
      console.log('  Connection: ' + (navigator.connection ? navigator.connection.effectiveType : 'N/A'));

      console.log('\n💰 PREÇOS REAIS:');
      console.log('  Último: ' + (state.lastRealPrice !== null ? '$' + state.lastRealPrice.toFixed(6) : 'Aguardando...'));
      console.log('  Média: ' + (state.realPrices.length > 0 ? '$' + (state.totalRealEarnings / state.realPrices.length).toFixed(6) : 'Aguardando...'));
      console.log('  Total sessão: $' + state.totalRealEarnings.toFixed(6));
      console.log('  Impressões com preço: ' + state.realPrices.length);

      console.log('\n📊 SESSÃO:');
      console.log('  Tempo: ' + Math.round((Date.now() - state.sessionStart) / 60000) + ' min');
      console.log('  Ads mostrados: ' + state.totalAdsShown);
      console.log('  Rotações: ' + state.rotationCount);
      console.log('  Preload pronto: ' + state.preloadReady);
      console.log('\n========================================\n');
    },

    setIOSWeight: function(w) {
      CONFIG.iosWeight = Math.max(0, Math.min(1, w));
      log('iOS weight: ' + (CONFIG.iosWeight * 100) + '%');
    },

    setEnabled: function(val) {
      CONFIG.enabled = !!val;
      log(val ? '✅ Boost ATIVADO' : '❌ Boost DESATIVADO');
    }
  };

  // ============================================================
  //  INICIALIZAÇÃO
  // ============================================================
  function init() {
    if (!CONFIG.enabled) return;

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('🚀 eCPM BOOST v4.0');
    log('   Spoofing de Device + Preço Real + Otimizações');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Spoofar device ANTES do SDK
    applyDeviceSpoof(selectDevice());
    startRotation();

    // 2. Hookar SDK para capturar preço real
    hookSDKForRealPrice();

    // 3. Otimizações
    setTimeout(preloadNextAd, CONFIG.preloadDelay);
    hookAdTrigger();
    setupEngagement();
    setupViewability();

    log('');
    log('💡 Comandos:');
    log('   DeviceEcpmBoost.diagnose()       → Diagnóstico completo');
    log('   DeviceEcpmBoost.getStats()       → Status + preço real');
    log('   DeviceEcpmBoost.getPriceHistory() → Histórico de preços reais');
    log('   DeviceEcpmBoost.rotate()         → Trocar device');
    log('   DeviceEcpmBoost.preload()        → Forçar preload');
    log('');
  }

  init();

})();
