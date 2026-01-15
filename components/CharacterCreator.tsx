import React, { useState, useEffect } from 'react';
import { World, Character, Stat, Achievement, InventoryItem, Skill } from '../types';
import { 
  getCharacterCreationOptions, 
  checkSuitability, 
  analyzeClassChoice, 
  generateTalentOptions, 
  balanceCustomTalent,
  generateStartingLoadout,
  generateInitialAchievements
} from '../services/geminiService';
import { User, Shield, Dna, Swords, Loader2, Check, RefreshCw, AlertTriangle, Brain, ChevronRight, ChevronLeft, Save, Palette, Smile, Zap } from 'lucide-react';

interface Props {
  world: World;
  onCharacterCreated: (char: Character) => void;
}

// Stats config
const BASE_STAT_VAL = 5;
const TOTAL_POINTS = 20;
const MAX_TALENTS = 3;

const godTalentNames = ['Vận Mệnh Tuyệt Đối', 'Hệ Thống Thần Cấp'];

const CharacterCreator: React.FC<Props> = ({ world, onCharacterCreated }) => {
  // Wizard State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>({ backgrounds: [], races: [], classes: [] });

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    gender: 'Nam',
    appearance: '',
    personality: '',
    background: '',
    race: '',
    class: '',
    stats: [] as Stat[],
    talents: [] as { name: string; description: string }[]
  });

  // Analysis States
  const [suitabilityMsg, setSuitabilityMsg] = useState<{valid: boolean, msg: string} | null>(null);
  const [classAnalysis, setClassAnalysis] = useState<any>(null);
  const [talentList, setTalentList] = useState<any[]>([]);
  
  // Talent Logic
  const [customTalentInput, setCustomTalentInput] = useState({ name: '', desc: '' });
  const [balancedTalentPreview, setBalancedTalentPreview] = useState<{name: string, description: string} | null>(null);
  
  const [finalLoadout, setFinalLoadout] = useState<any>(null);
  const [initialAchievements, setInitialAchievements] = useState<Achievement[]>([]);

  // Initialize Suggestions & Stats
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const opts = await getCharacterCreationOptions(world);
      setSuggestions(opts || { backgrounds: [], races: [], classes: [] });
      
      // Init stats based on world system or default
      const statNames = world.statSystem && world.statSystem.length > 0 
        ? world.statSystem 
        : ["Sức Mạnh", "Thể Chất", "Nhanh Nhẹn", "Tinh Thần"];
      
      setFormData(prev => ({
        ...prev,
        stats: statNames.map(name => ({ name, value: BASE_STAT_VAL }))
      }));
      setLoading(false);
    };
    init();
  }, [world]);

  // --- HANDLERS ---

  const handleTalentSelect = (talent: { name: string; description: string }) => {
    const isGodTalent = godTalentNames.includes(talent.name);
    const isSelected = formData.talents.some(t => t.name === talent.name);
    
    // If God Talent is clicked
    if (isGodTalent) {
        setFormData(prev => ({
            ...prev,
            talents: isSelected ? [] : [talent]
        }));
        setBalancedTalentPreview(null); // Deselect custom talent preview if user clicks god mode
        return;
    }

    // If a normal talent is clicked
    if (isSelected) {
        // Deselect
        setFormData(prev => ({
            ...prev,
            talents: prev.talents.filter(t => t.name !== talent.name)
        }));
    } else {
        // Select
        // If God Talent is currently active, replace it with this new talent
        const hasGodTalent = formData.talents.some(t => godTalentNames.includes(t.name));
        if (hasGodTalent) {
            setFormData(prev => ({ ...prev, talents: [talent] }));
            return;
        }

        // Add talent if not at max capacity
        if (formData.talents.length < MAX_TALENTS) {
            setFormData(prev => ({
                ...prev,
                talents: [...prev.talents, talent]
            }));
        }
    }
  };

  const handleStatChange = (idx: number, delta: number) => {
    const currentTotal = formData.stats.reduce((acc, s) => acc + (s.value - BASE_STAT_VAL), 0);
    const stat = formData.stats[idx];
    
    if (delta > 0 && currentTotal >= TOTAL_POINTS) return;
    if (delta < 0 && stat.value <= BASE_STAT_VAL) return;

    const newStats = [...formData.stats];
    newStats[idx].value += delta;
    setFormData({ ...formData, stats: newStats });
  };

  const handleCheckSuitability = async (category: string, value: string) => {
    if (!value) return;
    setLoading(true);
    const res = await checkSuitability(world, category, value);
    setSuitabilityMsg({ valid: res.suitable, msg: res.reason });
    setLoading(false);
  };

  const handleAnalyzeClass = async () => {
    if (!formData.class) return;
    setLoading(true);
    const res = await analyzeClassChoice(world, formData.class);
    setClassAnalysis(res);
    setLoading(false);
  };

  const handleRerollTalents = async () => {
    setLoading(true);
    const list = await generateTalentOptions(world);
    setTalentList(list);
    setLoading(false);
  };

  const handleBalanceCustomTalent = async () => {
    if (!customTalentInput.name || !customTalentInput.desc) return;
    setLoading(true);
    const res = await balanceCustomTalent(world, customTalentInput.name, customTalentInput.desc);
    setBalancedTalentPreview(res);
    setLoading(false);
  };

  const confirmCustomTalent = () => {
    if (balancedTalentPreview) {
      const isGodSelected = formData.talents.some(t => godTalentNames.includes(t.name));
      if (!isGodSelected && formData.talents.length >= MAX_TALENTS) {
        alert(`Không thể chọn thêm, đã đạt tối đa ${MAX_TALENTS} thiên phú.`);
        return;
      }
      handleTalentSelect(balancedTalentPreview);
      setBalancedTalentPreview(null);
      setCustomTalentInput({ name: '', desc: '' });
    }
  };

  const cancelCustomTalent = () => {
    setBalancedTalentPreview(null);
  };

  const handleFinalize = async () => {
    setLoading(true);
    
    // Parallel generation of Loadout and Achievements
    try {
      const [loadout, achievements] = await Promise.all([
        generateStartingLoadout(world, formData),
        generateInitialAchievements(world)
      ]);

      // Robustness Check: Ensure loadout is valid
      let safeLoadout = loadout;
      if (!safeLoadout || !safeLoadout.inventory || safeLoadout.inventory.length === 0 || !safeLoadout.skill) {
         safeLoadout = {
             inventory: [
                { category: "equipment", name: "Túi Tân Thủ", type: "Gói quà", rank: "Thường", quantity: 1, description: "Chứa vật phẩm cơ bản" },
                { category: "consumable", name: "Lương Khô", effect: "Hồi phục thể lực", quantity: 3 },
                { category: "currency", name: "Tiền", quantity: 10 }
             ],
             skill: { name: "Cơ Bản Công", type: "Passive", description: "Kỹ thuật căn bản.", mastery: "Sơ nhập" }
         };
      }

      setFinalLoadout(safeLoadout);
      setInitialAchievements(achievements);
      setStep(7); // Go to summary
    } catch (e) {
      console.error(e);
      alert("Có lỗi xảy ra khi khởi tạo nhân vật.");
    } finally {
      setLoading(false);
    }
  };

  const confirmCreation = () => {
    const initialSkills = [];
    if (finalLoadout?.skill) {
       if (typeof finalLoadout.skill === 'string') {
         initialSkills.push({
           id: Date.now().toString(),
           name: finalLoadout.skill,
           type: 'Special',
           description: 'Kỹ năng khởi đầu',
           mastery: 'Sơ nhập'
         });
       } else {
         initialSkills.push({
           id: Date.now().toString(),
           ...finalLoadout.skill
         });
       }
    }

    // --- INITIALIZE STARTING LEVEL NAME ---
    const genre = world.genre?.toLowerCase() || "";
    let initialLevelName = "Cấp 1";
    if (genre.includes('tu tiên') || genre.includes('tiên hiệp')) {
      initialLevelName = "Luyện Khí Tầng 1";
    } else if (genre.includes('võ hiệp')) {
      initialLevelName = "Sơ Hiểu Võ Nghệ";
    } else if (genre.includes('fantasy')) {
      initialLevelName = "Tân Thủ (Rank E)";
    } else if (genre.includes('game')) {
      initialLevelName = "Lv.1 (Tân Binh)";
    }

    // --- INITIALIZE RESISTANCES ---
    let initialResistances: Stat[] = [];
    if (world.resistanceTypes && world.resistanceTypes.length > 0) {
      initialResistances = world.resistanceTypes.map(r => ({ name: r, value: 0 }));
    } else {
      if (genre.includes('tu tiên') || genre.includes('fantasy')) {
         initialResistances = [
           { name: "Kháng Hỏa", value: 0 },
           { name: "Kháng Băng", value: 0 },
           { name: "Kháng Độc", value: 0 },
           { name: "Kháng Tâm Linh", value: 0 }
         ];
      } else {
         initialResistances = [
           { name: "Kháng Vật Lý", value: 0 },
           { name: "Kháng Cháy", value: 0 },
           { name: "Kháng Độc", value: 0 }
         ];
      }
    }

    const char: Character = {
      name: formData.name,
      gender: formData.gender,
      appearance: formData.appearance,
      personality: formData.personality,
      background: formData.background,
      race: formData.race,
      class: formData.class,
      level: 1,
      levelName: initialLevelName, 
      exp: 0,
      expToNextLevel: 100,
      hp: 100, 
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      stats: formData.stats,
      resistances: initialResistances,
      talents: formData.talents.map(t => `${t.name}: ${t.description}`),
      inventory: finalLoadout?.inventory || [],
      skills: initialSkills,
      statusEffects: [],
      bloodlines: [],
      divineBodies: [],
      activeStatuses: [],
      achievements: initialAchievements,
      quests: [],
    };
    
    const godTalentName = 'Vận Mệnh Tuyệt Đối';
    const systemGodTalentName = 'Hệ Thống Thần Cấp';
    
    if (formData.talents.some(t => t.name === godTalentName)) {
        char.level = 999;
        char.levelName = "Thần Bất Diệt";
        char.hp = 99999;
        char.maxHp = 99999;
        char.mana = 99999;
        char.maxMana = 99999;
        char.exp = 0;
        char.expToNextLevel = 9999999;
        char.stats = char.stats.map(s => ({ ...s, value: 999 }));
        if (char.resistances) {
             char.resistances = char.resistances.map(r => ({ ...r, value: 100 }));
        }
        
        const godWeapon: InventoryItem = {
            id: 'god_weapon_1',
            name: 'Thần Kiếm Khai Thiên',
            quantity: 1,
            description: 'Vũ khí có thể chém rách cả không gian.',
            category: 'equipment',
            type: 'Thần Khí',
            rank: 'Vĩnh Hằng',
            isEquipped: true,
            effect: 'Sát thương vô hạn'
        };
        const godCurrency: InventoryItem = {
            id: 'god_currency_1',
            name: 'Nguyên Tinh Vĩnh Hằng',
            quantity: 999999,
            description: 'Tiền tệ tối thượng.',
            category: 'currency'
        };
        const godSkill: Skill = {
            id: 'god_skill_1',
            name: 'Thần Phạt',
            type: 'Special',
            description: 'Xóa sổ mọi kẻ thù khỏi sự tồn tại.',
            mastery: 'Viên Mãn',
            rank: 'Vĩnh Hằng'
        };

        char.inventory = [godWeapon, godCurrency];
        char.skills = [godSkill];
        char.talents = [`Vận Mệnh Tuyệt Đối: Bạn là kẻ toàn năng.`];
    } else if (formData.talents.some(t => t.name === systemGodTalentName)) {
        char.level = 999;
        char.levelName = "Ký Chủ Tối Thượng";
        char.hp = 99999;
        char.maxHp = 99999;
        char.mana = 99999;
        char.maxMana = 99999;
        char.exp = 0;
        char.expToNextLevel = 9999999;
        char.stats = char.stats.map(s => ({ ...s, value: 999 }));
        if (char.resistances) {
             char.resistances = char.resistances.map(r => ({ ...r, value: 100 }));
        }
        
        const systemWeapon: InventoryItem = {
            id: 'system_weapon_1',
            name: '[Thần Khí] Dao Găm Phân Rã Lượng Tử',
            quantity: 1,
            description: 'Vũ khí do hệ thống cung cấp, có khả năng xóa bỏ vật chất ở cấp độ nguyên tử.',
            category: 'equipment',
            type: 'Thần Khí',
            rank: 'Vĩnh Hằng',
            isEquipped: true,
            effect: 'Bỏ qua mọi phòng ngự, xóa bỏ mục tiêu'
        };
        const systemCurrency: InventoryItem = {
            id: 'system_currency_1',
            name: 'Điểm Hệ Thống',
            quantity: 9999999,
            description: 'Tiền tệ của hệ thống, có thể đổi mọi thứ.',
            category: 'currency'
        };
        const systemSkill: Skill = {
            id: 'system_skill_1',
            name: '[Phân Tích & Tối Ưu Hóa]',
            type: 'Passive',
            description: 'Hệ thống tự động phân tích mọi mục tiêu và tối ưu hóa mọi hành động của bạn để đạt hiệu quả tuyệt đối.',
            mastery: 'Viên Mãn',
            rank: 'Vĩnh Hằng'
        };

        char.inventory = [systemWeapon, systemCurrency];
        char.skills = [systemSkill];
        char.talents = [`Hệ Thống Thần Cấp: Hệ thống là hậu thuẫn lớn nhất của bạn.`];
    }
    
    onCharacterCreated(char);
  };

  // --- RENDER STEPS ---
  const renderStep1_Identity = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-4">1. Danh Tính</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 mb-2">Tên Nhân Vật</label>
          <input 
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white"
            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="Nhập tên..."
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-2">Giới Tính</label>
          <div className="flex gap-2">
            {['Nam', 'Nữ', 'Khác'].map(g => (
              <button 
                key={g} 
                onClick={() => setFormData({...formData, gender: g})}
                className={`flex-1 py-3 rounded border ${formData.gender === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-slate-400 mb-2 flex items-center gap-2">
          <Palette size={16} /> Ngoại Hình
        </label>
        <textarea 
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white h-20 resize-none placeholder:text-slate-600"
          value={formData.appearance} 
          onChange={e => setFormData({...formData, appearance: e.target.value})}
          placeholder="Tóc trắng, mắt đỏ, cao gầy, có vết sẹo..."
        />
      </div>
      <div>
        <label className="block text-slate-400 mb-2 flex items-center gap-2">
           <Smile size={16} /> Tính Cách
        </label>
        <textarea 
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white h-20 resize-none placeholder:text-slate-600"
          value={formData.personality} 
          onChange={e => setFormData({...formData, personality: e.target.value})}
          placeholder="Lạnh lùng, quyết đoán, hay cười, sợ ma..."
        />
      </div>
    </div>
  );

  const renderStep2_Background = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-4">2. Xuất Thân</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {(suggestions.backgrounds || []).map((bg: string, i: number) => (
          <button 
            key={i} 
            onClick={() => { setFormData({...formData, background: bg}); setSuitabilityMsg(null); }}
            className={`p-3 text-left rounded border ${formData.background === bg ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
          >
            {bg}
          </button>
        ))}
      </div>
      <div className="relative">
        <label className="block text-slate-400 mb-2">Hoặc tự nhập xuất thân</label>
        <div className="flex gap-2">
          <input 
            className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded text-white"
            value={formData.background} onChange={e => setFormData({...formData, background: e.target.value})}
            placeholder="Ví dụ: Nô lệ đấu trường..."
          />
          <button 
            onClick={() => handleCheckSuitability("Xuất thân", formData.background)}
            disabled={loading}
            className="px-4 bg-blue-600 rounded text-white"
          >
            Kiểm tra
          </button>
        </div>
        {suitabilityMsg && (
          <div className={`mt-2 p-3 rounded text-sm ${suitabilityMsg.valid ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {suitabilityMsg.msg}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3_Race = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-4">3. Chủng Tộc / Thân Phận</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        {(suggestions.races || []).map((r: string, i: number) => (
          <button 
            key={i} 
            onClick={() => { setFormData({...formData, race: r}); setSuitabilityMsg(null); }}
            className={`px-4 py-2 rounded border ${formData.race === r ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded text-white"
          value={formData.race} onChange={e => setFormData({...formData, race: e.target.value})}
          placeholder="Tự nhập chủng tộc..."
        />
        <button 
          onClick={() => handleCheckSuitability("Chủng tộc", formData.race)}
          disabled={loading}
          className="px-4 bg-blue-600 rounded text-white"
        >
          Phân tích
        </button>
      </div>
      {suitabilityMsg && (
        <div className={`mt-2 p-3 rounded text-sm ${suitabilityMsg.valid ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {suitabilityMsg.msg}
        </div>
      )}
    </div>
  );

  const renderStep4_Class = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-4">4. Con Đường Phát Triển (Class)</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(suggestions.classes || []).map((c: string, i: number) => (
          <button 
            key={i} 
            onClick={() => { setFormData({...formData, class: c}); setClassAnalysis(null); }}
            className={`p-3 text-left rounded border ${formData.class === c ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <input 
          className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded text-white"
          value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})}
          placeholder="Tự nhập Class..."
        />
        <button 
          onClick={handleAnalyzeClass}
          disabled={loading}
          className="px-4 bg-purple-600 hover:bg-purple-700 rounded text-white font-bold whitespace-nowrap"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Phân Tích Class'}
        </button>
      </div>
      
      {classAnalysis && (
        <div className="bg-slate-800 border border-slate-600 p-4 rounded text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Chiến đấu:</span>
            <span className="text-white font-bold">{classAnalysis.style}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Ưu điểm:</span>
            <span className="text-green-400">{classAnalysis.pros}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nhược điểm:</span>
            <span className="text-red-400">{classAnalysis.cons}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-700 pt-2 mt-2">
             <span className="text-slate-400 uppercase font-bold text-xs">Độ khó sinh tồn</span>
             <span className="px-2 py-1 bg-red-900 text-red-200 rounded text-xs font-bold">{classAnalysis.difficulty}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep5_Stats = () => {
    const pointsUsed = formData.stats.reduce((acc, s) => acc + (s.value - BASE_STAT_VAL), 0);
    const pointsLeft = TOTAL_POINTS - pointsUsed;

    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-xl font-bold text-white mb-4">5. Chỉ Số Khởi Đầu</h2>
        <div className="bg-slate-800 p-4 rounded border border-slate-700 text-center mb-6">
          <span className="text-slate-400">Điểm tiềm năng còn lại</span>
          <div className="text-4xl font-mono font-bold text-yellow-500">{pointsLeft}</div>
        </div>
        
        <div className="space-y-4">
          {formData.stats.map((stat, idx) => (
            <div key={idx} className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-white font-bold w-1/3">{stat.name}</span>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleStatChange(idx, -1)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono font-bold text-xl">{stat.value}</span>
                <button 
                  onClick={() => handleStatChange(idx, 1)}
                  disabled={pointsLeft <= 0}
                  className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep6_Talent = () => {
    const godTalent = {
      name: 'Vận Mệnh Tuyệt Đối',
      description: 'Bắt đầu với tư cách là một thực thể toàn năng. Tất cả chỉ số, cấp độ và tài nguyên sẽ được tối đa hóa.'
    };
    const systemGodTalent = {
        name: 'Hệ Thống Thần Cấp',
        description: 'Kích hoạt một hệ thống toàn năng hỗ trợ bạn. Mọi chỉ số, kỹ năng, tài nguyên sẽ được tối ưu hóa đến mức cực hạn.'
    };
    const selectedCount = formData.talents.length;
    const isGodTalentSelected = formData.talents.some(t => godTalentNames.includes(t.name));
    const isVMTDSelected = formData.talents.some(t => t.name === godTalent.name);
    const isHTTCSelected = formData.talents.some(t => t.name === systemGodTalent.name);
    const atMaxTalents = selectedCount >= MAX_TALENTS;
    
    return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-baseline">
        <h2 className="text-xl font-bold text-white">6. Thiên Phú (Chọn tối đa 3)</h2>
        <span className={`font-mono text-sm font-bold ${atMaxTalents ? 'text-yellow-400' : 'text-slate-500'}`}>{selectedCount}/{MAX_TALENTS}</span>
      </div>
      <div className="space-y-3 mb-6">
        <button 
          onClick={() => handleTalentSelect(godTalent)}
          className={`w-full text-left p-4 rounded border-2 transition-all ${isVMTDSelected
            ? 'border-amber-400 bg-amber-900/40 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.4)]' 
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750'}`}
        >
          <div className="font-bold mb-1 flex items-center gap-2">
              <Zap className="text-amber-400" size={18} /> {godTalent.name}
          </div>
          <div className="text-xs opacity-80">{godTalent.description}</div>
        </button>

        <button 
          onClick={() => handleTalentSelect(systemGodTalent)}
          className={`w-full text-left p-4 rounded border-2 transition-all ${isHTTCSelected
            ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200 shadow-[0_0_25px_rgba(34,211,238,0.4)]' 
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750'}`}
        >
          <div className="font-bold mb-1 flex items-center gap-2">
              <Shield className="text-cyan-400" size={18} /> {systemGodTalent.name}
          </div>
          <div className="text-xs opacity-80">{systemGodTalent.description}</div>
        </button>
        
        <div className="text-center text-slate-500 text-xs my-4">-- Hoặc chọn Thiên Phú thông thường --</div>

        {talentList.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Brain className="mx-auto mb-2 opacity-50" size={48} />
            <p>Bấm nút dưới để tìm cảm hứng...</p>
          </div>
        )}
        {talentList.map((t, i) => {
          const isSelected = formData.talents.some(sel => sel.name === t.name);
          const isDisabled = (atMaxTalents && !isSelected) || isGodTalentSelected;

          return (
            <button 
              key={i}
              onClick={() => handleTalentSelect({ name: t.name, description: t.description })}
              disabled={isDisabled}
              className={`w-full text-left p-4 rounded border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isSelected
                ? 'bg-purple-900/40 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'}`}
            >
              <div className="font-bold mb-1">{t.name}</div>
              <div className="text-xs opacity-80">{t.description}</div>
            </button>
          );
        })}
        <button 
          onClick={handleRerollTalents}
          disabled={loading || isGodTalentSelected}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} 
          Tải Lại Gợi Ý
        </button>
      </div>
      <div className="border-t border-slate-700 pt-6">
        <label className="block text-slate-400 mb-2 font-bold">Hoặc Tự Thiết Kế (Cần AI Cân Bằng)</label>
        {!balancedTalentPreview ? (
          <div className="space-y-3 bg-slate-800 p-4 rounded border border-slate-700">
            <input 
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              placeholder="Tên thiên phú"
              value={customTalentInput.name}
              onChange={e => setCustomTalentInput({...customTalentInput, name: e.target.value})}
            />
            <textarea 
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm h-20 resize-none"
              placeholder="Công dụng mong muốn..."
              value={customTalentInput.desc}
              onChange={e => setCustomTalentInput({...customTalentInput, desc: e.target.value})}
            />
            <button 
              onClick={handleBalanceCustomTalent}
              disabled={loading || !customTalentInput.name || atMaxTalents || isGodTalentSelected}
              className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              Phân Tích & Cân Bằng
            </button>
          </div>
        ) : (
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded space-y-3 animate-fade-in">
            <h3 className="text-yellow-400 font-bold flex items-center gap-2">
              <Check size={18} /> Kết Quả Cân Bằng
            </h3>
            <div className="bg-slate-900/50 p-3 rounded">
              <div className="font-bold text-white mb-1">{balancedTalentPreview.name}</div>
              <div className="text-sm text-slate-300">{balancedTalentPreview.description}</div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={confirmCustomTalent}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-sm"
              >
                Học Thiên Phú Này
              </button>
              <button 
                onClick={cancelCustomTalent}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm"
              >
                Quay Lại Sửa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    )
  };

  const renderStep7_Summary = () => (
    <div className="animate-fade-in pb-20">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Hồ Sơ Nhân Vật</h2>
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl mb-6">
        <div className="bg-slate-800 p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-3xl font-serif font-bold text-blue-400">{formData.name}</h3>
            <p className="text-slate-400 text-sm mt-1">{formData.gender} • {formData.race} • {formData.class}</p>
          </div>
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600">
            <User size={32} className="text-slate-400" />
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <h4 className="text-slate-500 text-xs font-bold uppercase">Xuất Thân</h4>
               <p className="text-slate-300 text-sm bg-slate-800 p-2 rounded">{formData.background}</p>
             </div>
             <div className="space-y-2">
               <h4 className="text-slate-500 text-xs font-bold uppercase">Tính Cách</h4>
               <p className="text-slate-300 text-sm bg-slate-800 p-2 rounded">{formData.personality || "Không rõ"}</p>
             </div>
          </div>
          <div className="space-y-2">
             <h4 className="text-slate-500 text-xs font-bold uppercase">Ngoại Hình</h4>
             <p className="text-slate-300 text-sm bg-slate-800 p-2 rounded italic">{formData.appearance || "Không rõ"}</p>
          </div>
          <div>
            <h4 className="text-slate-500 text-xs font-bold uppercase mb-2">Chỉ Số</h4>
            <div className="grid grid-cols-2 gap-2">
              {formData.stats.map((s, i) => (
                <div key={i} className="flex justify-between bg-slate-800 p-2 rounded text-sm">
                  <span className="text-slate-400">{s.name}</span>
                  <span className="font-mono font-bold text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-purple-900/20 border border-purple-900/50 p-4 rounded">
            <h4 className="text-purple-400 text-xs font-bold uppercase mb-1 flex items-center gap-2">
              <Dna size={14} /> Thiên Phú ({formData.talents.length})
            </h4>
            {formData.talents.map(t => (
               <div key={t.name} className="mb-2 last:mb-0">
                 <div className="font-bold text-purple-200 text-lg mb-1">{t.name}</div>
                 <p className="text-purple-300/80 text-sm italic">{t.description}</p>
               </div>
            ))}
          </div>
          {finalLoadout && (
            <div>
              <h4 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                <Swords size={14} /> Khởi Đầu
              </h4>
              <div className="bg-slate-800 p-3 rounded text-sm text-slate-300 space-y-1">
                 <p><span className="text-slate-500">Vũ khí/Đồ:</span> {finalLoadout.inventory?.map((i: any) => typeof i === 'string' ? i : i.name).join(', ')}</p>
                 <p><span className="text-slate-500">Kỹ năng:</span> {finalLoadout.skill ? (typeof finalLoadout.skill === 'string' ? finalLoadout.skill : finalLoadout.skill.name) : "Không có"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => setStep(6)} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold">Sửa Đổi</button>
        <button 
          onClick={confirmCreation}
          className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
        >
          <Save size={20} /> XÁC NHẬN & BẮT ĐẦU
        </button>
      </div>
    </div>
  );

  const canProceed = () => {
    if (step === 1) return formData.name.trim().length > 0;
    if (step === 2) return formData.background.trim().length > 0;
    if (step === 3) return formData.race.trim().length > 0;
    if (step === 4) return formData.class.trim().length > 0;
    if (step === 5) return formData.stats.reduce((acc,s) => acc + (s.value - BASE_STAT_VAL), 0) === TOTAL_POINTS;
    if (step === 6) return formData.talents.length > 0 && formData.talents.length <= 3;
    return true;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
           <h1 className="text-lg font-bold text-white flex items-center gap-2">
             <User size={20} className="text-blue-500" /> Tạo Nhân Vật
           </h1>
           <div className="text-xs font-mono text-slate-500">Bước {step}/7</div>
        </div>
        <div className="h-1 bg-slate-800 w-full mt-4 max-w-2xl mx-auto rounded-full overflow-hidden">
           <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(step/7)*100}%` }} />
        </div>
      </div>
      <div className="flex-1 p-6 max-w-2xl mx-auto w-full pb-32">
        {step === 1 && renderStep1_Identity()}
        {step === 2 && renderStep2_Background()}
        {step === 3 && renderStep3_Race()}
        {step === 4 && renderStep4_Class()}
        {step === 5 && renderStep5_Stats()}
        {step === 6 && renderStep6_Talent()}
        {step === 7 && renderStep7_Summary()}
      </div>
      {step < 7 && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 z-50">
          <div className="max-w-2xl mx-auto flex justify-between gap-4">
             <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="px-6 py-3 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
               <ChevronLeft />
             </button>
             {step === 6 ? (
               <button onClick={handleFinalize} disabled={!canProceed() || loading || !!balancedTalentPreview} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50">
                 {loading ? <Loader2 className="animate-spin" /> : 'Hoàn Tất & Xem Hồ Sơ'}
               </button>
             ) : (
               <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50">
                 Tiếp Tục <ChevronRight />
               </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterCreator;
