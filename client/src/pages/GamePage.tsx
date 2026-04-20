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
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

// ===== TIPOS =====
export type GameType = "spin" | "candy" | "scratch";

interface GamePageProps {
  gameType: GameType;
}

// ===== CONFIGURAÇÃO POR JOGO =====
const GAME_CONFIG: Record<GameType, { label: string; emoji: string; title: string }> = {
  spin: {
    label: "Roleta",
    emoji: "\u{1F3B0}",
    title: "Roleta - Ganhe Recompensas",
  },
  candy: {
    label: "Candy",
    emoji: "\u{1F36C}",
    title: "Candy - Ganhe Recompensas",
  },
  scratch: {
    label: "Raspadinha",
    emoji: "\u{1F3AB}",
    title: "Raspadinha - Ganhe Recompensas",
  },
};

// ===== CONFIGURAÇÃO MONETAG =====
const MONETAG_ZONE_ID = "10670317";
const MONETAG_SDK_GLOBAL = `show_${MONETAG_ZONE_ID}`;

const API_BASE_URL = "https://monetag-postback-server-production.up.railway.app/api/stats/user/";
const POSTBACK_URL = "https://monetag-postback-server-production.up.railway.app/api/postback";

const MAX_IMPRESSIONS = 20;
const MAX_CLICKS = 2;

let __lastPostbackTime = 0;
let __lastPostbackType = "";

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

function sendPostback(eventType: "impression" | "click") {
  const now = Date.now();
  if (now - __lastPostbackTime < 25000 && __lastPostbackType === eventType) {
    console.log(`[POSTBACK] Ignorando ${eventType} - duplicado`);
    return;
  }
  __lastPostbackTime = now;
  __lastPostbackType = eventType;
  const userId = localStorage.getItem("user_id") || "";
  const userEmail = localStorage.getItem("user_email") || "";
  const price = eventType === "click" ? "0.0045" : "0.0023";
  const params = new URLSearchParams({
    event_type: eventType,
    zone_id: MONETAG_ZONE_ID,
    ymid: userId,
    user_email: userEmail,
    estimated_price: price,
  });
  console.log(`[POSTBACK] Enviando ${eventType}...`);
  fetch(`${POSTBACK_URL}?${params.toString()}`, { method: "GET", mode: "cors" })
    .then((res) => res.json())
    .then((data) => console.log(`[POSTBACK] ${eventType} enviado:`, data))
    .catch((err) => console.error(`[POSTBACK] Erro:`, err));
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

  // Atualizar título da página com base no jogo
  useEffect(() => {
    document.title = config.title;
  }, [config.title]);

  const fetchStats = useCallback((userId: string) => {
    fetch(API_BASE_URL + userId)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setImpressionCount(data.total_impressions || 0);
          setClickCount(data.total_clicks || 0);
        }
      })
      .catch((err) => console.error("[STATS] Erro:", err));
  }, []);

  useEffect(() => {
    // 1) Tenta ler o ymid do próprio link (o app Flutter abre com ?ymid=XXXX).
    //    Suporta query (?ymid=), fragment (#ymid=) e também ?u= / ?user_id= como fallback.
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

    if (typeof window[MONETAG_SDK_GLOBAL] === "function") {
      setSdkReady(true);
      setStatusMessage("Pronto");
      return;
    }
    const script = document.createElement("script");
    script.src = "//libtl.com/sdk.js";
    script.setAttribute("data-zone", MONETAG_ZONE_ID);
    script.setAttribute("data-sdk", MONETAG_SDK_GLOBAL);
    script.async = true;
    script.onload = () => {
      let checks = 0;
      const iv = setInterval(() => {
        checks++;
        if (window[MONETAG_SDK_GLOBAL]) {
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
    return () => { if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); };
  }, [ymidConfirmed, fetchStats]);

  const handleYmidConfirm = () => {
    const trimmed = ymidInput.trim();
    if (!trimmed) return;
    getOrCreateStoredIdentity(trimmed);
    setLastYmid(trimmed);
    setYmidConfirmed(true);
    setShowYmidDialog(false);
  };

  const handleShowAd = async () => {
    if (loading) return;
    const showAd = window[MONETAG_SDK_GLOBAL];
    if (typeof showAd !== "function") {
      setStatusMessage("Aguarde...");
      return;
    }
    const userId = localStorage.getItem("user_id") || "";
    const userEmail = localStorage.getItem("user_email") || "";
    setLoading(true);
    setCurrentScreen("ad");
    setStatusMessage("Carregando...");
    console.log("[SCREEN] Tela: ad (assistindo anúncio)");
    try {
      await new Promise<void>((resolve, reject) => {
        let adDone = false;
        let completedFully = false;
        const adTimeout = setTimeout(() => { if (!adDone) { adDone = true; reject(new Error("Timeout")); } }, 120000);
        // Dispara postback APENAS quando o anúncio é completado até o fim.
        const onCompleted = () => {
          if (adDone) return;
          adDone = true;
          completedFully = true;
          clearTimeout(adTimeout);
          sendPostback("impression");
          setTimeout(() => { const uid = localStorage.getItem("user_id"); if (uid) fetchStats(uid); }, 500);
          resolve();
        };
        // Usuário fechou antes de terminar: resolve sem disparar postback.
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
        // Evita warning de variável não usada.
        void completedFully;
      });
      setStatusMessage("Pronto");
    } catch {
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

  // Countdown agora reinicia o site direto via window.location.href (sem evento custom)

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
      // Iniciar countdown se ainda não começou
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

  // Função countdown — quando zerar, reinicia o site imediatamente (sem pré-condições)
  function startCountdown(_overlayId: string) {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;

    const COUNTDOWN_SECONDS = 20;
    const endTime = Date.now() + COUNTDOWN_SECONDS * 1000;

    console.log('[COUNTDOWN] Iniciando countdown de ' + COUNTDOWN_SECONDS + 's');

    const intervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      const el = document.querySelector('#overlay-countdown');
      if (el) el.textContent = String(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        console.log('[COUNTDOWN] Timer zerou - reiniciando site');
        // Reiniciar o site direto, sem condições
        window.location.href = window.location.pathname + window.location.search;
      }
    }, 1000);
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

          {/* Header do jogo — identificação visual */}
          <div className="text-center">
            <span className="text-[32px]">{config.emoji}</span>
            <h1 className="text-[20px] font-bold text-foreground mt-1">{config.label}</h1>
          </div>

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

          {/* Botão principal — iOS style. Oculto quando as duas metas foram
              atingidas (20 impressões E 2 cliques): tarefa completa, não há
              motivo para abrir novos anúncios. */}
          {!(impressionsCompleted && clicksCompleted) && (
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
              {/* YMID row */}
              <button
                onClick={() => setShowYmidDialog(true)}
                className="w-full flex items-center justify-between px-4 py-[11px] active:bg-white/[0.05] transition-colors"
              >
                <span className="text-[15px] text-foreground">YMID</span>
                <div className="flex items-center gap-1">
                  <span className="text-[15px] text-muted-foreground truncate max-w-[160px]">
                    {lastYmid ?? "Não definido"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/20" />
                </div>
              </button>

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
                  <span className="text-[15px]">{config.emoji}</span>
                  <span className="text-[15px] text-muted-foreground">{config.label}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
