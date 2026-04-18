import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';
import { Engine } from './Engine';
import { Renderer } from './Renderer';
import { GameState } from './types';
import { ArrowLeft, ArrowRight, ArrowUp, Zap, Shield, Maximize, RotateCw } from 'lucide-react';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    
    useEffect(() => {
        const check = () => {
            setIsMobile(window.innerWidth < 1024);
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return { isMobile, isLandscape };
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [playerInfo, setPlayerInfo] = useState({ stamina: 100, maxStamina: 100 });
  const { isMobile, isLandscape } = useIsMobile();

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const engine = new Engine();
    const renderer = new Renderer(ctx, engine);

    engineRef.current = engine;
    rendererRef.current = renderer;

    engine.onScoreUpdate = (newScore) => setScore({ ...newScore });
    engine.onStateChange = (newState) => setGameState(newState);

    let animationFrameId: number;

    const loop = () => {
      engine.update();
      renderer.draw();
      
      // Update UI info
      setPlayerInfo({
          stamina: engine.player.stamina,
          maxStamina: engine.player.maxStamina
      });
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
        engine.handleKeyDown(e.key);
        if (e.key.toLowerCase() === 'r' && engine.state === 'GAME_OVER') {
            engine.reset();
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => engine.handleKeyUp(e.key);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleStart = () => {
    engineRef.current?.start();
  };

  const handleTouch = (key: string, pressed: boolean) => {
    engineRef.current?.setKeyState(key, pressed);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
  };

  // Improved scaling with landscape awareness
  const getScale = () => {
    if (!containerRef.current) return 1;
    const { clientWidth, clientHeight } = containerRef.current;
    
    const scaleX = clientWidth / CANVAS_WIDTH;
    const scaleY = clientHeight / CANVAS_HEIGHT;
    
    return Math.min(scaleX, scaleY, 1);
  };

  const MobileControls = () => {
    const isSpikeReady = playerInfo.stamina >= 25;
    const isSlideReady = playerInfo.stamina >= 30;
    const isJumpReady = playerInfo.stamina >= 15;

    return (
        <div className={`fixed inset-x-6 z-[60] flex justify-between items-end pointer-events-none ${isLandscape ? 'bottom-4' : 'bottom-10'}`}>
            {/* Movement d-pad style */}
            <div className="flex gap-2 pointer-events-auto">
                <motion.button 
                    whileTap={{ scale: 0.9, backgroundColor: 'rgba(59,130,246,0.5)' }}
                    onPointerDown={() => handleTouch('arrowleft', true)}
                    onPointerUp={() => handleTouch('arrowleft', false)}
                    onPointerLeave={() => handleTouch('arrowleft', false)}
                    className="w-20 h-20 bg-slate-900/40 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl"
                >
                    <ArrowLeft size={36} className="text-white/80" />
                </motion.button>
                <motion.button 
                    whileTap={{ scale: 0.9, backgroundColor: 'rgba(59,130,246,0.5)' }}
                    onPointerDown={() => handleTouch('arrowright', true)}
                    onPointerUp={() => handleTouch('arrowright', false)}
                    onPointerLeave={() => handleTouch('arrowright', false)}
                    className="w-20 h-20 bg-slate-900/40 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl"
                >
                    <ArrowRight size={36} className="text-white/80" />
                </motion.button>
            </div>

            {/* Action buttons */}
            <div className={`flex pointer-events-auto items-end ${isLandscape ? 'gap-6' : 'flex-col gap-4'}`}>
                <motion.button 
                    whileTap={isSlideReady ? { scale: 0.85, backgroundColor: 'rgba(34,197,94,0.5)' } : {}}
                    onPointerDown={() => handleTouch('shift', true)}
                    onPointerUp={() => handleTouch('shift', false)}
                    onPointerLeave={() => handleTouch('shift', false)}
                    className={`w-16 h-16 rounded-full flex items-center justify-center border shadow-xl relative transition-all duration-300 ${isSlideReady ? 'bg-slate-900/40 backdrop-blur-xl border-white/10' : 'bg-red-500/10 border-red-500/20 grayscale'}`}
                >
                    <Shield size={28} className={isSlideReady ? 'text-green-500' : 'text-red-500/40'} />
                    <span className={`absolute -top-1 px-2 border rounded-full text-[8px] font-black uppercase transition-colors ${isSlideReady ? 'bg-green-500 text-white border-green-400' : 'bg-red-950 text-red-500 border-red-900'}`}>
                        {isSlideReady ? 'Slide' : 'Low'}
                    </span>
                </motion.button>
                
                <div className="flex gap-4 items-end">
                    <motion.button 
                        whileTap={isSpikeReady ? { scale: 0.9 } : {}}
                        onPointerDown={() => handleTouch(' ', true)}
                        onPointerUp={() => handleTouch(' ', false)}
                        onPointerLeave={() => handleTouch(' ', false)}
                        className={`w-28 h-28 rounded-full flex items-center justify-center font-black transition-all duration-300 relative overflow-hidden group ${isSpikeReady ? 'bg-gradient-to-tr from-yellow-600 to-yellow-300 shadow-[0_8px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[8px]' : 'bg-slate-900/80 border-2 border-slate-800 grayscale cursor-not-allowed opacity-50'}`}
                    >
                        {isSpikeReady && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_white_0%,_transparent_100%)] opacity-0 group-active:opacity-30 transition-opacity" />
                        )}
                        <div className="flex flex-col items-center">
                            <Zap size={42} fill={isSpikeReady ? 'black' : 'rgba(255,255,255,0.1)'} className={isSpikeReady ? 'text-black' : 'text-white/10'} />
                            <span className={`text-[12px] uppercase tracking-tighter ${isSpikeReady ? 'text-black' : 'text-white/20'}`}>Spike</span>
                        </div>
                    </motion.button>
                    
                    <motion.button 
                        whileTap={isJumpReady ? { scale: 0.9 } : {}}
                        onPointerDown={() => handleTouch('arrowup', true)}
                        onPointerUp={() => handleTouch('arrowup', false)}
                        onPointerLeave={() => handleTouch('arrowup', false)}
                        className={`w-20 h-20 rounded-3xl flex items-center justify-center font-black transition-all duration-300 ${isJumpReady ? 'bg-gradient-to-tr from-blue-700 to-blue-400 shadow-[0_6px_0_rgb(29,78,216)] active:shadow-none active:translate-y-[6px]' : 'bg-slate-900/80 border-2 border-slate-800 grayscale cursor-not-allowed opacity-50'}`}
                    >
                        <ArrowUp size={36} className={isJumpReady ? 'text-white' : 'text-white/20'} />
                    </motion.button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-hidden ${isLandscape && isMobile ? 'p-1' : 'p-4 lg:p-0'}`}>
      
      {/* Perspective Grid Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      {isMobile && !isLandscape && (
          <div className="fixed top-4 flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/50 backdrop-blur z-[70]">
              <RotateCw size={14} className="animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Rotate for landscape</span>
          </div>
      )}

      <div 
        ref={containerRef}
        className={`relative group overflow-hidden rounded-2xl transition-all duration-700 ${isMobile ? 'w-full' : 'w-[800px] border border-slate-800 shadow-2xl shadow-blue-900/20'}`}
        style={{ 
            aspectRatio: isMobile ? 'none' : `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
            height: isMobile ? (isLandscape ? '100vh' : 'auto') : CANVAS_HEIGHT 
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
            <div style={{ 
                transform: isMobile ? `scale(${getScale()})` : 'none',
                transformOrigin: 'center',
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                flexShrink: 0
            }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="block rounded-lg"
                />

                <AnimatePresence>
                    {gameState === 'MENU' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl z-50 px-6"
                      >
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", damping: 12 }}
                          className="text-center"
                        >
                          <h1 className="text-7xl md:text-9xl font-black mb-1 tracking-tighter italic leading-none">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-white to-yellow-400">SPIKE</span>
                            <br />
                            <span className="text-white">VOLLEY</span>
                          </h1>
                          <p className="text-slate-600 uppercase tracking-[1em] text-[8px] md:text-[10px] font-black mb-16 ml-[1em]">Power Spike Edition</p>
                        </motion.div>
                        
                        <div className="flex flex-col items-center gap-12">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleStart}
                              className="group relative px-20 py-6 bg-white text-black font-black text-2xl rounded-2xl shadow-[0_10px_0_rgb(200,200,200)] active:shadow-none active:translate-y-[5px] transition-all"
                            >
                              START MATCH
                            </motion.button>
                            
                            {!isMobile && (
                                <div className="flex gap-10 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 border border-slate-700 rounded flex items-center justify-center text-slate-300">W</div>
                                        <span>Jump</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 border border-slate-700 rounded flex items-center justify-center text-slate-300">S</div>
                                        <span>Slide</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-24 h-10 border border-slate-700 rounded flex items-center justify-center text-slate-300 text-xs">SPACE</div>
                                        <span>Spike</span>
                                    </div>
                                </div>
                            )}
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>

        {/* HUD Overlay for Scoring & Visuals */}
        {gameState === 'SLOW_MO' && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 pointer-events-none border-[10px] border-red-600/20 z-40 bg-red-600/5" 
            />
        )}
      </div>

      {isMobile && (gameState === 'PLAYING' || gameState === 'SERVING' || gameState === 'SLOW_MO' || gameState === 'SCORED') && <MobileControls />}

      <div className={`fixed top-4 right-4 z-[80] flex gap-2`}>
          {isMobile && (
              <button 
                onClick={toggleFullScreen}
                className="p-3 bg-slate-900/80 backdrop-blur rounded-full border border-white/10 text-white active:scale-90"
              >
                  <Maximize size={20} />
              </button>
          )}
      </div>

      {/* Modern Score Display & HUD */}
      <AnimatePresence>
        {gameState !== 'MENU' && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4 ${isLandscape && isMobile ? 'scale-75 origin-top' : ''}`}
          >
            {/* Main Score Glass Card */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:px-10 flex items-center gap-10 shadow-2xl relative overflow-hidden group">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
                
                <div className="flex items-center gap-5">
                    <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Zap size={isMobile ? 20 : 28} className="text-blue-500 fill-blue-500/20" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] leading-none mb-1">Player</span>
                        <div className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none">{score.player.toString().padStart(2, '0')}</div>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Battle</div>
                    <div className="flex gap-0.5">
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className={`w-[2px] md:w-1 h-3 rounded-full transition-colors duration-500 ${i < score.player ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                        ))}
                        <div className="w-[1px] md:w-1 h-6 mx-1 md:mx-2 bg-white/10 rounded-full" />
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className={`w-[2px] md:w-1 h-3 rounded-full transition-colors duration-500 ${i < score.ai ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em] leading-none mb-1">Rival</span>
                        <div className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none">{score.ai.toString().padStart(2, '0')}</div>
                    </div>
                    <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shadow-lg shadow-red-600/20">
                        <Zap size={isMobile ? 20 : 28} className="text-red-500 fill-red-500/20 rotate-180" />
                    </div>
                </div>
            </div>

            {/* Stamina & Status Bar */}
            <div className="w-full flex justify-center mt-[-10px] relative z-10">
                <div className="w-64 h-3 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 p-0.5 overflow-hidden shadow-xl">
                    <motion.div 
                        initial={{ width: '100%' }}
                        animate={{ 
                            width: `${(playerInfo.stamina / playerInfo.maxStamina) * 100}%`,
                            backgroundColor: playerInfo.stamina < 30 ? '#ef4444' : '#3b82f6'
                        }}
                        className="h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-colors duration-300" 
                    />
                </div>
                {/* Stamina Label */}
                <div className="absolute -bottom-4 inset-x-0 flex justify-center pointer-events-none">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">Stamina Flow</span>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
