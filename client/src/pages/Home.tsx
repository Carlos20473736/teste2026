/*
 * Design: iOS / Apple Human Interface Guidelines
 * - Grouped table view layout with white cards on gray background
 * - SF Pro typography via -apple-system
 * - iOS blue (#007AFF) as primary accent
 * - Rounded 12px cards, thin separators, subtle shadows
 * - Native iOS-style progress bars and list rows
 */

import { Button } from "@/components/ui/button";
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
import { ChevronRight, Loader2, ShieldCheck } from "lucide-react";

// ===== CONFIGURAÇÃO =====
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

// Space ecosystem background — stars, nebulae, shooting stars
function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    interface Star {
      x: number; y: number; r: number; opacity: number;
      twinkleSpeed: number; phase: number; color: string;
    }
    interface ShootingStar {
      x: number; y: number; len: number; speed: number;
      angle: number; opacity: number; life: number; maxLife: number;
    }

    const stars: Star[] = [];
    const shootingStars: ShootingStar[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Star colors for realism
    const starColors = [
      '255,255,255',    // white
      '200,220,255',    // blue-white
      '255,240,220',    // warm white
      '180,200,255',    // light blue
      '255,220,180',    // light orange
    ];

    // Create stars with depth layers
    const starCount = Math.floor((canvas.width * canvas.height) / 3500);
    for (let i = 0; i < starCount; i++) {
      const layer = Math.random(); // 0=far, 1=close
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: layer < 0.6 ? Math.random() * 0.8 + 0.2 : layer < 0.9 ? Math.random() * 1.2 + 0.5 : Math.random() * 2 + 1,
        opacity: layer < 0.6 ? Math.random() * 0.4 + 0.1 : Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.0006 + 0.0001,
        phase: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    // Draw nebula clouds (static, drawn once to offscreen canvas)
    const nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = canvas.width;
    nebulaCanvas.height = canvas.height;
    const nCtx = nebulaCanvas.getContext('2d')!;

    const drawNebula = () => {
      // Subtle purple/blue nebula patches
      const nebulae = [
        { x: canvas.width * 0.15, y: canvas.height * 0.2, rx: 200, ry: 120, color: '60,20,120', opacity: 0.04 },
        { x: canvas.width * 0.8, y: canvas.height * 0.7, rx: 250, ry: 150, color: '20,40,100', opacity: 0.05 },
        { x: canvas.width * 0.5, y: canvas.height * 0.5, rx: 300, ry: 180, color: '30,15,80', opacity: 0.03 },
        { x: canvas.width * 0.3, y: canvas.height * 0.8, rx: 180, ry: 100, color: '15,30,90', opacity: 0.04 },
        { x: canvas.width * 0.7, y: canvas.height * 0.25, rx: 220, ry: 130, color: '50,10,80', opacity: 0.03 },
      ];
      for (const n of nebulae) {
        const grad = nCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(n.rx, n.ry));
        grad.addColorStop(0, `rgba(${n.color}, ${n.opacity})`);
        grad.addColorStop(0.5, `rgba(${n.color}, ${n.opacity * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        nCtx.fillStyle = grad;
        nCtx.beginPath();
        nCtx.ellipse(n.x, n.y, n.rx, n.ry, Math.random() * Math.PI, 0, Math.PI * 2);
        nCtx.fill();
      }
    };
    drawNebula();

    // Spawn shooting star occasionally
    const maybeSpawnShootingStar = () => {
      if (Math.random() < 0.003 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.4,
          len: Math.random() * 80 + 40,
          speed: Math.random() * 4 + 3,
          angle: Math.PI * 0.2 + Math.random() * 0.3,
          opacity: 1,
          life: 0,
          maxLife: Math.random() * 40 + 30,
        });
      }
    };

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw nebulae
      ctx.drawImage(nebulaCanvas, 0, 0);

      // Draw stars
      for (const star of stars) {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.phase) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
        ctx.fill();
        // Glow for bright stars
        if (star.r > 1.2) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${star.color}, ${alpha * 0.08})`;
          ctx.fill();
        }
      }

      // Shooting stars
      maybeSpawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life++;
        s.opacity = 1 - (s.life / s.maxLife);
        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1);
          continue;
        }
        const tailX = s.x - Math.cos(s.angle) * s.len;
        const tailY = s.y - Math.sin(s.angle) * s.len;
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(255,255,255,${s.opacity * 0.8})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        // Head glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
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

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
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

export default function Home() {
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
    const savedYmid = localStorage.getItem("user_id");
    if (savedYmid && savedYmid.trim() !== "") {
      setYmidConfirmed(true);
      setYmidInput(savedYmid);
    } else {
      setShowYmidDialog(true);
    }
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
        const adTimeout = setTimeout(() => { if (!adDone) { adDone = true; reject(new Error("Timeout")); } }, 30000);
        const onSuccess = () => {
          if (adDone) return;
          adDone = true;
          clearTimeout(adTimeout);
          sendPostback("impression");
          setTimeout(() => { const uid = localStorage.getItem("user_id"); if (uid) fetchStats(uid); }, 500);
          resolve();
        };
        const onClosed = () => { if (!adDone) { adDone = true; clearTimeout(adTimeout); resolve(); } };
        try {
          const sdkResult = showAd({ ymid: userId, requestVar: userEmail, onComplete: onSuccess, onClose: onClosed });
          if (sdkResult && typeof sdkResult.then === "function") {
            sdkResult.then(() => onSuccess()).catch((err: any) => { if (!adDone) { adDone = true; clearTimeout(adTimeout); reject(err); } });
          }
        } catch {
          try {
            showAd().then(() => onSuccess()).catch((err: any) => { if (!adDone) { adDone = true; clearTimeout(adTimeout); reject(err); } });
          } catch (e2) { if (!adDone) { adDone = true; clearTimeout(adTimeout); reject(e2); } }
        }
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
          <svg style="flex-shrink:0;min-width:18px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);">Impressões</span>
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
          <svg style="flex-shrink:0;min-width:18px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
          <span style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);">Cliques</span>
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
        // Timer zerou - reiniciar o site
        console.log('[COUNTDOWN] Timer zerou - reiniciando site');
        window.location.reload();
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

      {/* Layout principal — fundo estrelado estilo Young Money */}
      <div className="min-h-screen flex items-center justify-center relative" style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #0d1225 40%, #0a0f1d 100%)' }}>
        <StarryBackground />
        <div className="px-4 py-6 max-w-lg w-full space-y-6 relative" style={{ zIndex: 1 }}>


          {/* Card de Progresso — iOS grouped card */}
          <div className="rounded-xl bg-card shadow-[0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">

            {/* Impressões row */}
            <div className="px-4 pt-4 pb-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[7px] bg-[#FF9500] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
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
            <div className="h-px bg-white/[0.08] ml-[58px]" />

            {/* Cliques row */}
            <div className="px-4 pt-3.5 pb-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-[7px] bg-[#34C759] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                  </div>
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

          {/* Botão principal — iOS style */}
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

          {/* Indicador de tela atual */}
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${currentScreen === "home" ? "bg-[#34C759]" : "bg-[#FF9500] animate-pulse"}`} />
            <span className="text-[12px] text-muted-foreground tracking-wide uppercase">
              {currentScreen === "home" ? "Tela Inicial" : "Assistindo Anúncio"}
            </span>
          </div>

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
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
