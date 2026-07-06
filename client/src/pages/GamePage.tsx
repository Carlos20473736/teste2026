/*
 * MONETAG AUTO BOT - Versão para Jogos (Spin/Candy/Scratch)
 * 
 * Mesmo design e lógica da Home, diferenciando apenas pelo Zone ID do SDK.
 * O YMID vem pelo link (?ymid=XXX).
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ===== TIPOS =====
export type GameType = "spin" | "candy" | "scratch";

interface GamePageProps {
  gameType: GameType;
}

// ===== CONFIGURAÇÃO POR JOGO =====
const GAME_CONFIG: Record<
  GameType,
  {
    label: string;
    title: string;
    zoneId: string;
    sdkGlobal: string;
    source: string;
    resetLabel: string;
    resetSeconds: number;
  }
> = {
  spin: {
    label: "Roleta",
    title: "Roleta - Ganhe Recompensas",
    zoneId: "11231128",
    sdkGlobal: "show_11231128",
    source: "roulette",
    resetLabel: "1 hora",
    resetSeconds: 3600,
  },
  candy: {
    label: "Candy",
    title: "Candy - Ganhe Recompensas",
    zoneId: "11231132",
    sdkGlobal: "show_11231132",
    source: "candy",
    resetLabel: "1 hora",
    resetSeconds: 3600,
  },
  scratch: {
    label: "Raspadinha",
    title: "Raspadinha - Ganhe Recompensas",
    zoneId: "11231136",
    sdkGlobal: "show_11231136",
    source: "scratch",
    resetLabel: "3 horas",
    resetSeconds: 10800,
  },
};

// ===== SISTEMA DE eCPM COM TIMINGS FIXOS + RANDOM =====
class ECPMOptimizer {
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private totalAdsShown: number = 0;
  private sessionStartTime: number = Date.now();
  private lastAdEndTime: number = 0;
  private adHistory: Array<{ timestamp: number; success: boolean; duration: number }> = [];

  private readonly BASE_COOLDOWN: number;
  private readonly MIN_COOLDOWN: number;
  private readonly MAX_COOLDOWN: number;
  private readonly WARM_UP_COOLDOWN: number;
  private readonly INITIAL_DELAY: number;
  private readonly BACKOFF_MULTIPLIER: number;
  private readonly SUCCESS_REDUCTION: number;
  private readonly JITTER_RANGE: number;
  private readonly WARM_UP_ADS: number;
  private readonly QUALITY_WINDOW = 8;
  private readonly OPTIMAL_SESSION_PACE: number;
  private gameType: string;

  constructor(gameType: string) {
    this.gameType = gameType;
    this.BASE_COOLDOWN = this.randomize(8000, 0.25);
    this.MIN_COOLDOWN = this.randomize(5000, 0.2);
    this.MAX_COOLDOWN = this.randomize(45000, 0.2);
    this.WARM_UP_COOLDOWN = this.randomize(12000, 0.25);
    this.INITIAL_DELAY = this.randomize(3000, 0.3);
    this.BACKOFF_MULTIPLIER = 1.4 + Math.random() * 0.4;
    this.SUCCESS_REDUCTION = 0.8 + Math.random() * 0.1;
    this.JITTER_RANGE = this.randomize(2000, 0.3);
    this.WARM_UP_ADS = Math.floor(2 + Math.random() * 3);
    this.OPTIMAL_SESSION_PACE = this.randomize(25, 0.3);
    this.loadState();
  }

  private randomize(base: number, variance: number): number {
    const min = base * (1 - variance);
    const max = base * (1 + variance);
    return Math.round(min + Math.random() * (max - min));
  }

  private loadState() {
    try {
      const saved = sessionStorage.getItem(`ecpm_optimizer_${this.gameType}`);
      if (saved) {
        const state = JSON.parse(saved);
        this.consecutiveSuccesses = state.cs || 0;
        this.consecutiveFailures = state.cf || 0;
        this.totalAdsShown = state.total || 0;
        this.lastAdEndTime = state.lastEnd || 0;
        this.adHistory = state.history || [];
      }
    } catch {}
  }

  private saveState() {
    try {
      sessionStorage.setItem(`ecpm_optimizer_${this.gameType}`, JSON.stringify({
        cs: this.consecutiveSuccesses,
        cf: this.consecutiveFailures,
        total: this.totalAdsShown,
        lastEnd: this.lastAdEndTime,
        history: this.adHistory.slice(-this.QUALITY_WINDOW),
      }));
    } catch {}
  }

  recordAdResult(success: boolean, durationMs: number) {
    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
    }
    this.totalAdsShown++;
    this.lastAdEndTime = Date.now();
    this.adHistory.push({ timestamp: Date.now(), success, duration: durationMs });
    if (this.adHistory.length > this.QUALITY_WINDOW * 2) {
      this.adHistory = this.adHistory.slice(-this.QUALITY_WINDOW);
    }
    this.saveState();
    console.log(`[eCPM][${this.gameType}] Ad #${this.totalAdsShown} ${success ? 'OK' : 'FAIL'} | ` +
      `Streak: ${success ? '+' + this.consecutiveSuccesses : '-' + this.consecutiveFailures} | ` +
      `Next cooldown: ${this.getNextCooldown()}ms`);
  }

  private getRecentSuccessRate(): number {
    const recent = this.adHistory.slice(-this.QUALITY_WINDOW);
    if (recent.length === 0) return 1;
    return recent.filter(a => a.success).length / recent.length;
  }

  getNextCooldown(): number {
    if (this.totalAdsShown === 0) return this.INITIAL_DELAY;
    if (this.totalAdsShown <= this.WARM_UP_ADS) {
      const warmupCooldown = this.WARM_UP_COOLDOWN - (this.totalAdsShown * 1000);
      return Math.max(this.BASE_COOLDOWN, warmupCooldown) + this.getJitter();
    }
    let cooldown = this.BASE_COOLDOWN;
    if (this.consecutiveFailures > 0) {
      cooldown = Math.min(this.MAX_COOLDOWN, cooldown * Math.pow(this.BACKOFF_MULTIPLIER, this.consecutiveFailures));
    }
    if (this.consecutiveSuccesses > 2) {
      const reductions = Math.min(this.consecutiveSuccesses - 2, 5);
      cooldown = Math.max(this.MIN_COOLDOWN, cooldown * Math.pow(this.SUCCESS_REDUCTION, reductions));
    }
    const successRate = this.getRecentSuccessRate();
    if (successRate < 0.5) cooldown *= 1.8;
    else if (successRate < 0.75) cooldown *= 1.3;
    else if (successRate > 0.9 && this.totalAdsShown > this.WARM_UP_ADS) cooldown *= 0.9;
    if (this.lastAdEndTime > 0) {
      const timeSinceLastAd = Date.now() - this.lastAdEndTime;
      if (timeSinceLastAd > this.OPTIMAL_SESSION_PACE * 1000) {
        cooldown = Math.max(this.MIN_COOLDOWN, cooldown * 0.7);
      }
    }
    cooldown = Math.max(this.MIN_COOLDOWN, Math.min(this.MAX_COOLDOWN, cooldown));
    cooldown += this.getJitter();
    return Math.round(cooldown);
  }

  private getJitter(): number {
    return Math.round((Math.random() - 0.5) * this.JITTER_RANGE);
  }

  canShowAd(): boolean {
    if (this.lastAdEndTime === 0) return true;
    const elapsed = Date.now() - this.lastAdEndTime;
    return elapsed >= this.MIN_COOLDOWN;
  }

  reset() {
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.totalAdsShown = 0;
    this.lastAdEndTime = 0;
    this.adHistory = [];
    this.sessionStartTime = Date.now();
    this.saveState();
  }

  getStats() {
    return {
      totalAds: this.totalAdsShown,
      successRate: this.getRecentSuccessRate(),
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      nextCooldown: this.getNextCooldown(),
      isWarmUp: this.totalAdsShown <= this.WARM_UP_ADS,
    };
  }
}

// ===== CONSTANTES =====
const DOMAIN = "libtl.com";
const MAX_IMPRESSIONS = 20;
const MAX_CLICKS = 2;
const POSTBACK_SERVER_URL = "https://monetag-postback-server-production.up.railway.app";

// ===== FETCH STATS DO POSTBACK SERVER =====
async function fetchUserStats(gameType: GameType, ymid: string): Promise<{
  total_impressions: number;
  total_clicks: number;
  total_revenue: string;
  completed: boolean;
  cycle: {
    is_completed: boolean;
    seconds_until_reset: number;
    reset_at: string | null;
  };
} | null> {
  try {
    const endpoint = gameType === 'spin'
      ? `${POSTBACK_SERVER_URL}/api/stats/spin/user/${ymid}`
      : `${POSTBACK_SERVER_URL}/api/stats/${gameType}/user/${ymid}`;
    const resp = await fetch(endpoint, { method: 'GET' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success) return null;
    return data;
  } catch (err) {
    console.error(`[SYNC][${gameType}] Erro ao buscar stats:`, err);
    return null;
  }
}

// ===== OAID SNIFFER =====
let SDK_REAL_OAID: string | null = null;

function installOaidSniffer() {
  if ((window as any).__oaidSnifferInstalled) return;
  (window as any).__oaidSnifferInstalled = true;

  const capture = (url: string) => {
    try {
      if (!url || url.indexOf('e8ys.com') === -1) return;
      const q = url.split('?')[1];
      if (!q) return;
      const val = new URLSearchParams(q).get('oaid');
      if (val && !SDK_REAL_OAID) {
        SDK_REAL_OAID = val;
        try { localStorage.setItem('monetag_oaid', val); } catch {}
        console.log('[OAID] Capturado oaid REAL do SDK:', val);
      }
    } catch {}
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input: any, init?: any) {
    try {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      capture(u);
    } catch {}
    return origFetch(input, init);
  } as typeof window.fetch;

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string, ...rest: any[]) {
    try { capture(url); } catch {}
    // @ts-ignore
    return origOpen.call(this, method, url, ...rest);
  } as any;
}

if (typeof window !== 'undefined') {
  try { installOaidSniffer(); } catch {}
}

// ===== GERAÇÃO ALEATÓRIA DE IDs =====
function generateRandomYmid(): string {
  return `navigation${Math.floor(10000000 + Math.random() * 89999999)}`;
}

function generateRandomTelegramId(): string {
  return String(Math.floor(1000000000 + Math.random() * 8999999999));
}

function getRealOaid(): string {
  if (SDK_REAL_OAID) return SDK_REAL_OAID;
  try {
    const saved = localStorage.getItem('monetag_oaid');
    if (saved) { SDK_REAL_OAID = saved; return saved; }
  } catch {}
  return '';
}

function getConfig(gameType: GameType) {
  const config = GAME_CONFIG[gameType];
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');

  const ymid = params.get('ymid') || hashParams.get('ymid') || localStorage.getItem(`monetag_ymid_${gameType}`) || localStorage.getItem('monetag_ymid_global') || generateRandomYmid();
  const telegramId = params.get('tgid') || hashParams.get('tgid') || localStorage.getItem(`monetag_tgid_${gameType}`) || generateRandomTelegramId();
  const oaid = getRealOaid();

  localStorage.setItem(`monetag_ymid_${gameType}`, ymid);
  localStorage.setItem(`monetag_tgid_${gameType}`, telegramId);

  return { ymid, oaid, telegramId, zoneId: config.zoneId };
}

// ===== FINGERPRINT =====
function getAndroidModel(): string {
  const ua = navigator.userAgent;
  const match = ua.match(/;\s*([^;)]+)\s*Build\//);
  if (match) return match[1].trim();
  const match2 = ua.match(/Android[^;]*;\s*([^;)]+)/);
  if (match2) return match2[1].trim();
  return 'SM-A546B';
}

function getBrowserVersion(): string {
  const ua = navigator.userAgent;
  const match = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
  if (match) return match[1];
  const ff = ua.match(/Firefox\/([\d.]+)/);
  if (ff) return ff[1];
  const sf = ua.match(/Version\/([\d.]+)/);
  if (sf) return sf[1];
  return '148.0.7778.182';
}

function getOSVersion(): string {
  const ua = navigator.userAgent;
  const match = ua.match(/Android\s+([\d.]+)/);
  if (match) return match[1];
  const ios = ua.match(/OS\s+([\d_]+)/);
  if (ios) return ios[1].replace(/_/g, '.');
  return '14.0.0';
}

function buildParams(config: { ymid: string; oaid: string; telegramId: string; zoneId: string }) {
  const ts = Math.floor(Date.now() / 1000);
  const baseUrl = window.location.origin + window.location.pathname;
  const pageUrl = `${baseUrl}#tgWebAppData=query_id%3DAAH${config.telegramId}%26user%3D%257B%2522id%2522%253A${config.telegramId}%252C%2522first_name%2522%253A%2522User%2522%257D%26auth_date%3D${ts}%26hash%3Dd7831c17149d456cb3373ad87f38bedfbddbd1a64746e14813cbad7cd9963885&tgWebAppVersion=8.0&tgWebAppPlatform=android`;
  
  const realOaid = getRealOaid() || config.oaid;
  return new URLSearchParams({
    '_z': config.zoneId,
    'oaid': realOaid,
    'var': `${config.ymid}@youngmoney.app`,
    'ymid': config.ymid,
    'tgp': 'android',
    'tglc': '',
    'sdkp': '1',
    'var_3': config.telegramId,
    'of': 'true',
    'os': 'android',
    'is_mobile': 'true',
    'sw_version': 'v1.841.0',
    'android_model': getAndroidModel(),
    'browser_version': getBrowserVersion(),
    'os_version': getOSVersion(),
    'dmn': DOMAIN,
    'fs': '0',
    'cf': '0',
    'sw': String(screen.width || 1920),
    'sh': String(screen.height || 1080),
    'sah': String((screen as any).availHeight || 1040),
    'wx': String(window.screenX || Math.floor(Math.random() * 500)),
    'wy': String(window.screenY || Math.floor(Math.random() * 20)),
    'ww': String(window.innerWidth || 500),
    'wh': String(window.innerHeight || 900),
    'cw': String(document.documentElement.clientWidth || 484),
    'wiw': String(window.innerWidth || 484),
    'wih': String(window.innerHeight || 800),
    'wfc': '1',
    'pl': pageUrl,
    'np': '0',
    'pt': '0',
    'nb': '1',
    'ng': '1',
    'ix': '0',
    'nw': '1',
    'tb': 'true',
    'vsbl': 'true',
    'navlng': navigator.language || 'pt-BR',
    'bto': String(new Date().getTimezoneOffset()),
    'btz': Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    'jsp': '1',
    'excludes': '',
  });
}

async function waitForRealOaid(timeoutMs = 20000): Promise<string> {
  const start = Date.now();
  while (!getRealOaid()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('oaid real do SDK ainda não disponível');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return getRealOaid();
}

async function fetchAds(config: { ymid: string; oaid: string; telegramId: string; zoneId: string }) {
  await waitForRealOaid();
  const params = buildParams(config);
  const url = `https://e8ys.com/500/${config.zoneId}?${params.toString()}`;
  
  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': '*/*' },
  });
  
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    try {
      const decoded = atob(text);
      return JSON.parse(decoded);
    } catch {
      throw new Error(`Resposta inválida`);
    }
  }
}

