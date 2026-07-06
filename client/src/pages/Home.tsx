/*
 * HOME - Tela de Seleção de Jogos
 * 
 * Exibe os 3 jogos disponíveis (Roleta/Spin, Candy, Raspadinha).
 * Ao clicar em um jogo, exige o YMID via diálogo (ou usa o YMID já salvo/no link).
 * O YMID é passado como parâmetro na URL do jogo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

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

// ===== GAME CARDS CONFIG =====
const GAMES = [
  {
    id: "spin",
    label: "Roleta",
    description: "Gire a roleta e ganhe recompensas!",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2v10l7 5" />
        <path d="M12 12l-5 7" />
      </svg>
    ),
    color: "#FF9500",
    path: "/spin",
  },
  {
    id: "candy",
    label: "Candy",
    description: "Jogo Candy com doces e prêmios!",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF2D55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 8V2" />
        <path d="M12 16v6" />
        <path d="M8 12H2" />
        <path d="M16 12h6" />
        <path d="M9.17 9.17L4.93 4.93" />
        <path d="M14.83 14.83l4.24 4.24" />
        <path d="M9.17 14.83l-4.24 4.24" />
        <path d="M14.83 9.17l4.24-4.24" />
      </svg>
    ),
    color: "#FF2D55",
    path: "/candy",
  },
  {
    id: "scratch",
    label: "Raspadinha",
    description: "Raspe e descubra seu prêmio!",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 7l10 10" />
        <path d="M7 12l5 5" />
        <path d="M12 7l5 5" />
      </svg>
    ),
    color: "#34C759",
    path: "/scratch",
  },
];

// ===== YMID DIALOG =====
function YmidDialog({
  open,
  onClose,
  onConfirm,
  savedYmid,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (ymid: string) => void;
  savedYmid: string;
}) {
  const [ymidInput, setYmidInput] = useState(savedYmid);

  useEffect(() => {
    if (open) {
      setYmidInput(savedYmid);
    }
  }, [open, savedYmid]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-2xl max-w-sm w-full shadow-2xl border border-white/10 overflow-hidden p-6">
        <h2 className="text-white font-bold text-xl mb-2 text-center">Digite seu YMID</h2>
        <p className="text-white/60 text-sm text-center mb-6">
          Informe seu YMID para continuar. Caso já tenha um YMID salvo, ele aparecerá abaixo.
        </p>

        <input
          type="text"
          value={ymidInput}
          onChange={(e) => setYmidInput(e.target.value)}
          placeholder="Ex: navigation90855924"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          autoFocus
        />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium text-sm transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const trimmed = ymidInput.trim();
              if (trimmed) {
                onConfirm(trimmed);
              }
            }}
            disabled={!ymidInput.trim()}
            className="flex-1 h-[44px] rounded-xl bg-[#007AFF] hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function Home() {
  const [, navigate] = useLocation();
  const [showYmidDialog, setShowYmidDialog] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  // Pegar YMID do link ou localStorage
  const getSavedYmid = useCallback((): string => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const fromUrl = params.get('ymid') || hashParams.get('ymid');
    if (fromUrl) {
      localStorage.setItem('monetag_ymid_global', fromUrl);
      return fromUrl;
    }
    return localStorage.getItem('monetag_ymid_global') || '';
  }, []);

  const handleGameClick = (gameId: string) => {
    setSelectedGame(gameId);
    const savedYmid = getSavedYmid();
    if (savedYmid) {
      // Já tem YMID, navegar direto
      navigateToGame(gameId, savedYmid);
    } else {
      // Pedir YMID
      setShowYmidDialog(true);
    }
  };

  const navigateToGame = (gameId: string, ymid: string) => {
    localStorage.setItem('monetag_ymid_global', ymid);
    // Salvar também no formato que o GamePage espera
    localStorage.setItem(`monetag_ymid_${gameId}`, ymid);
    const game = GAMES.find(g => g.id === gameId);
    if (game) {
      navigate(`${game.path}?ymid=${encodeURIComponent(ymid)}`);
    }
  };

  const handleYmidConfirm = (ymid: string) => {
    setShowYmidDialog(false);
    if (selectedGame) {
      navigateToGame(selectedGame, ymid);
    }
  };

  return (
    <>
      <StarryBackground />

      <YmidDialog
        open={showYmidDialog}
        onClose={() => setShowYmidDialog(false)}
        onConfirm={handleYmidConfirm}
        savedYmid={getSavedYmid()}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-white font-bold text-2xl mb-2">Escolha seu Jogo</h1>
            <p className="text-white/50 text-sm">Selecione um jogo para começar a ganhar recompensas</p>
          </div>

          {/* Game Cards */}
          <div className="space-y-4">
            {GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.98] group"
              >
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${game.color}15` }}
                >
                  {game.icon}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-white font-bold text-lg">{game.label}</h3>
                  <p className="text-white/50 text-sm mt-0.5">{game.description}</p>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/30 group-hover:text-white/60 transition-colors"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>

          {/* Footer info */}
          <div className="text-center pt-4">
            <p className="text-white/30 text-xs">
              {getSavedYmid() ? (
                <>YMID: <span className="text-white/50">{getSavedYmid()}</span></>
              ) : (
                "Seu YMID será solicitado ao selecionar um jogo"
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
