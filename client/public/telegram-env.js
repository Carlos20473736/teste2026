/**
 * Telegram Mini App Environment Simulator
 * 
 * This script simulates the Telegram WebApp environment so that
 * ad SDKs (like libtl.com) detect the page as running inside
 * a real Telegram Mini App and serve real ads instead of test ads.
 * 
 * Must be loaded BEFORE any ad SDK scripts.
 */
(function() {
  'use strict';

  // --- 1. Simulate TelegramWebviewProxy (native Android/iOS bridge) ---
  if (typeof window.TelegramWebviewProxy === 'undefined') {
    window.TelegramWebviewProxy = {
      postEvent: function(eventType, eventData) {
        // Silently consume events - simulates the native bridge
        console.log('[TG Sim] postEvent:', eventType);
      }
    };
  }

  // --- 2. Generate fake but realistic initData ---
  var fakeUserId = 6800000000 + Math.floor(Math.random() * 99999999);
  var fakeAuthDate = Math.floor(Date.now() / 1000);
  var fakeHash = Array.from({length: 64}, function() {
    return '0123456789abcdef'[Math.floor(Math.random() * 16)];
  }).join('');

  var fakeUser = {
    id: fakeUserId,
    first_name: 'User',
    last_name: '',
    username: 'user' + fakeUserId,
    language_code: 'pt-br',
    is_premium: false,
    allows_write_to_pm: true
  };

  var fakeInitDataUnsafe = {
    query_id: 'AAH' + btoa(String(fakeUserId)).replace(/=/g, ''),
    user: fakeUser,
    auth_date: fakeAuthDate,
    hash: fakeHash
  };

  var initDataParts = [
    'query_id=' + encodeURIComponent(fakeInitDataUnsafe.query_id),
    'user=' + encodeURIComponent(JSON.stringify(fakeUser)),
    'auth_date=' + fakeAuthDate,
    'hash=' + fakeHash
  ];
  var fakeInitData = initDataParts.join('&');

  // --- 3. Theme params matching Telegram dark/light ---
  var themeParams = {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#3390ec',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f0f0f0',
    header_bg_color: '#ffffff',
    accent_text_color: '#3390ec',
    section_bg_color: '#ffffff',
    section_header_text_color: '#3390ec',
    subtitle_text_color: '#999999',
    destructive_text_color: '#e53935',
    section_separator_color: '#e0e0e0',
    bottom_bar_bg_color: '#ffffff'
  };

  // --- 4. Build window.Telegram.WebApp ---
  var eventCallbacks = {};

  var WebApp = {
    initData: fakeInitData,
    initDataUnsafe: fakeInitDataUnsafe,
    version: '8.0',
    platform: 'android',
    colorScheme: 'light',
    themeParams: themeParams,
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    bottomBarColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    isVerticalSwipesEnabled: true,
    isFullscreen: false,
    isActive: true,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },

    // Methods
    ready: function() {},
    expand: function() {},
    close: function() {},
    enableClosingConfirmation: function() {},
    disableClosingConfirmation: function() {},
    enableVerticalSwipes: function() {},
    disableVerticalSwipes: function() {},
    requestFullscreen: function() {},
    exitFullscreen: function() {},
    lockOrientation: function() {},
    unlockOrientation: function() {},
    setHeaderColor: function() {},
    setBackgroundColor: function() {},
    setBottomBarColor: function() {},
    
    onEvent: function(eventType, callback) {
      if (!eventCallbacks[eventType]) eventCallbacks[eventType] = [];
      eventCallbacks[eventType].push(callback);
    },
    offEvent: function(eventType, callback) {
      if (!eventCallbacks[eventType]) return;
      var idx = eventCallbacks[eventType].indexOf(callback);
      if (idx > -1) eventCallbacks[eventType].splice(idx, 1);
    },

    sendData: function(data) {},
    openLink: function(url) { window.open(url, '_blank'); },
    openTelegramLink: function(url) { window.open(url, '_blank'); },
    openInvoice: function() {},
    showPopup: function(params, callback) { if (callback) callback('ok'); },
    showAlert: function(message, callback) { alert(message); if (callback) callback(); },
    showConfirm: function(message, callback) { if (callback) callback(confirm(message)); },
    showScanQrPopup: function() {},
    closeScanQrPopup: function() {},
    readTextFromClipboard: function(callback) { if (callback) callback(''); },
    requestWriteAccess: function(callback) { if (callback) callback(true); },
    requestContact: function(callback) { if (callback) callback(false); },
    switchInlineQuery: function() {},
    shareToStory: function() {},
    shareMessage: function() {},
    setEmojiStatus: function() {},
    requestEmojiStatusAccess: function() {},
    downloadFile: function() {},
    addToHomeScreen: function() {},
    checkHomeScreenStatus: function(callback) { if (callback) callback('unsupported'); },

    HapticFeedback: {
      impactOccurred: function() { return WebApp.HapticFeedback; },
      notificationOccurred: function() { return WebApp.HapticFeedback; },
      selectionChanged: function() { return WebApp.HapticFeedback; }
    },

    BackButton: {
      isVisible: false,
      show: function() { this.isVisible = true; },
      hide: function() { this.isVisible = false; },
      onClick: function() {},
      offClick: function() {}
    },

    MainButton: {
      text: '',
      color: '#3390ec',
      textColor: '#ffffff',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: function(t) { this.text = t; return this; },
      show: function() { this.isVisible = true; return this; },
      hide: function() { this.isVisible = false; return this; },
      enable: function() { this.isActive = true; return this; },
      disable: function() { this.isActive = false; return this; },
      showProgress: function() { this.isProgressVisible = true; return this; },
      hideProgress: function() { this.isProgressVisible = false; return this; },
      onClick: function() {},
      offClick: function() {},
      setParams: function() { return this; }
    },

    SecondaryButton: {
      text: '',
      color: '#f0f0f0',
      textColor: '#000000',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: function(t) { this.text = t; return this; },
      show: function() { this.isVisible = true; return this; },
      hide: function() { this.isVisible = false; return this; },
      enable: function() { this.isActive = true; return this; },
      disable: function() { this.isActive = false; return this; },
      showProgress: function() { this.isProgressVisible = true; return this; },
      hideProgress: function() { this.isProgressVisible = false; return this; },
      onClick: function() {},
      offClick: function() {},
      setParams: function() { return this; }
    },

    SettingsButton: {
      isVisible: false,
      show: function() { this.isVisible = true; },
      hide: function() { this.isVisible = false; },
      onClick: function() {},
      offClick: function() {}
    },

    CloudStorage: {
      setItem: function(key, value, callback) { 
        try { localStorage.setItem('tg_cloud_' + key, value); } catch(e) {}
        if (callback) callback(null, true);
      },
      getItem: function(key, callback) {
        var val = null;
        try { val = localStorage.getItem('tg_cloud_' + key); } catch(e) {}
        if (callback) callback(null, val);
      },
      getItems: function(keys, callback) {
        var result = {};
        keys.forEach(function(k) {
          try { result[k] = localStorage.getItem('tg_cloud_' + k); } catch(e) { result[k] = null; }
        });
        if (callback) callback(null, result);
      },
      removeItem: function(key, callback) {
        try { localStorage.removeItem('tg_cloud_' + key); } catch(e) {}
        if (callback) callback(null, true);
      },
      removeItems: function(keys, callback) {
        keys.forEach(function(k) {
          try { localStorage.removeItem('tg_cloud_' + k); } catch(e) {}
        });
        if (callback) callback(null, true);
      },
      getKeys: function(callback) {
        if (callback) callback(null, []);
      }
    },

    BiometricManager: {
      isInited: false,
      isBiometricAvailable: false,
      biometricType: 'unknown',
      isAccessRequested: false,
      isAccessGranted: false,
      isBiometricTokenSaved: false,
      deviceId: '',
      init: function(callback) { if (callback) callback(); },
      requestAccess: function(params, callback) { if (callback) callback(false); },
      authenticate: function(params, callback) { if (callback) callback(false); },
      updateBiometricToken: function(token, callback) { if (callback) callback(true); },
      openSettings: function() {}
    },

    DeviceStorage: {
      setItem: function(key, value, callback) {
        try { localStorage.setItem('tg_device_' + key, value); } catch(e) {}
        if (callback) callback(null, true);
      },
      getItem: function(key, callback) {
        var val = null;
        try { val = localStorage.getItem('tg_device_' + key); } catch(e) {}
        if (callback) callback(null, val);
      }
    },

    SecureStorage: {
      setItem: function(key, value, callback) {
        try { localStorage.setItem('tg_secure_' + key, value); } catch(e) {}
        if (callback) callback(null, true);
      },
      getItem: function(key, callback) {
        var val = null;
        try { val = localStorage.getItem('tg_secure_' + key); } catch(e) {}
        if (callback) callback(null, val);
      }
    },

    LocationManager: {
      isInited: false,
      isLocationAvailable: false,
      isAccessRequested: false,
      isAccessGranted: false,
      init: function(callback) { if (callback) callback(); },
      getLocation: function(callback) { if (callback) callback(null); },
      openSettings: function() {}
    },

    Accelerometer: {
      isStarted: false,
      x: 0, y: 0, z: 0,
      start: function() {},
      stop: function() {}
    },

    DeviceOrientation: {
      isStarted: false,
      absolute: false,
      alpha: 0, beta: 0, gamma: 0,
      start: function() {},
      stop: function() {}
    },

    Gyroscope: {
      isStarted: false,
      x: 0, y: 0, z: 0,
      start: function() {},
      stop: function() {}
    }
  };

  // --- 5. Set window.Telegram ---
  if (!window.Telegram) {
    window.Telegram = {};
  }

  window.Telegram.WebApp = WebApp;

  window.Telegram.WebView = {
    initParams: {
      tgWebAppData: fakeInitData,
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'android',
      tgWebAppThemeParams: JSON.stringify(themeParams)
    },
    isIframe: false,
    onEvent: function() {},
    offEvent: function() {},
    postEvent: function(eventType, callback, eventData) {
      if (window.TelegramWebviewProxy) {
        window.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData || ''));
      }
      if (callback) callback();
    },
    receiveEvent: function() {},
    callEventCallbacks: function() {}
  };

  // --- 6. Set URL hash params (tgWebAppData, tgWebAppVersion, tgWebAppPlatform) ---
  if (window.location.hash.indexOf('tgWebAppData') === -1) {
    var hashParams = [
      'tgWebAppData=' + encodeURIComponent(fakeInitData),
      'tgWebAppVersion=8.0',
      'tgWebAppPlatform=android',
      'tgWebAppThemeParams=' + encodeURIComponent(JSON.stringify(themeParams))
    ];
    // Set hash without triggering navigation
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search + '#' + hashParams.join('&'));
    } catch(e) {
      // fallback
      window.location.hash = hashParams.join('&');
    }
  }

  // --- 7. Set sessionStorage __telegram__initParams ---
  try {
    var storedParams = {
      tgWebAppData: fakeInitData,
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'android',
      tgWebAppThemeParams: JSON.stringify(themeParams)
    };
    window.sessionStorage.setItem('__telegram__initParams', JSON.stringify(storedParams));
  } catch(e) {}

  console.log('[TG Sim] Telegram Mini App environment initialized');
  console.log('[TG Sim] Platform: android, Version: 8.0, UserId:', fakeUserId);
})();