async function resolveRuid(ruid: string) {
  try {
    const resp = await fetch(`https://e8ys.com/resolve?ruid=${ruid}`);
    if (resp.status === 204 || !resp.ok) return null;
    const text = await resp.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise(r => setTimeout(r, delay));
}

// ===== GERAÇÃO ALEATÓRIA DE TIMINGS POR SESSÃO =====
function generateSessionTimings() {
  const rand = (base: number, variance: number) => {
    const min = base * (1 - variance);
    const max = base * (1 + variance);
    return Math.round(min + Math.random() * (max - min));
  };

  return {
    delayBetweenCyclesMin: rand(2000, 0.4),
    delayBetweenCyclesMax: rand(6000, 0.35),
    viewTimeBase: rand(15000, 0.3),
    viewTimeVariance: rand(5000, 0.4),
    clickDelayMin: rand(1500, 0.35),
    clickDelayMax: rand(4000, 0.3),
    resolveDelayMin: rand(3000, 0.3),
    resolveDelayMax: rand(7000, 0.3),
    clickCycles: generateClickCycles(),
    pauseChance: 0.1 + Math.random() * 0.15,
    pauseDuration: rand(8000, 0.4),
  };
}

function generateClickCycles(): number[] {
  const cycles: number[] = [];
  const firstClick = Math.floor(2 + Math.random() * 8);
  const secondClick = Math.floor(firstClick + 3 + Math.random() * 8);
  cycles.push(firstClick);
  cycles.push(Math.min(secondClick, MAX_IMPRESSIONS));
  return cycles;
}

// ===== COUNTDOWN / TIMER =====
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== STARRY BACKGROUND =====
function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars: { x: number; y: number; r: number; opacity: number; speed: number; phase: number }[] = [];
    const starCount = Math.floor((canvas.width * canvas.height) / 4000);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.001 + 0.0002,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        const twinkle = Math.sin(time * star.speed + star.phase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.opacity * twinkle})`;
        ctx.fill();
      }
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

// ===== AD MODAL =====
interface AdModalProps {
  ad: any;
  timeRemaining: number;
}

function AdModal({ ad, timeRemaining }: AdModalProps) {
  const seconds = Math.ceil(timeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-2xl max-w-sm w-full shadow-2xl border border-white/5 overflow-hidden">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-bold z-10 shadow-lg">
          {timeStr}
        </div>
        <div className="relative w-full aspect-square bg-gradient-to-br from-slate-800 to-slate-950 overflow-hidden">
          {ad.image && (
            <img src={ad.image} alt="Ad" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect fill="%231e293b" width="400" height="400"/%3E%3C/svg%3E'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            {ad.icon && (
              <img src={ad.icon} alt="Icon" className="w-14 h-14 rounded-full flex-shrink-0 border-2 border-blue-500/30 shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle fill="%233b82f6" cx="50" cy="50" r="50"/%3E%3C/svg%3E'; }}
              />
            )}
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg leading-tight">{ad.title}</h2>
            </div>
          </div>
          <p className="text-white/75 text-sm leading-relaxed">{ad.text}</p>
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <span className="text-white/40 text-xs font-semibold">Ad</span>
            <span className="text-white/40 text-xs font-semibold">ads by Monetag</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== HISTÓRICO NO LOCALSTORAGE =====
interface HistoryEntry {
  timestamp: number;
  impressions: number;
  clicks: number;
  revenue: number;
  duration: number;
  ymid: string;
}

function saveHistoryEntry(entry: HistoryEntry, gameType: string) {
  try {
    const key = `bot_session_history_${gameType}`;
    const saved = localStorage.getItem(key);
    const history: HistoryEntry[] = saved ? JSON.parse(saved) : [];
    history.push(entry);
    const trimmed = history.slice(-50);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

// ===== YMID DIALOG (caso acesse direto sem YMID) =====
function YmidRequiredDialog({
  open,
  onConfirm,
  savedYmid,
}: {
  open: boolean;
  onConfirm: (ymid: string) => void;
  savedYmid: string;
}) {
  const [ymidInput, setYmidInput] = useState(savedYmid);

  useEffect(() => {
    if (open) setYmidInput(savedYmid);
  }, [open, savedYmid]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-2xl max-w-sm w-full shadow-2xl border border-white/10 overflow-hidden p-6">
        <h2 className="text-white font-bold text-xl mb-2 text-center">Digite seu YMID</h2>
        <p className="text-white/60 text-sm text-center mb-6">
          Informe seu YMID para continuar jogando.
        </p>
        <input
          type="text"
          value={ymidInput}
          onChange={(e) => setYmidInput(e.target.value)}
          placeholder="Ex: navigation90855924"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          autoFocus
        />
        <button
          onClick={() => {
            const trimmed = ymidInput.trim();
            if (trimmed) onConfirm(trimmed);
          }}
          disabled={!ymidInput.trim()}
          className="w-full mt-4 h-[44px] rounded-xl bg-[#007AFF] hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function GamePage({ gameType }: GamePageProps) {
  const gameConfig = GAME_CONFIG[gameType];

  // Verificar se tem YMID disponível
  const hasYmid = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    return !!(params.get('ymid') || hashParams.get('ymid') || localStorage.getItem(`monetag_ymid_${gameType}`) || localStorage.getItem('monetag_ymid_global'));
  };

  const [needsYmid, setNeedsYmid] = useState(!hasYmid());

  const handleYmidProvided = (ymid: string) => {
    localStorage.setItem(`monetag_ymid_${gameType}`, ymid);
    localStorage.setItem('monetag_ymid_global', ymid);
    // Atualizar a URL com o YMID
    const url = new URL(window.location.href);
    url.searchParams.set('ymid', ymid);
    window.history.replaceState({}, '', url.toString());
    setNeedsYmid(false);
    // Recarregar config
    configRef.current = getConfig(gameType);
  };

  const [impressions, setImpressions] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [status, setStatus] = useState("Aguardando início...");
  const [running, setRunning] = useState(false);
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [sdkReady, setSdkReady] = useState(false);

  // Countdown state
  const [cycleCompleted, setCycleCompleted] = useState(false);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const abortRef = useRef(false);
  const configRef = useRef(getConfig(gameType));
  const optimizerRef = useRef(new ECPMOptimizer(gameType));
  const sdkScriptRef = useRef<HTMLScriptElement | null>(null);
  const sessionStartRef = useRef<number>(0);

  // Revenue tracking
  const [revenue, setRevenue] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`local_stats_${gameType}`) || '{}');
      return saved.revenue || 0;
    } catch { return 0; }
  });

  // Persistir stats locais
  useEffect(() => {
    try {
      localStorage.setItem(`local_stats_${gameType}`, JSON.stringify({
        revenue,
        impressions,
        clicks,
        updatedAt: Date.now(),
      }));
    } catch {}
  }, [revenue, impressions, clicks, gameType]);

  // Atualizar título da página
  useEffect(() => {
    document.title = gameConfig.title;
  }, [gameConfig.title]);

  // ===== COUNTDOWN =====
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (cycleCompleted && secondsUntilReset > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setSecondsUntilReset(prev => {
          if (prev <= 1) {
            setCycleCompleted(false);
            setImpressions(0);
            setClicks(0);
            setRevenue(0);
            setCycle(0);
            optimizerRef.current.reset();
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            try { localStorage.removeItem(`countdown_state_${gameType}`); } catch {}
            return 0;
          }
          try {
            localStorage.setItem(`countdown_state_${gameType}`, JSON.stringify({
              secondsRemaining: prev - 1,
              savedAt: Date.now(),
            }));
          } catch {}
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [cycleCompleted, secondsUntilReset, gameType]);

  // Restaurar countdown do localStorage ao carregar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`countdown_state_${gameType}`);
      if (saved) {
        const state = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
        const remaining = Math.max(0, state.secondsRemaining - elapsed);
        if (remaining > 0) {
          setCycleCompleted(true);
          setSecondsUntilReset(remaining);
        } else {
          localStorage.removeItem(`countdown_state_${gameType}`);
        }
      }
    } catch {}
  }, [gameType]);

  // ===== SINCRONIZAR COM POSTBACK SERVER (dados reais) =====
  useEffect(() => {
    const config = configRef.current;
    if (!config.ymid || needsYmid) return;

    const syncStats = async () => {
      console.log(`[SYNC][${gameType}] Buscando stats reais para ymid=${config.ymid}...`);
      const stats = await fetchUserStats(gameType, config.ymid);
      if (!stats) {
        console.log(`[SYNC][${gameType}] Sem dados do servidor, usando valores locais`);
        return;
      }

      console.log(`[SYNC][${gameType}] Stats reais:`, stats);

      // Atualizar contadores com dados reais do postback server
      setImpressions(stats.total_impressions || 0);
      setClicks(stats.total_clicks || 0);
      setRevenue(parseFloat(stats.total_revenue) || 0);

      // Atualizar estado do ciclo
      if (stats.cycle && stats.cycle.is_completed && stats.cycle.seconds_until_reset > 0) {
        setCycleCompleted(true);
        setSecondsUntilReset(stats.cycle.seconds_until_reset);
        setStatus("Ciclo completo - Aguardando reset...");
        try {
          localStorage.setItem(`countdown_state_${gameType}`, JSON.stringify({
            secondsRemaining: stats.cycle.seconds_until_reset,
            savedAt: Date.now(),
          }));
        } catch {}
      } else if (stats.completed) {
        // Completou mas ciclo já resetou no servidor
        setCycleCompleted(true);
        const resetSeconds = GAME_CONFIG[gameType].resetSeconds;
        setSecondsUntilReset(resetSeconds);
        setStatus("Ciclo completo - Aguardando reset...");
      }

      // Salvar no localStorage para persistência
      try {
        localStorage.setItem(`local_stats_${gameType}`, JSON.stringify({
          revenue: parseFloat(stats.total_revenue) || 0,
          impressions: stats.total_impressions || 0,
          clicks: stats.total_clicks || 0,
          updatedAt: Date.now(),
        }));
      } catch {}
    };

    syncStats();
  }, [gameType, needsYmid]);

  // ===== SDK LOADING =====
  useEffect(() => {
    installOaidSniffer();

    if (typeof (window as any)[gameConfig.sdkGlobal] === 'function') {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '//libtl.com/sdk.js';
    script.setAttribute('data-zone', gameConfig.zoneId);
    script.setAttribute('data-sdk', gameConfig.sdkGlobal);
    script.setAttribute('data-game-type', gameConfig.source);
    script.async = true;

    script.onload = () => {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if ((window as any)[gameConfig.sdkGlobal]) {
          clearInterval(interval);
          setSdkReady(true);
          console.log(`[SDK][${gameType}] libtl.com/sdk.js carregado`);
        } else if (checks > 30) {
          clearInterval(interval);
          console.warn(`[SDK][${gameType}] Timeout`);
        }
      }, 500);
    };

    script.onerror = () => {
      console.error(`[SDK][${gameType}] Erro ao carregar`);
    };

    document.head.appendChild(script);
    sdkScriptRef.current = script;

    return () => {
      if (sdkScriptRef.current) {
        sdkScriptRef.current.remove();
      }
    };
  }, [gameConfig.sdkGlobal, gameConfig.zoneId, gameConfig.source, gameType]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`[MONETAG][${gameType}] [${time}] ${msg}`);
  }, [gameType]);

  // ===== AUTOMAÇÃO PRINCIPAL =====
  const startAutomation = useCallback(() => {
    if (running) return;
    if (cycleCompleted && secondsUntilReset > 0) {
      addLog(`Aguarde o reset (${formatTimeRemaining(secondsUntilReset)})`);
      return;
    }
    setRunning(true);
    abortRef.current = false;
    sessionStartRef.current = Date.now();

    const config = configRef.current;
    const timings = generateSessionTimings();

    addLog(`Config: ymid=${config.ymid}`);
    addLog(`[SDK] Status: ${sdkReady ? 'Pronto' : 'Não carregado'}`);
    setStatus("Rodando...");

    const runLoop = async () => {
      let cycleNum = 0;
      let totalImpressions = impressions;
      let totalClicks = clicks;
      const optimizer = optimizerRef.current;
      optimizer.reset();

      while (!abortRef.current) {
        if (totalImpressions >= MAX_IMPRESSIONS && totalClicks >= MAX_CLICKS) {
          addLog("METAS ATINGIDAS!");
          setStatus("Concluído! Countdown iniciado.");

          const sessionDuration = Date.now() - sessionStartRef.current;
          saveHistoryEntry({
            timestamp: Date.now(),
            impressions: totalImpressions,
            clicks: totalClicks,
            revenue,
            duration: sessionDuration,
            ymid: config.ymid,
          }, gameType);

          setCycleCompleted(true);
          setSecondsUntilReset(gameConfig.resetSeconds);
          try {
            localStorage.setItem(`countdown_state_${gameType}`, JSON.stringify({
              secondsRemaining: gameConfig.resetSeconds,
              savedAt: Date.now(),
            }));
          } catch {}

          break;
        }

        cycleNum++;
        setCycle(cycleNum);

        let delay = timings.delayBetweenCyclesMin + Math.random() * (timings.delayBetweenCyclesMax - timings.delayBetweenCyclesMin);

        if (Math.random() < timings.pauseChance && cycleNum > 1) {
          const pauseTime = timings.pauseDuration * (0.7 + Math.random() * 0.6);
          addLog(`[PAUSA] Distração simulada (${Math.round(pauseTime / 1000)}s)...`);
          setStatus(`Ciclo #${cycleNum} - Pausa...`);
          await humanDelay(pauseTime * 0.9, pauseTime * 1.1);
          if (abortRef.current) break;
        }

        if (totalImpressions >= MAX_IMPRESSIONS && totalClicks < MAX_CLICKS) {
          delay = 3000 + Math.random() * 3000;
        }

        const delaySeconds = Math.round(delay / 1000);
        addLog(`-- Ciclo #${cycleNum} -- (delay: ${delaySeconds}s)`);
        setStatus(`Ciclo #${cycleNum} - Aguardando (${delaySeconds}s)...`);
        await humanDelay(delay * 0.95, delay * 1.05);
        if (abortRef.current) break;

        setStatus(`Ciclo #${cycleNum} - Buscando anúncio...`);
        addLog("[1] Buscando anúncio via API...");

        let adData: any;
        try {
          adData = await fetchAds(config);
        } catch (err: any) {
          addLog(`[ERRO] Fetch ads falhou: ${err.message}`);
          optimizer.recordAdResult(false, 0);
          continue;
        }
        if (!adData || !adData.ads || adData.ads.length === 0) {
          addLog("[!] Sem ads disponíveis");
          optimizer.recordAdResult(false, 0);
          continue;
        }

        const ad = adData.ads[0];
        const ruid = adData.ruid || '';
        const impressionUrl = ad.impression_url || '';
        const clickUrl = ad.click || '';

        addLog(`[2] Ad: banner_id=${ad.banner_id}`);

        // === IMPRESSÃO HUMANIZADA ===
        if (totalImpressions < MAX_IMPRESSIONS && impressionUrl) {
          const viewTime = timings.viewTimeBase + (Math.random() - 0.5) * timings.viewTimeVariance;

          addLog(`[3] Assistindo anúncio (${Math.round(viewTime / 1000)}s)...`);
          setStatus(`Ciclo #${cycleNum} - Assistindo anúncio...`);
          setCurrentAd(ad);

          try {
            await fetch(impressionUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});
          } catch {}

          let elapsed = 0;
          const timerInterval = setInterval(() => {
            elapsed += 100;
            setTimeRemaining(Math.max(0, viewTime - elapsed));
            if (elapsed >= viewTime) {
              clearInterval(timerInterval);
              setCurrentAd(null);
            }
          }, 100);

          await humanDelay(viewTime * 0.98, viewTime * 1.02);
          clearInterval(timerInterval);
          setCurrentAd(null);

          totalImpressions++;
          setImpressions(totalImpressions);
          optimizer.recordAdResult(true, viewTime);

          addLog(`[5] Impression #${totalImpressions}/${MAX_IMPRESSIONS} completa!`);
        }

        // === RESOLVE COM TRACKING ===
        if (ruid) {
          const resolveWait = timings.resolveDelayMin + Math.random() * (timings.resolveDelayMax - timings.resolveDelayMin);
          addLog(`[6] Resolvendo ruid...`);
          await humanDelay(resolveWait * 0.9, resolveWait * 1.1);

          const resolveData = await resolveRuid(ruid);
          if (resolveData) {
            const price = resolveData.estimated_price;
            if (typeof price === 'number' && price > 0) {
              setRevenue(prev => prev + price);
              addLog(`[6] Resolve OK — $${price.toFixed(6)}`);
            } else {
              setRevenue(prev => prev + 0.055);
              addLog(`[6] Resolve OK (estimado: $0.055)`);
            }
          } else {
            setRevenue(prev => prev + 0.045);
            addLog(`[6] Resolve sem dados (fallback: $0.045)`);
          }
        }

        // === CLIQUE HUMANIZADO ===
        const shouldClick =
          clickUrl &&
          totalClicks < MAX_CLICKS &&
          (timings.clickCycles.includes(cycleNum) || (totalImpressions >= MAX_IMPRESSIONS && totalClicks < MAX_CLICKS));

        if (shouldClick) {
          const hesitation = timings.clickDelayMin + Math.random() * (timings.clickDelayMax - timings.clickDelayMin);
          addLog(`[7] Hesitando antes de clicar (${Math.round(hesitation / 1000)}s)...`);
          await humanDelay(hesitation * 0.9, hesitation * 1.1);
          if (abortRef.current) break;

          addLog(`[7] Abrindo CLICK em nova guia...`);
          setStatus(`Ciclo #${cycleNum} - Clicando...`);
          const clickTab = window.open(clickUrl, '_blank');

          const landingTime = 30000 + Math.random() * 30000;
          addLog(`[8] Na landing page... (${Math.round(landingTime / 1000)}s)`);
          await humanDelay(landingTime * 0.95, landingTime * 1.05);

          try { if (clickTab && !clickTab.closed) clickTab.close(); } catch {}

          totalClicks++;
          setClicks(totalClicks);

          addLog(`[9] Click #${totalClicks}/${MAX_CLICKS} completo!`);

          const postClickPause = 3000 + Math.random() * 5000;
          await humanDelay(postClickPause * 0.9, postClickPause * 1.1);
        }

        addLog(`Stats: ${totalImpressions}/${MAX_IMPRESSIONS} imp, ${totalClicks}/${MAX_CLICKS} clicks`);
        setStatus(`Ciclo #${cycleNum} - Completo`);
      }

      addLog(`Loop finalizado após ${cycleNum} ciclos`);
      setRunning(false);
    };

    runLoop();

    return () => { abortRef.current = true; };
  }, [running, addLog, sdkReady, impressions, clicks, revenue, cycleCompleted, secondsUntilReset, gameType, gameConfig.resetSeconds]);

  const stopAutomation = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
    addLog("Automação parada pelo usuário");
    setStatus("Parado");
  }, [addLog]);

  const impressionPercent = Math.min((impressions / MAX_IMPRESSIONS) * 100, 100);
  const clickPercent = Math.min((clicks / MAX_CLICKS) * 100, 100);

  return (
    <>
      <StarryBackground />

      <YmidRequiredDialog
        open={needsYmid}
        onConfirm={handleYmidProvided}
        savedYmid=""
      />

      {currentAd && (
        <AdModal ad={currentAd} timeRemaining={timeRemaining} />
      )}

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          {/* Nome do Jogo */}
          <div className="text-center pb-2">
            <h1 className="text-white font-bold text-xl">{gameConfig.label}</h1>
          </div>

          {/* Impressões */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/90 text-sm font-medium">Impressões</span>
                <span className="text-white font-bold text-sm">{impressions} <span className="text-white/40 font-normal">/ {MAX_IMPRESSIONS}</span></span>
              </div>
              <div className="w-full h-[6px] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${impressionPercent}%`, backgroundColor: '#FF9500' }} />
              </div>
            </div>
          </div>

          {/* Cliques */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/90 text-sm font-medium">Cliques</span>
                <span className="text-white font-bold text-sm">{clicks} <span className="text-white/40 font-normal">/ {MAX_CLICKS}</span></span>
              </div>
              <div className="w-full h-[6px] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${clickPercent}%`, backgroundColor: '#34C759' }} />
              </div>
            </div>
          </div>

          {/* Botão Assistir Anúncio / Parar */}
          <div className="px-4 pt-4">
            {!running ? (
              <button
                onClick={startAutomation}
                disabled={cycleCompleted && secondsUntilReset > 0}
                className="w-full h-[50px] rounded-xl bg-[#007AFF] hover:bg-[#0066DD] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base italic transition-all duration-150 shadow-lg"
              >
                Assistir Anúncio
              </button>
            ) : (
              <button
                onClick={stopAutomation}
                className="w-full h-[50px] rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white font-semibold text-base transition-all duration-150 shadow-lg"
              >
                Parar
              </button>
            )}
          </div>



          {/* Painel Status */}
          <div className="mx-4 mt-4 bg-white/[0.04] backdrop-blur-xl rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Status</span>
              <span className="text-white/90 text-sm font-medium">{status}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-white/60 text-sm">Jogo</span>
              <span className="text-white/90 text-sm font-medium">{gameConfig.label}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-white/60 text-sm">Ciclo</span>
              <span className="text-white/90 text-sm font-medium">#{cycle}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-white/60 text-sm">YMID</span>
              <span className="text-white/90 text-sm font-medium truncate max-w-[180px]">{configRef.current.ymid}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-white/60 text-sm">Reset</span>
              <span className="text-white/90 text-sm font-medium">
                {cycleCompleted ? formatTimeRemaining(secondsUntilReset) : `A cada ${gameConfig.resetLabel}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
