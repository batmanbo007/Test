
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GameState, GamePhase, World, Character } from './types';
import WorldCreator from './components/WorldCreator';
import CharacterCreator from './components/CharacterCreator';
import GameInterface from './components/GameInterface';
import { Play, Upload, Zap, Trash2, Clock, User } from 'lucide-react';

const AUTO_SAVE_KEY = 'rpg_engine_auto_save_v1';

const INITIAL_STATE: GameState = {
  phase: GamePhase.INIT,
  turnCount: 0,
  world: null,
  character: null,
  history: [],
  npcs: [],
  troops: [],
  lastNarrative: '',
  customRules: [],
  suggestedActions: [],
  isLoading: false,
  error: null,
  summary: '',
  playerNotes: []
};

interface AutoSaveMeta {
  charName: string;
  turn: number;
  level: string;
  timestamp: string;
}

// --- HELPER: SANITIZE STATE ---
// Ensures all arrays are initialized to prevent "cannot read property map of undefined"
const sanitizeGameState = (state: any): GameState => {
  if (!state) return INITIAL_STATE;

  if (!state.npcs) state.npcs = [];
  if (!state.troops) state.troops = [];
  if (!state.history) state.history = [];
  if (!state.customRules) state.customRules = [];
  if (!state.suggestedActions) state.suggestedActions = [];
  if (!state.playerNotes) state.playerNotes = [];
  
  if (state.character) {
       const c = state.character;
       if (!c.inventory) c.inventory = [];
       if (!c.skills) c.skills = [];
       if (!c.stats) c.stats = [];
       if (!c.resistances) c.resistances = [];
       if (!c.talents) c.talents = [];
       if (!c.bloodlines) c.bloodlines = [];
       if (!c.divineBodies) c.divineBodies = [];
       if (!c.activeStatuses) c.activeStatuses = [];
       if (!c.achievements) c.achievements = [];
       if (!c.quests) c.quests = [];
  }
  return state as GameState;
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [autoSaveMeta, setAutoSaveMeta] = useState<AutoSaveMeta | null>(null);

  // Helper to load meta from localStorage to display on Main Menu
  const checkAutoSave = useCallback(() => {
    try {
      const savedData = localStorage.getItem(AUTO_SAVE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Valid auto-save must have character data
        if (parsed && parsed.character) {
          setAutoSaveMeta({
             charName: parsed.character.name,
             turn: parsed.turnCount || 0,
             level: parsed.character.levelName || `Lv.${parsed.character.level}`,
             timestamp: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
          });
          return;
        }
      }
      setAutoSaveMeta(null);
    } catch (e) {
      console.error("Lỗi đọc Auto Save:", e);
      setAutoSaveMeta(null);
    }
  }, []);

  // 1. Check AutoSave when mounting or returning to INIT screen
  useEffect(() => {
    if (gameState.phase === GamePhase.INIT) {
      checkAutoSave();
    }
  }, [gameState.phase, checkAutoSave]);

  // 2. Auto-save Worker: Trigger save on every gameState change during PLAYING
  useEffect(() => {
    if (gameState.phase === GamePhase.PLAYING) {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(gameState));
        } catch (e) {
          console.error("Auto Save Failed (Storage Full?):", e);
        }
      }, 500); // 500ms debounce to prevent thrashing
      return () => clearTimeout(timeoutId);
    }
  }, [gameState]);

  const startNewGame = () => {
    setGameState({ ...INITIAL_STATE, phase: GamePhase.WORLD_CREATION });
  };

  const resetGame = () => {
    // Force save current progress before exiting to menu
    if (gameState.phase === GamePhase.PLAYING) {
       try {
         localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(gameState));
       } catch(e) { console.error("Force save failed", e); }
    }
    setGameState(INITIAL_STATE);
  };

  const handleContinueAutoSave = () => {
    try {
      const savedData = localStorage.getItem(AUTO_SAVE_KEY);
      if (!savedData) return;
      
      let loadedState = JSON.parse(savedData);
      
      if (!loadedState.world || !loadedState.character) {
        alert("File Auto Save bị lỗi dữ liệu.");
        return;
      }
      
      // Sanitize loaded data
      loadedState = sanitizeGameState(loadedState);
      
      // Ensure phase is set to PLAYING so the game resumes correctly
      setGameState({ ...loadedState, phase: GamePhase.PLAYING });
    } catch (err) {
      alert("Không thể tải bản lưu tự động.");
      console.error(err);
    }
  };

  const handleDeleteAutoSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Xóa bản lưu tự động này? Hành động không thể hoàn tác.")) {
      localStorage.removeItem(AUTO_SAVE_KEY);
      setAutoSaveMeta(null);
    }
  };

  const handleLoadGame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let loadedState = JSON.parse(text);
        
        if (!loadedState.world || !loadedState.character) {
          alert("File Save không hợp lệ: Thiếu dữ liệu thế giới hoặc nhân vật.");
          return;
        }

        // Sanitize loaded data
        loadedState = sanitizeGameState(loadedState);

        // CRITICAL: Force phase to PLAYING. 
        // Even if the save file was exported in GAME_OVER or INIT, loading it implies resuming play.
        const activeState: GameState = { 
            ...loadedState, 
            phase: GamePhase.PLAYING,
            isLoading: false,
            error: null
        };
        
        // IMMEDIATE AUTO-SAVE UPDATE
        try {
            localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(activeState));
        } catch (e) {
            console.error("Immediate auto-save update failed", e);
        }

        setGameState(activeState);
      } catch (err) {
        console.error(err);
        alert("Lỗi đọc file save. Vui lòng kiểm tra định dạng JSON.");
      } finally {
        // Reset input so user can reload the same file if needed
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWorldCreated = (world: World) => {
    setGameState(prev => ({
      ...prev,
      world,
      phase: GamePhase.CHARACTER_CREATION
    }));
  };

  const handleCharacterCreated = (character: Character) => {
    const introNarrative = `Chào mừng ${character.name} đến với thế giới ${gameState.world?.name}. \n\n${gameState.world?.description}\n\nBạn đang đứng ở vạch xuất phát của định mệnh. Hãy nhìn xung quanh, bạn thấy gì và dự định làm gì đầu tiên?`;
    
    // Create new state first
    const newState: GameState = {
      ...gameState,
      character,
      phase: GamePhase.PLAYING,
      lastNarrative: introNarrative,
      history: [
        {
          id: 'intro',
          turn: 0,
          action: 'Khởi đầu',
          result: 'Bắt đầu hành trình',
          narrative: introNarrative,
          type: 'milestone'
        }
      ]
    };
    
    // Ensure new state is sanitized (though creator should produce valid state)
    const sanitizedState = sanitizeGameState(newState);

    setGameState(sanitizedState);
    
    // Force immediate save to initialize Auto Save slot
    try {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(sanitizedState));
    } catch(e) {}
  };

  const handleUpdateState = (newState: GameState) => {
    setGameState(newState);
  };

  // --- RENDER ---

  if (gameState.phase === GamePhase.INIT) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center relative overflow-hidden">
        {/* Background Ambient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-950 z-0"></div>
        
        <div className="z-10 w-full max-w-sm flex flex-col gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-emerald-400 mb-2 drop-shadow-lg">
              AI RPG ENGINE
            </h1>
            <p className="text-slate-500 text-sm tracking-widest uppercase font-bold">Infinite Adventure v2.5</p>
          </div>

          {/* AUTO SAVE CARD */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl backdrop-blur-sm transition-all hover:border-slate-600">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                <Zap size={12} className={autoSaveMeta ? "text-amber-400" : "text-slate-600"} /> 
                Auto Save
              </span>
              {autoSaveMeta && <span className="text-[10px] text-slate-600 bg-slate-900 px-2 py-0.5 rounded-full">{autoSaveMeta.timestamp}</span>}
            </div>

            {autoSaveMeta ? (
              <div className="space-y-3 animate-fade-in">
                 <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                      {autoSaveMeta.charName.charAt(0)}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                       <div className="font-bold text-slate-200 truncate">{autoSaveMeta.charName}</div>
                       <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="flex items-center gap-0.5"><User size={10} /> {autoSaveMeta.level}</span>
                          <span className="flex items-center gap-0.5"><Clock size={10} /> Lượt {autoSaveMeta.turn}</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={handleContinueAutoSave}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                      <Zap size={18} fill="currentColor" /> TIẾP TỤC
                    </button>
                    <button 
                      onClick={handleDeleteAutoSave}
                      className="p-3 bg-slate-700 hover:bg-red-900/80 text-slate-400 hover:text-red-200 rounded-lg transition-colors border border-slate-600"
                      title="Xóa bản lưu"
                    >
                      <Trash2 size={18} />
                    </button>
                 </div>
              </div>
            ) : (
              <div className="py-6 text-slate-600 italic text-sm border border-dashed border-slate-700 rounded-lg bg-slate-900/30">
                 Trống
              </div>
            )}
          </div>

          <div className="h-px bg-slate-800 w-full my-2"></div>

          <button
            onClick={startNewGame}
            className="w-full py-4 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-xl text-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Play fill="currentColor" size={20} /> BẮT ĐẦU MỚI
          </button>
          
          <label className="w-full py-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-3 transition-colors hover:text-white">
             <Upload size={20} /> TẢI FILE SAVE (JSON)
             <input type="file" accept=".json" onChange={handleLoadGame} className="hidden" />
          </label>
        </div>
        
        <div className="absolute bottom-4 text-[10px] text-slate-600">
           Engine v2.5.6.5 • One Life Mode
        </div>
      </div>
    );
  }

  if (gameState.phase === GamePhase.WORLD_CREATION) {
    return <WorldCreator onWorldCreated={handleWorldCreated} />;
  }

  if (gameState.phase === GamePhase.CHARACTER_CREATION && gameState.world) {
    return <CharacterCreator world={gameState.world} onCharacterCreated={handleCharacterCreated} />;
  }

  if (gameState.phase === GamePhase.PLAYING || gameState.phase === GamePhase.GAME_OVER) {
    return (
      <GameInterface 
        gameState={gameState} 
        updateState={handleUpdateState} 
        resetGame={resetGame}
      />
    );
  }

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500"><Clock className="animate-spin mr-2"/> Đang tải...</div>;
};

export default App;
