
import React, { useState } from 'react';
import { World } from '../types';
import { suggestWorlds, generateWorldConfig } from '../services/geminiService';
import { Globe, Loader2, Check, RefreshCw, ChevronLeft, PenTool, Zap, BookOpen, Skull, Map, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  onWorldCreated: (world: World) => void;
}

type Step = 'GENRE_SELECT' | 'WORLD_LIST' | 'CUSTOM_FORM' | 'PREVIEW';
type Difficulty = 'Thường' | 'Khó' | 'Siêu Khó (Ác Mộng)' | 'Địa Ngục';

const GENRES = [
  "Tu Tiên / Tiên Hiệp",
  "Võ Hiệp",
  "Fantasy",
  "Mạt Thế / Sinh Tồn",
  "Khoa Học Viễn Tưởng",
  "Dị Giới / Xuyên Không",
  "VRMMO / Game",
  "Tự Do / Khác"
];

const DIFFICULTIES: Difficulty[] = ['Thường', 'Khó', 'Siêu Khó (Ác Mộng)', 'Địa Ngục'];

const WorldCreator: React.FC<Props> = ({ onWorldCreated }) => {
  const [step, setStep] = useState<Step>('GENRE_SELECT');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('Thường');
  
  // Data for lists and forms
  const [suggestedWorlds, setSuggestedWorlds] = useState<Partial<World>[]>([]);
  // Only using 'name' for custom form now, keeping object structure simpler
  const [customForm, setCustomForm] = useState({ name: '' });
  
  // The final world object for preview
  const [previewWorld, setPreviewWorld] = useState<World | null>(null);

  // --- HANDLERS ---

  const handleSelectGenre = async (genre: string) => {
    setSelectedGenre(genre);
    if (genre === "Tự Do / Khác") {
      setStep('CUSTOM_FORM');
    } else {
      setLoading(true);
      try {
        const suggestions = await suggestWorlds(genre);
        setSuggestedWorlds(suggestions);
        setStep('WORLD_LIST');
      } catch (e) {
        alert("Không thể tải gợi ý thế giới.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelectPremade = async (world: Partial<World>) => {
    setLoading(true);
    try {
      const fullWorld = await generateWorldConfig({
        genre: selectedGenre,
        name: world.name,
        description: world.description,
        isCustom: false
      });
      setPreviewWorld(fullWorld);
      setStep('PREVIEW');
    } catch (e) {
      alert("Lỗi tạo hồ sơ thế giới.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customForm.name.trim()) return;
    setLoading(true);
    try {
      const fullWorld = await generateWorldConfig({
        genre: selectedGenre === "Tự Do / Khác" ? "Tự Do" : selectedGenre,
        name: customForm.name,
        isCustom: true
      });
      setPreviewWorld(fullWorld);
      setStep('PREVIEW');
    } catch (e) {
      alert("Lỗi phân tích thế giới.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (previewWorld) {
      onWorldCreated({
        ...previewWorld,
        difficultyMode: selectedDifficulty
      });
    }
  };

  // --- RENDER HELPERS ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="animate-pulse">Đang kiến tạo thế giới...</p>
      </div>
    );
  }

  // STEP 1: GENRE SELECTION
  if (step === 'GENRE_SELECT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <Globe className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Chọn Thể Loại</h1>
          <p className="text-slate-400">Bước đầu tiên để định hình định mệnh của bạn.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => handleSelectGenre(genre)}
              className="p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 hover:shadow-lg text-left group"
            >
              <span className="font-bold text-lg text-slate-200 group-hover:text-blue-400 block mb-2">{genre}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // STEP 2: WORLD LIST (SUGGESTIONS)
  if (step === 'WORLD_LIST') {
    return (
      <div className="flex flex-col items-center min-h-screen p-6 max-w-4xl mx-auto w-full">
        <div className="w-full flex items-center justify-between mb-8">
          <button onClick={() => setStep('GENRE_SELECT')} className="flex items-center text-slate-400 hover:text-white">
            <ChevronLeft /> Quay lại
          </button>
          <h2 className="text-2xl font-bold text-blue-400">{selectedGenre}</h2>
          <div className="w-20"></div> {/* Spacer */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
          {suggestedWorlds.map((world, idx) => (
            <div key={idx} className="bg-slate-800 border border-slate-700 p-6 rounded-xl flex flex-col hover:border-blue-500 transition-colors">
              <h3 className="text-xl font-bold text-white mb-2">{world.name}</h3>
              <p className="text-sm text-slate-400 mb-4 flex-grow">{world.description}</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 uppercase">Độ khó</span>
                  <span className="text-red-400 font-bold">{world.dangerLevel}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 uppercase">Phong cách</span>
                  <span className="text-purple-400 font-bold">{world.style}</span>
                </div>
              </div>
              <button 
                onClick={() => handleSelectPremade(world)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
              >
                Chọn Thế Giới Này
              </button>
            </div>
          ))}
        </div>

        <div className="w-full border-t border-slate-800 pt-8 text-center">
          <p className="text-slate-400 mb-4">Không thích các gợi ý trên?</p>
          <button 
            onClick={() => setStep('CUSTOM_FORM')}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 mx-auto"
          >
            <PenTool size={18} /> Tự Thiết Kế Thế Giới Mới
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: CUSTOM FORM (Simplified)
  if (step === 'CUSTOM_FORM') {
    return (
      <div className="flex flex-col items-center min-h-screen p-6 max-w-2xl mx-auto w-full pt-12">
        <button onClick={() => setStep('GENRE_SELECT')} className="self-start mb-6 flex items-center text-slate-400 hover:text-white">
           <ChevronLeft /> Quay lại
        </button>
        <h1 className="text-3xl font-bold text-white mb-2">Nhập Tên Thế Giới</h1>
        <p className="text-slate-400 mb-8 text-center">
          Nhập tên một bộ truyện, phim, game yêu thích hoặc một cái tên bạn tự nghĩ ra. <br/>
          AI sẽ phân tích và kiến tạo toàn bộ thế giới đó cho bạn.
        </p>
        
        <div className="w-full space-y-4 bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Tên Thế Giới / Tác Phẩm</label>
            <input 
              className="w-full p-4 rounded-lg bg-slate-900 border border-slate-700 text-white text-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-600"
              placeholder="Ví dụ: Đấu Phá Thương Khung, One Piece, Cyberpunk 2077..."
              value={customForm.name}
              onChange={e => setCustomForm({...customForm, name: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              autoFocus
            />
          </div>
          
          <button 
            onClick={handleCustomSubmit}
            disabled={!customForm.name.trim()}
            className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={20} /> Phân Tích & Tái Hiện
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: PREVIEW (PROFILE) & DIFFICULTY SELECTION
  if (step === 'PREVIEW' && previewWorld) {
    return (
      <div className="flex flex-col items-center min-h-screen p-4 max-w-3xl mx-auto w-full pb-10">
        <h1 className="text-2xl text-slate-400 uppercase tracking-widest mb-6 mt-4">Hồ Sơ Thế Giới</h1>
        
        <div className="w-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="bg-slate-800 p-6 border-b border-slate-700">
            <h2 className="text-3xl font-serif font-bold text-blue-400 mb-2">{previewWorld.name}</h2>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 border border-blue-800 rounded text-xs uppercase font-bold tracking-wider">
                {previewWorld.genre}
              </span>
              <span className="px-2 py-1 bg-red-900/30 text-red-300 border border-red-800 rounded text-xs uppercase font-bold tracking-wider">
                {previewWorld.dangerLevel || "Không xác định"}
              </span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-8">
            
            <section>
              <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                <BookOpen size={16} /> Tổng Quan
              </h3>
              <p className="text-slate-200 leading-relaxed text-lg">{previewWorld.description}</p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-slate-800/50 p-4 rounded border border-slate-800">
                <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Map size={16} /> Cấu Trúc & Xã Hội
                </h3>
                <p className="text-slate-300 text-sm whitespace-pre-line">{previewWorld.structure}</p>
              </section>
              <section className="bg-slate-800/50 p-4 rounded border border-slate-800">
                 <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Zap size={16} /> Luật Sức Mạnh
                </h3>
                <p className="text-slate-300 text-sm whitespace-pre-line">{previewWorld.rules}</p>
              </section>
            </div>

            <section className="bg-yellow-900/10 p-4 rounded border border-yellow-900/30">
               <h3 className="text-yellow-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                 <AlertTriangle size={16} /> Nguy Cơ & Cơ Hội
               </h3>
               <p className="text-yellow-200/80 text-sm whitespace-pre-line">{previewWorld.risksAndOpportunities || "Không có dữ liệu đặc biệt."}</p>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <span className="block text-xs text-slate-500 uppercase mb-1">Tỷ lệ tử vong (1 mạng)</span>
                <div className="text-red-500 font-bold flex items-center gap-2">
                  <Skull size={18} /> {previewWorld.deathRate || "Cao"}
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <span className="block text-xs text-slate-500 uppercase mb-1">Phong cách</span>
                <div className="text-purple-400 font-bold">
                  {previewWorld.style || "Đa dạng"}
                </div>
              </div>
            </div>

            <section>
              <h3 className="text-slate-500 text-xs font-bold uppercase mb-2">Hệ thống chỉ số</h3>
              <div className="flex flex-wrap gap-2">
                {(previewWorld.statSystem || []).map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-600 text-slate-300 rounded-full text-xs font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </section>
            
            {previewWorld.gameplayFeatures && (
              <section className="bg-blue-900/10 p-4 rounded border border-blue-900/30">
                 <h3 className="text-blue-400 text-xs font-bold uppercase mb-2">Đặc thù Gameplay</h3>
                 <p className="text-blue-200 text-sm italic">{previewWorld.gameplayFeatures}</p>
              </section>
            )}

            {/* DIFFICULTY SELECTOR */}
            <section className="border-t border-slate-700 pt-6">
               <h3 className="text-red-400 text-lg font-bold uppercase mb-4 text-center">
                 Chọn Độ Khó Game
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 {DIFFICULTIES.map((diff) => (
                   <button
                     key={diff}
                     onClick={() => setSelectedDifficulty(diff)}
                     className={`p-3 rounded border text-sm font-bold transition-all
                       ${selectedDifficulty === diff 
                          ? 'bg-red-900 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                       }`}
                   >
                     {diff}
                   </button>
                 ))}
               </div>
               <p className="text-center text-xs text-slate-500 mt-2 italic">
                 {selectedDifficulty === 'Địa Ngục' ? "Cảnh báo: Kẻ địch cực kỳ thông minh và thù dai. Mọi sai lầm đều trả giá đắt." : 
                  selectedDifficulty.includes('Siêu Khó') ? "Kẻ địch mạnh hơn bạn. Cơ duyên hiếm." :
                  selectedDifficulty === 'Khó' ? "Thử thách cao hơn trung bình." : "Trải nghiệm cân bằng."}
               </p>
            </section>

          </div>

          {/* Footer Actions */}
          <div className="bg-slate-800 p-4 border-t border-slate-700 flex gap-4">
            <button
              onClick={() => setStep(selectedGenre === "Tự Do / Khác" ? 'CUSTOM_FORM' : 'WORLD_LIST')}
              className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> Chọn Lại
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
            >
              <Check size={20} /> XÁC NHẬN & BẮT ĐẦU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default WorldCreator;
