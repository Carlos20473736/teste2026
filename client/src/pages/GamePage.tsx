/*
 * Design: iOS / Apple Human Interface Guidelines
 * - Grouped table view layout with white cards on gray background
 * - SF Pro typography via -apple-system
 * - iOS blue (#007AFF) as primary accent
 * - Rounded 12px cards, thin separators, subtle shadows
 * - Native iOS-style progress bars and list rows
 *
 * Componente genérico para os 3 jogos: spin (roleta), candy, scratch (raspadinha).
 * Recebe `gameType` como prop para identificar qual jogo está ativo.
 *
 * CICLOS DE RESET (baseado no servidor):
 * - Candy: 1 hora após completar 20 impressões + 2 cliques
 * - Roleta (Spin): 1 hora após completar 20 impressões + 2 cliques
 * - Raspadinha (Scratch): 3 horas após completar 20 impressões + 2 cliques
 *
 * SISTEMA INTELIGENTE DE eCPM (v2):
 * - Escalada progressiva de intervalos entre anúncios
 * - Backoff exponencial em falhas (evita engasgar o SDK)
 * - Warm-up inteligente: começa devagar, acelera quando SDK estabiliza
 * - Detecção de qualidade: ajusta timing baseado no sucesso/falha
 * - Cooldown adaptativo pós-anúncio para dar tempo ao SDK preparar ad de alto valor
 * - Jitter aleatório para parecer comportamento humano natural
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

// ===== TIPOS =====
export type GameType = "spin" | "candy" | "scratch";

interface GamePageProps {
  gameType: GameType;
}

// ===== SISTEMA INTELIGENTE DE eCPM =====
// Classe que gerencia o timing adaptativo dos anúncios para maximizar eCPM
class ECPMOptimizer {
  private gameType: GameType;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private totalAdsShown: number = 0;
  private sessionStartTime: number = Date.now();
  private lastAdEndTime: number = 0;
  private adHistory: Array<{ timestamp: number; success: boolean; duration: number }> = [];

  // Configuração base de intervalos (em ms)
  // Esses valores são o "coração" do sistema — calibrados para Monetag/libtl
  private readonly BASE_COOLDOWN = 8000;       // Cooldown base entre anúncios (8s)
  private readonly MIN_COOLDOWN = 5000;         // Mínimo absoluto (5s) — nunca menos que isso
  private readonly MAX_COOLDOWN = 45000;        // Máximo em caso de muitas falhas (45s)
  private readonly WARM_UP_COOLDOWN = 12000;    // Cooldown durante warm-up (12s)
  private readonly INITIAL_DELAY = 3000;        // Delay inicial antes do primeiro anúncio (3s)
  private readonly BACKOFF_MULTIPLIER = 1.6;    // Multiplicador de backoff em falha
  private readonly SUCCESS_REDUCTION = 0.85;    // Fator de redução em sucesso consecutivo
  private readonly JITTER_RANGE = 2000;         // Jitter aleatório ±2s para parecer humano
  private readonly WARM_UP_ADS = 3;             // Quantos anúncios para sair do warm-up
  private readonly QUALITY_WINDOW = 8;          // Janela de anúncios para calcular taxa de sucesso
  private readonly OPTIMAL_SESSION_PACE = 25;   // Pace ideal: ~25s entre anúncios para eCPM alto
  private readonly PACE_WEIGHT = 0.3;           // Peso do pace no cálculo final

  constructor(gameType: GameType) {
    this.gameType = gameType;
    this.loadState();
  }

  // Persiste estado entre recarregamentos de página
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

  // Registra resultado de um anúncio
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
    this.adHistory.push({
      timestamp: Date.now(),
      success,
      duration: durationMs,
    });
    // Manter apenas a janela relevante
    if (this.adHistory.length > this.QUALITY_WINDOW * 2) {
      this.adHistory = this.adHistory.slice(-this.QUALITY_WINDOW);
    }
    this.saveState();
    console.log(`[eCPM][${this.gameType}] Ad #${this.totalAdsShown} ${success ? 'OK' : 'FAIL'} | ` +
      `Streak: ${success ? '+' + this.consecutiveSuccesses : '-' + this.consecutiveFailures} | ` +
      `Next cooldown: ${this.getNextCooldown()}ms`);
  }

  // Calcula a taxa de sucesso recente
  private getRecentSuccessRate(): number {
    const recent = this.adHistory.slice(-this.QUALITY_WINDOW);
    if (recent.length === 0) return 1;
    return recent.filter(a => a.success).length / recent.length;
  }

  // Calcula o cooldown ideal para o próximo anúncio
  getNextCooldown(): number {
    // Primeiro anúncio da sessão: delay inicial
    if (this.totalAdsShown === 0) {
      return this.INITIAL_DELAY;
    }

    // Fase de warm-up: ser mais cauteloso
    if (this.totalAdsShown <= this.WARM_UP_ADS) {
      const warmupCooldown = this.WARM_UP_COOLDOWN - (this.totalAdsShown * 1000);
      return Math.max(this.BASE_COOLDOWN, warmupCooldown) + this.getJitter();
    }

    let cooldown = this.BASE_COOLDOWN;

    // 1. Ajuste por falhas consecutivas (backoff exponencial)
    if (this.consecutiveFailures > 0) {
      cooldown = Math.min(
        this.MAX_COOLDOWN,
        cooldown * Math.pow(this.BACKOFF_MULTIPLIER, this.consecutiveFailures)
      );
    }

    // 2. Ajuste por sucessos consecutivos (redução gradual, mas com limite)
    if (this.consecutiveSuccesses > 2) {
      const reductions = Math.min(this.consecutiveSuccesses - 2, 5); // máx 5 reduções
      cooldown = Math.max(
        this.MIN_COOLDOWN,
        cooldown * Math.pow(this.SUCCESS_REDUCTION, reductions)
      );
    }

    // 3. Ajuste pela taxa de sucesso recente
    const successRate = this.getRecentSuccessRate();
    if (successRate < 0.5) {
      // Taxa ruim: aumentar bastante o cooldown
      cooldown *= 1.8;
    } else if (successRate < 0.75) {
      // Taxa mediana: aumentar um pouco
      cooldown *= 1.3;
    } else if (successRate > 0.9 && this.totalAdsShown > this.WARM_UP_ADS) {
      // Taxa excelente: pode ser um pouco mais agressivo
      cooldown *= 0.9;
    }

    // 4. Pace targeting — tenta manter um ritmo ideal para eCPM
    // Se o tempo desde o último anúncio já é maior que o pace ideal,
    // reduz o cooldown para compensar
    if (this.lastAdEndTime > 0) {
      const timeSinceLastAd = Date.now() - this.lastAdEndTime;
      if (timeSinceLastAd > this.OPTIMAL_SESSION_PACE * 1000) {
        // Já esperou bastante, pode ir mais rápido
        cooldown = Math.max(this.MIN_COOLDOWN, cooldown * 0.7);
      }
    }

    // 5. Clamp final + jitter
    cooldown = Math.max(this.MIN_COOLDOWN, Math.min(this.MAX_COOLDOWN, cooldown));
    cooldown += this.getJitter();

    return Math.round(cooldown);
  }

  // Jitter aleatório para parecer comportamento humano
  private getJitter(): number {
    return Math.round((Math.random() - 0.5) * this.JITTER_RANGE);
  }

  // Retorna se é seguro tentar mostrar um anúncio agora
  canShowAd(): boolean {
    if (this.lastAdEndTime === 0) return true;
    const elapsed = Date.now() - this.lastAdEndTime;
    return elapsed >= this.MIN_COOLDOWN;
  }

  // Reset para nova sessão/ciclo
  reset() {
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.totalAdsShown = 0;
    this.lastAdEndTime = 0;
    this.adHistory = [];
    this.sessionStartTime = Date.now();
    this.saveState();
  }

  // Stats para debug
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

// ===== CONFIGURAÇÃO POR JOGO =====
const POSTBACK_SERVER_BASE_URL = "https://monetag-postback-server-production.up.railway.app";

const GAME_CONFIG: Record<
  GameType,
  {
    label: string;
    emoji: string;
    title: string;
    zoneId: string;
    sdkGlobal: string;
    postbackUrl: string;
    statsUserUrl: string;
    source: "roulette" | "candy" | "scratch";
    resetLabel: string;
  }
> = {
  spin: {
    label: "Roleta",
    emoji: "\u{1F3B0}",
    title: "Roleta - Ganhe Recompensas",
    zoneId: "10575236",
    sdkGlobal: "show_10575236",
    postbackUrl: `${POSTBACK_SERVER_BASE_URL}/api/postback/spin`,
    statsUserUrl: `${POSTBACK_SERVER_BASE_URL}/api/stats/spin/user/`,
    source: "roulette",
    resetLabel: "1 hora",
  },
  candy: {
    label: "Candy",
    emoji: "\u{1F36C}",
    title: "Candy - Ganhe Recompensas",
    zoneId: "10903416",
    sdkGlobal: "show_10903416",
    postbackUrl: `${POSTBACK_SERVER_BASE_URL}/api/postback/candy`,
    statsUserUrl: `${POSTBACK_SERVER_BASE_URL}/api/stats/candy/user/`,
    source: "candy",
    resetLabel: "1 hora",
  },
  scratch: {
    label: "Raspadinha",
    emoji: "\u{1F3AB}",
    title: "Raspadinha - Ganhe Recompensas",
    zoneId: "10903423",
    sdkGlobal: "show_10903423",
    postbackUrl: `${POSTBACK_SERVER_BASE_URL}/api/postback/scratch`,
    statsUserUrl: `${POSTBACK_SERVER_BASE_URL}/api/stats/scratch/user/`,
    source: "scratch",
    resetLabel: "3 horas",
  },
};

const MAX_IMPRESSIONS = 20;
const MAX_CLICKS = 2;

let __lastPostbackTime = 0;
let __lastPostbackKey = "";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        initDataUnsafe?: {
          user?: { id?: number; username?: string };
        };
      };
    };
    [key: string]: any;
  }
}

const getTelegramUserId = () => {
  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return telegramId ? String(telegramId) : null;
};

const getOrCreateStoredIdentity = (customYmid?: string) => {
  if (customYmid) {
    localStorage.setItem("user_id", customYmid);
    localStorage.setItem("user_email", `${customYmid}@youngmoney.app`);
  }
  const storedUserId = localStorage.getItem("user_id");
  const storedUserEmail = localStorage.getItem("user_email");
  if (storedUserId && storedUserEmail) {
    return { userId: storedUserId, userEmail: storedUserEmail };
  }
  const telegramUserId = getTelegramUserId();
  const generatedUserId = telegramUserId ?? `guest_${Date.now()}`;
  const generatedUserEmail = `${generatedUserId}@youngmoney.app`;
  localStorage.setItem("user_id", generatedUserId);
  localStorage.setItem("user_email", generatedUserEmail);
  return { userId: generatedUserId, userEmail: generatedUserEmail };
};

function sendPostback(
  gameConfig: (typeof GAME_CONFIG)[GameType],
  eventType: "impression" | "click"
) {
  const now = Date.now();
  const dedupeKey = `${gameConfig.source}:${eventType}`;
  if (now - __lastPostbackTime < 25000 && __lastPostbackKey === dedupeKey) {
    console.log(`[POSTBACK][${gameConfig.source}] Ignorando ${eventType} - duplicado`);
    return;
  }
  __lastPostbackTime = now;
  __lastPostbackKey = dedupeKey;
  const userId = localStorage.getItem("user_id") || "";
  const userEmail = localStorage.getItem("user_email") || "";
  const price = eventType === "click" ? "0.0045" : "0.0023";
  const params = new URLSearchParams({
    event_type: eventType,
    zone_id: gameConfig.zoneId,
    ymid: userId,
    user_email: userEmail,
    estimated_price: price,
    source: gameConfig.source,
  });
  console.log(`[POSTBACK][${gameConfig.source}] Enviando ${eventType}...`);
  fetch(`${gameConfig.postbackUrl}?${params.toString()}`, { method: "GET", mode: "cors" })
    .then((res) => res.json())
    .then((data) => console.log(`[POSTBACK][${gameConfig.source}] ${eventType} enviado:`, data))
    .catch((err) => console.error(`[POSTBACK][${gameConfig.source}] Erro:`, err));
}

// Formatar tempo restante em HH:MM:SS
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// iOS-style progress bar component
function IOSProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-[6px] rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${Math.min(value, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default function GamePage({ gameType }: GamePageProps) {
  const config = GAME_CONFIG[gameType];

  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<"home" | "ad">("home");
  const [lastYmid, setLastYmid] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Inicializando...");
  const [impressionCount, setImpressionCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [showYmidDialog, setShowYmidDialog] = useState(false);
  const [ymidInput, setYmidInput] = useState("");
  const [ymidConfirmed, setYmidConfirmed] = useState(false);
  const ymidInputRef = useRef<HTMLInputElement>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telegramUserId = useMemo(() => getTelegramUserId(), []);

  // Estado do ciclo de reset (vem do servidor)
  const [cycleCompleted, setCycleCompleted] = useState(false);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ===== eCPM OPTIMIZER =====
  const ecpmOptimizerRef = useRef<ECPMOptimizer>(new ECPMOptimizer(gameType));

  // ===== AUTO-ABRIR ANÚNCIO =====
  const autoAdStorageKey = `auto_ad.${gameType}`;
  const [autoAdEnabled, setAutoAdEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`auto_ad.${gameType}`) === "1";
    } catch {
      return false;
    }
  });
  const autoAdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp de quando o último anúncio TERMINOU (para o optimizer calcular)
  const lastAdFinishRef = useRef<number>(0);

  // Atualizar título da página com base no jogo
  useEffect(() => {
    document.title = config.title;
  }, [config.title]);

  const fetchStats = useCallback((userId: string) => {
    fetch(config.statsUserUrl + userId)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setImpressionCount(data.total_impressions || 0);
          setClickCount(data.total_clicks || 0);

          // Verificar dados do ciclo
          if (data.cycle) {
            setCycleCompleted(data.cycle.is_completed || false);
            setSecondsUntilReset(data.cycle.seconds_until_reset || 0);
            setResetAt(data.cycle.reset_at || null);
          } else {
            setCycleCompleted(false);
            setSecondsUntilReset(0);
            setResetAt(null);
          }
        }
      })
      .catch((err) => console.error(`[STATS][${config.source}] Erro:`, err));
  }, [config.source, config.statsUserUrl]);

  // Countdown local para o reset (decrementa a cada segundo)
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (cycleCompleted && secondsUntilReset > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setSecondsUntilReset(prev => {
          if (prev <= 1) {
            // Reset expirou! Recarregar stats
            setCycleCompleted(false);
            setImpressionCount(0);
            setClickCount(0);
            // Reset do optimizer também
            ecpmOptimizerRef.current.reset();
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            const uid = localStorage.getItem("user_id");
            if (uid) setTimeout(() => fetchStats(uid), 1000);
            return 0;
          }
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
  }, [cycleCompleted, secondsUntilReset, fetchStats]);

  useEffect(() => {
    // 1) Tenta ler o ymid do próprio link (o app Flutter abre com ?ymid=XXXX).
    const readYmidFromUrl = (): string | null => {
      try {
        const qs = new URLSearchParams(window.location.search);
        const candidates = [
          qs.get("ymid"),
          qs.get("user_id"),
          qs.get("u"),
        ];
        const hash = window.location.hash.replace(/^#/, "");
        if (hash.includes("=")) {
          const hs = new URLSearchParams(hash);
          candidates.push(hs.get("ymid"), hs.get("user_id"), hs.get("u"));
        }
        for (const v of candidates) {
          if (v && v.trim() !== "") return v.trim();
        }
      } catch {}
      return null;
    };

    const urlYmid = readYmidFromUrl();
    if (urlYmid) {
      getOrCreateStoredIdentity(urlYmid);
      setYmidInput(urlYmid);
      setYmidConfirmed(true);
      setShowYmidDialog(false);
      return;
    }

    // 2) Sem ymid na URL: tenta recuperar do localStorage (visita anterior).
    const savedYmid = localStorage.getItem("user_id");
    if (savedYmid && savedYmid.trim() !== "") {
      setYmidConfirmed(true);
      setYmidInput(savedYmid);
      return;
    }

    // 3) Sem ymid em lugar nenhum: pede ao usuário (fallback manual).
    setShowYmidDialog(true);
  }, []);

  useEffect(() => {
    if (!ymidConfirmed) return;
    window.Telegram?.WebApp?.ready?.();
    const storedIdentity = getOrCreateStoredIdentity();
    setLastYmid(storedIdentity.userId);
    fetchStats(storedIdentity.userId);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(() => fetchStats(storedIdentity.userId), 5000);

    if (typeof window[config.sdkGlobal] === "function") {
      setSdkReady(true);
      setStatusMessage("Pronto");
      return;
    }
    const script = document.createElement("script");
    script.src = "//libtl.com/sdk.js";
    script.setAttribute("data-zone", config.zoneId);
    script.setAttribute("data-sdk", config.sdkGlobal);
    script.setAttribute("data-game-type", gameType);
    script.async = true;
    script.onload = () => {
      let checks = 0;
      const iv = setInterval(() => {
        checks++;
        if (window[config.sdkGlobal]) {
          clearInterval(iv);
          setSdkReady(true);
          setStatusMessage("Pronto");
        } else if (checks > 30) {
          clearInterval(iv);
          setStatusMessage("Timeout. Recarregue.");
        }
      }, 500);
    };
    script.onerror = () => setStatusMessage("Erro de conexão");
    document.head.appendChild(script);
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      script.remove();
    };
  }, [ymidConfirmed, fetchStats, config.sdkGlobal, config.zoneId]);

  const handleYmidConfirm = () => {
    const trimmed = ymidInput.trim();
    if (!trimmed) return;
    getOrCreateStoredIdentity(trimmed);
    setLastYmid(trimmed);
    setYmidConfirmed(true);
    setShowYmidDialog(false);
  };

  // Alterna o switch e persiste a preferência.
  const handleToggleAutoAd = useCallback((checked: boolean) => {
    setAutoAdEnabled(checked);
    try {
      localStorage.setItem(autoAdStorageKey, checked ? "1" : "0");
    } catch {}
    if (!checked && autoAdTimerRef.current) {
      clearTimeout(autoAdTimerRef.current);
      autoAdTimerRef.current = null;
    }
  }, [autoAdStorageKey]);

  const handleShowAd = async () => {
    if (loading) return;
    // Bloquear se ciclo está completo (em cooldown)
    if (cycleCompleted && secondsUntilReset > 0) {
      setStatusMessage(`Aguarde o reset (${formatTimeRemaining(secondsUntilReset)})`);
      return;
    }
    const showAd = window[config.sdkGlobal];
    if (typeof showAd !== "function") {
      setStatusMessage("Aguarde...");
      return;
    }

    // Verificar se o optimizer permite mostrar agora
    if (!ecpmOptimizerRef.current.canShowAd()) {
      console.log(`[eCPM][${gameType}] Optimizer bloqueou — cooldown mínimo não atingido`);
      return;
    }

    const userId = localStorage.getItem("user_id") || "";
    const userEmail = localStorage.getItem("user_email") || "";
    const adStartTime = Date.now();
    setLoading(true);
    setCurrentScreen("ad");
    setStatusMessage("Carregando...");
    console.log("[SCREEN] Tela: ad (assistindo anúncio)");
    try {
      await new Promise<void>((resolve, reject) => {
        let adDone = false;
        let completedFully = false;
        const adTimeout = setTimeout(() => { if (!adDone) { adDone = true; reject(new Error("Timeout")); } }, 120000);
        const onCompleted = () => {
          if (adDone) return;
          adDone = true;
          completedFully = true;
          clearTimeout(adTimeout);
          sendPostback(config, "impression");
          setTimeout(() => { const uid = localStorage.getItem("user_id"); if (uid) fetchStats(uid); }, 500);
          resolve();
        };
        const onClosed = () => {
          if (adDone) return;
          adDone = true;
          clearTimeout(adTimeout);
          resolve();
        };
        try {
          const sdkResult = showAd({ ymid: userId, requestVar: userEmail, onComplete: onCompleted, onClose: onClosed });
          if (sdkResult && typeof sdkResult.then === "function") {
            sdkResult
              .then(() => {
                if (!adDone) {
                  adDone = true;
                  clearTimeout(adTimeout);
                  resolve();
                }
              })
              .catch((err: any) => {
                if (!adDone) {
                  adDone = true;
                  clearTimeout(adTimeout);
                  reject(err);
                }
              });
          }
        } catch {
          try {
            showAd()
              .then(() => {
                if (!adDone) {
                  adDone = true;
                  clearTimeout(adTimeout);
                  resolve();
                }
              })
              .catch((err: any) => {
                if (!adDone) {
                  adDone = true;
                  clearTimeout(adTimeout);
                  reject(err);
                }
              });
          } catch (e2) {
            if (!adDone) {
              adDone = true;
              clearTimeout(adTimeout);
              reject(e2);
            }
          }
        }
        void completedFully;
      });
      // SUCESSO — registrar no optimizer
      const adDuration = Date.now() - adStartTime;
      ecpmOptimizerRef.current.recordAdResult(true, adDuration);
      lastAdFinishRef.current = Date.now();
      setStatusMessage("Pronto");
    } catch {
      // FALHA — registrar no optimizer (vai aumentar o cooldown)
      const adDuration = Date.now() - adStartTime;
      ecpmOptimizerRef.current.recordAdResult(false, adDuration);
      lastAdFinishRef.current = Date.now();
      setStatusMessage("Erro. Tente novamente.");
    } finally {
      setLoading(false);
      setCurrentScreen("home");
      console.log("[SCREEN] Tela: home");
    }
  };

  const impressionPercent = Math.min((impressionCount / MAX_IMPRESSIONS) * 100, 100);
  const clickPercent = Math.min((clickCount / MAX_CLICKS) * 100, 100);

  const clicksCompleted = clickCount >= MAX_CLICKS;
  const impressionsCompleted = impressionCount >= MAX_IMPRESSIONS;
  const allTasksCompleted = impressionsCompleted && clicksCompleted;

  // ===== AUTO-ABRIR ANÚNCIO COM eCPM OPTIMIZER =====
  // Usa o optimizer para calcular o timing ideal entre anúncios
  useEffect(() => {
    if (autoAdTimerRef.current) {
      clearTimeout(autoAdTimerRef.current);
      autoAdTimerRef.current = null;
    }

    if (!autoAdEnabled) return;
    if (!clicksCompleted) return;
    if (!sdkReady) return;
    if (!ymidConfirmed) return;
    if (loading) return;
    if (currentScreen !== "home") return;
    if (allTasksCompleted) return;
    if (cycleCompleted && secondsUntilReset > 0) return;

    // Pedir ao optimizer o cooldown ideal
    const optimalCooldown = ecpmOptimizerRef.current.getNextCooldown();

    // Calcular quanto tempo já passou desde o último anúncio
    const timeSinceLastAd = lastAdFinishRef.current > 0 ? Date.now() - lastAdFinishRef.current : Infinity;

    // Se já passou tempo suficiente, usar um delay mínimo; senão, esperar a diferença
    const wait = timeSinceLastAd >= optimalCooldown
      ? Math.max(1500, Math.random() * 2000) // Já pode, mas espera 1.5-3.5s para não ser instantâneo
      : Math.max(1500, optimalCooldown - timeSinceLastAd);

    console.log(`[eCPM][${gameType}] Auto-ad agendado em ${Math.round(wait)}ms ` +
      `(cooldown ideal: ${optimalCooldown}ms, desde último: ${Math.round(timeSinceLastAd)}ms)`);

    autoAdTimerRef.current = setTimeout(() => {
      autoAdTimerRef.current = null;
      // Revalidação no momento do disparo
      if (!autoAdEnabled) return;
      if (loading) return;
      if (allTasksCompleted) return;
      if (cycleCompleted && secondsUntilReset > 0) return;
      console.log(`[AUTO-AD][${gameType}] Disparando anúncio automaticamente (eCPM optimized)`);
      handleShowAd();
    }, wait);

    return () => {
      if (autoAdTimerRef.current) {
        clearTimeout(autoAdTimerRef.current);
        autoAdTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoAdEnabled,
    clicksCompleted,
    sdkReady,
    ymidConfirmed,
    loading,
    currentScreen,
    allTasksCompleted,
    cycleCompleted,
    secondsUntilReset > 0,
    gameType,
  ]);

  // Listener para o countdown do overlay - volta para home quando timer zera
  useEffect(() => {
    const handleCountdownDone = () => {
      console.log('[COUNTDOWN] Evento recebido - setando currentScreen para home');
      setLoading(false);
      setCurrentScreen('home');
      setStatusMessage('Pronto');
    };
    window.addEventListener('overlay-countdown-done', handleCountdownDone);
    return () => window.removeEventListener('overlay-countdown-done', handleCountdownDone);
  }, []);

  // ===== OVERLAY DE CLICK LIMIT =====
  const clickLimitReachedRef = useRef(false);
  const countdownStartedRef = useRef(false);

  // Effect 1: Criar overlay UMA VEZ quando clicks completam E tela é 'ad'
  useEffect(() => {
    const OVERLAY_ID = 'api-click-overlay';
    const STYLE_ID = OVERLAY_ID + '_style';

    if (!clicksCompleted) return;
    clickLimitReachedRef.current = true;

    // Se NÃO está na tela de anúncio, esconder overlay
    if (currentScreen !== 'ad') {
      const existingOverlay = document.getElementById(OVERLAY_ID);
      if (existingOverlay) existingOverlay.style.display = 'none';
      countdownStartedRef.current = false;
      return;
    }

    // Se overlay já existe, apenas mostrar (NÃO recriar)
    const existingOverlay = document.getElementById(OVERLAY_ID);
    if (existingOverlay) {
      existingOverlay.style.display = 'flex';
      if (!countdownStartedRef.current) {
        startCountdown(OVERLAY_ID);
      }
      return;
    }

    console.log('[OVERLAY] Criando overlay de progresso...');

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;background:rgba(0,0,0,0.5) !important;backdrop-filter:blur(20px) !important;-webkit-backdrop-filter:blur(20px) !important;z-index:2147483647 !important;display:flex !important;align-items:center !important;justify-content:center !important;pointer-events:auto !important;overflow-y:auto !important;padding:20px 0 !important;';

    ['click','mousedown','mouseup','touchstart','touchend','touchmove','contextmenu','pointerdown','pointerup'].forEach(function(ev) {
      overlay.addEventListener(ev, function(e: Event) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') return;
        e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
      }, true);
    });

    const impPct = Math.min((impressionCount / MAX_IMPRESSIONS) * 100, 100);
    const clkPct = Math.min((clickCount / MAX_CLICKS) * 100, 100);

    const msg = document.createElement('div');
    msg.style.cssText = 'background:transparent;padding:14px 18px;border-radius:14px;max-width:90%;width:340px;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;';
    msg.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg style="flex-shrink:0;display:block;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);line-height:18px;">Impress\u00f5es</span>
        </div>
        <span style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.9);white-space:nowrap;">
          <span id="overlay-imp-count">${Math.min(impressionCount, MAX_IMPRESSIONS)}</span><span style="font-size:12px;color:rgba(255,255,255,0.4);"> / ${MAX_IMPRESSIONS}</span>
        </span>
      </div>
      <div style="width:100%;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div id="overlay-imp-bar" style="height:100%;width:${impPct}%;background:#FF9500;border-radius:3px;transition:width 0.5s ease;"></div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:14px 0;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg style="flex-shrink:0;display:block;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
          <span style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);line-height:18px;">Cliques</span>
        </div>
        <span style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.9);white-space:nowrap;">
          <span>${Math.min(clickCount, MAX_CLICKS)}</span><span style="font-size:12px;color:rgba(255,255,255,0.4);"> / ${MAX_CLICKS}</span>
        </span>
      </div>
      <div style="width:100%;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${clkPct}%;background:#34C759;border-radius:3px;"></div>
      </div>
      ${clickCount >= MAX_CLICKS ? '<p style="font-size:11px;color:#34C759;font-weight:500;margin:5px 0 0;">Meta conclu\u00edda</p>' : ''}
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
        <span style="font-size:12px;color:rgba(255,255,255,0.45);">Voltando em </span>
        <span id="overlay-countdown" style="font-size:14px;font-weight:700;color:#007AFF;">20</span>
        <span style="font-size:12px;color:rgba(255,255,255,0.45);">s</span>
      </div>
    `;

    overlay.appendChild(msg);

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `#${OVERLAY_ID} { position: fixed !important; z-index: 2147483647 !important; display: flex !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; }`;
      document.head.appendChild(style);
    }

    document.documentElement.appendChild(overlay);

    // Iniciar countdown
    startCountdown(OVERLAY_ID);

    // MutationObserver para manter overlay no topo
    function keepOverlayOnTop() {
      const el = document.getElementById(OVERLAY_ID);
      if (!el) return;
      if (el.parentNode !== document.documentElement || el !== document.documentElement.lastElementChild) {
        document.documentElement.appendChild(el);
      }
      el.style.zIndex = '2147483647';
      el.style.display = 'flex';
      el.style.position = 'fixed';
    }

    const enforceInterval = setInterval(keepOverlayOnTop, 100);
    const observer = new MutationObserver(() => keepOverlayOnTop());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[OVERLAY] Overlay criado com countdown');

    return () => {
      observer.disconnect();
      clearInterval(enforceInterval);
    };
  }, [clicksCompleted, currentScreen]);

  // Effect 2: Atualizar contadores do overlay SEM recriar (separado do countdown)
  useEffect(() => {
    if (!clicksCompleted || currentScreen !== 'ad') return;
    const overlay = document.getElementById('api-click-overlay');
    if (!overlay) return;
    const impEl = overlay.querySelector('#overlay-imp-count');
    if (impEl) impEl.textContent = `${Math.min(impressionCount, MAX_IMPRESSIONS)}`;
    const barEl = overlay.querySelector('#overlay-imp-bar') as HTMLElement;
    if (barEl) barEl.style.width = `${Math.min((impressionCount / MAX_IMPRESSIONS) * 100, 100)}%`;
  }, [impressionCount, clickCount, clicksCompleted, currentScreen]);

  // Função countdown robusta baseada em timestamp absoluto (não afetada por re-renders)
  function startCountdown(overlayId: string) {
    if (countdownStartedRef.current) return; // Já está rodando, não duplicar
    countdownStartedRef.current = true;

    const COUNTDOWN_SECONDS = 20;
    const endTime = Date.now() + COUNTDOWN_SECONDS * 1000;

    console.log('[COUNTDOWN] Iniciando countdown de ' + COUNTDOWN_SECONDS + 's (timestamp-based)');

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      const el = document.querySelector('#overlay-countdown');
      if (el) el.textContent = String(remaining);

      if (remaining <= 0) {
        console.log('[COUNTDOWN] Timer zerou - voltando para ' + window.location.pathname);
        const gameUrl = window.location.origin + window.location.pathname + window.location.search;
        window.location.href = gameUrl;
        return;
      }

      requestAnimationFrame(() => setTimeout(tick, 200));
    };

    tick();
  }

  return (
    <>
      {/* Diálogo YMID — estilo iOS Alert */}
      <Dialog open={showYmidDialog} onOpenChange={(open) => { if (!open && ymidConfirmed) setShowYmidDialog(false); }}>
        <DialogContent
          showCloseButton={ymidConfirmed}
          className="bg-card rounded-2xl border-0 shadow-[0_8px_40px_rgba(0,0,0,0.12)] max-w-[320px]"
        >
          <DialogHeader>
            <DialogTitle className="text-center text-[17px] font-semibold tracking-[-0.01em]">
              Configurar YMID
            </DialogTitle>
            <DialogDescription className="text-center text-[13px] leading-[18px]">
              Insira seu identificador para rastrear suas impressões e cliques.
            </DialogDescription>
          </DialogHeader>
          <div className="px-1 py-1">
            <Input
              ref={ymidInputRef}
              id="ymid-input"
              type="text"
              placeholder="Seu YMID"
              value={ymidInput}
              onChange={(e) => setYmidInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleYmidConfirm(); }}
              className="h-[36px] text-[15px] rounded-lg bg-white/[0.06] border-0 px-3 placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-primary/40"
              autoFocus
            />
          </div>
          <DialogFooter className="border-t border-border/60 pt-3 -mx-6 -mb-6 px-0 pb-0">
            <button
              onClick={handleYmidConfirm}
              disabled={!ymidInput.trim()}
              className="w-full py-3 text-[17px] font-semibold text-primary hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors disabled:text-primary/30 disabled:cursor-not-allowed rounded-b-2xl"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout principal — fundo transparente (o fundo visível vem da WebView/app). */}
      <div className="min-h-screen flex items-center justify-center relative" style={{ background: 'transparent' }}>
        <div className="px-4 py-6 max-w-lg w-full space-y-6 relative" style={{ zIndex: 1 }}>


          {/* Card de Progresso — iOS grouped card */}
          <div className="rounded-xl bg-card shadow-[0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">

            {/* Impressões row */}
            <div className="px-4 pt-4 pb-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <svg className="flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-[15px] font-medium text-foreground">Impressões</span>
                </div>
                <span className="text-[15px] tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{Math.min(impressionCount, MAX_IMPRESSIONS)}</span>
                  <span className="text-[13px]"> / {MAX_IMPRESSIONS}</span>
                </span>
              </div>
              <IOSProgressBar value={impressionPercent} color="#FF9500" />
              {impressionCount >= MAX_IMPRESSIONS && (
                <p className="text-[12px] text-[#34C759] font-medium mt-1.5">Meta concluída</p>
              )}
            </div>

            {/* iOS separator */}
            <div className="h-px bg-white/[0.08]" />

            {/* Cliques row */}
            <div className="px-4 pt-3.5 pb-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <svg className="flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                  </svg>
                  <span className="text-[15px] font-medium text-foreground">Cliques</span>
                </div>
                <span className="text-[15px] tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{Math.min(clickCount, MAX_CLICKS)}</span>
                  <span className="text-[13px]"> / {MAX_CLICKS}</span>
                </span>
              </div>
              <IOSProgressBar value={clickPercent} color="#34C759" />
              {clickCount >= MAX_CLICKS && (
                <p className="text-[12px] text-[#34C759] font-medium mt-1.5">Meta concluída</p>
              )}
            </div>
          </div>

          {/* Botão principal — iOS style. Oculto quando ciclo completo ou tarefas concluídas */}
          {!allTasksCompleted && !(cycleCompleted && secondsUntilReset > 0) && (
            <button
              onClick={handleShowAd}
              disabled={loading || !sdkReady || !ymidConfirmed}
              className="w-full h-[50px] rounded-xl text-[17px] font-semibold text-white transition-all duration-150 active:scale-[0.98] active:opacity-90 disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#007AFF" }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Carregando...</span>
                </>
              ) : (
                <span>Assistir Anúncio</span>
              )}
            </button>
          )}


          {/* Seção de conta — iOS grouped card */}
          <div>
            <p className="text-[13px] font-normal text-muted-foreground uppercase tracking-wide px-4 mb-[6px]">
              Conta
            </p>
            <div className="rounded-xl bg-card shadow-[0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* YMID row — somente leitura */}
              <div className="flex items-center justify-between px-4 py-[11px]">
                <span className="text-[15px] text-foreground">YMID</span>
                <span className="text-[15px] text-muted-foreground truncate max-w-[160px]">
                  {lastYmid ?? "Não definido"}
                </span>
              </div>

              {/* Separator */}
              <div className="h-px bg-white/[0.08] ml-4" />

              {/* Status row */}
              <div className="flex items-center justify-between px-4 py-[11px]">
                <span className="text-[15px] text-foreground">Anúncio</span>
                <div className="flex items-center gap-1.5">
                  {!sdkReady ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 text-[#FF9500] animate-spin" />
                      <span className="text-[15px] text-[#FF9500]">Carregando...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                      <span className="text-[15px] text-[#34C759]">Pronto</span>
                    </>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-white/[0.08] ml-4" />

              {/* Jogo row — identifica qual jogo está ativo */}
              <div className="flex items-center justify-between px-4 py-[11px]">
                <span className="text-[15px] text-foreground">Jogo</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] text-muted-foreground">{config.label}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-white/[0.08] ml-4" />

              {/* Reset info row */}
              <div className="flex items-center justify-between px-4 py-[11px]">
                <span className="text-[15px] text-foreground">Reset</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] text-muted-foreground">
                    {cycleCompleted ? formatTimeRemaining(secondsUntilReset) : `A cada ${config.resetLabel}`}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-white/[0.08] ml-4" />

              {/* Auto Abrir Anúncio row — liberado apenas após 2 cliques no postback */}
              <div className="flex items-center justify-between px-4 py-[11px]">
                <div className="flex flex-col pr-3">
                  <span className={`text-[15px] ${clicksCompleted ? "text-foreground" : "text-foreground/40"}`}>
                    Abrir anúncio automaticamente
                  </span>
                  <span className="text-[12px] text-muted-foreground mt-0.5">
                    {!clicksCompleted
                      ? `Liberado após ${MAX_CLICKS} cliques (${Math.min(clickCount, MAX_CLICKS)}/${MAX_CLICKS})`
                      : autoAdEnabled
                        ? "Ativado — eCPM otimizado automaticamente"
                        : "Desativado — abra manualmente no botão"}
                  </span>
                </div>
                <Switch
                  checked={autoAdEnabled && clicksCompleted}
                  onCheckedChange={handleToggleAutoAd}
                  disabled={!clicksCompleted}
                  aria-label="Abrir anúncio automaticamente"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
