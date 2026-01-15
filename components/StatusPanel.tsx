
import React, { useState } from 'react';
import { Character, World, Skill, InventoryItem, ItemCategory, Trait, TraitType, Achievement } from '../types';
import { Heart, Zap, Shield, Backpack, User, Smile, Palette, Sparkles, Book, Check, X, RotateCcw, Activity, Sword, Beaker, Box, Coins, Info, Crown, ShieldCheck, Flame, Droplet, Skull, Star, ChevronDown, ChevronUp, PlusCircle, ArrowDownAZ, ArrowUp10, Filter, CheckCircle2, Trophy, Map, Library } from 'lucide-react';
import { fuseSkills, generateSkillImage } from '../services/geminiService';

interface Props {
  character: Character;
  world: World;
  onCharacterUpdate?: (newChar: Character) => void;
}

const ProgressBar: React.FC<{ current: number; max: number; color: string; label?: string }> = ({ current, max, color, label }) => {
  const cur = Number(current) || 0;
  const mx = Number(max) || 1; 
  const rawPercent = (cur / mx) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));

  return (
    <div className="w-full mb-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{cur}/{mx}</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
        <div className={`h-full ${color} transition-all duration-500 ease-out`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const ResistanceBar: React.FC<{ name: string; value: number }> = ({ name, value }) => {
  const percent = Math.min(100, Math.max(0, value));
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.5)]'; 
    if (v >= 50) return 'bg-green-400'; 
    if (v >= 20) return 'bg-blue-400'; 
    return 'bg-slate-500'; 
  };

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between items-center text-xs mb-1">
         <span className="text-slate-300 font-medium">{name}</span>
         <span className="font-mono text-slate-400">{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
         <div className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const TraitItem: React.FC<{ trait: Trait }> = ({ trait }) => {
  let styleClass = "";
  let Icon = Sparkles;

  switch (trait.type) {
    case 'bloodline':
      styleClass = "bg-red-950/40 border-red-800 text-red-200 shadow-[0_0_10px_rgba(153,27,27,0.2)]";
      Icon = Droplet;
      break;
    case 'divine_body':
      styleClass = "bg-amber-950/40 border-amber-600 text-amber-200 shadow-[0_0_10px_rgba(217,119,6,0.2)]";
      Icon = Star;
      break;
    case 'buff':
      styleClass = "bg-emerald-950/40 border-emerald-700 text-emerald-200";
      Icon = ShieldCheck;
      break;
    case 'debuff':
      styleClass = "bg-rose-950/40 border-rose-800 text-rose-200";
      Icon = Skull;
      break;
    case 'mental':
      styleClass = "bg-purple-950/40 border-purple-700 text-purple-200";
      Icon = Activity;
      break;
    default:
      styleClass = "bg-blue-950/40 border-blue-700 text-blue-200";
      Icon = Zap;
  }

  return (
    <div className={`p-3 rounded border ${styleClass} mb-2 relative overflow-hidden group animate-fade-in`}>
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-bold text-sm flex items-center gap-2">
           <Icon size={14} /> {trait.name}
        </h4>
        {trait.quality && (
           <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/30 border border-white/10">
             {trait.quality}
           </span>
        )}
      </div>
      <p className="text-xs opacity-80 italic">{trait.description}</p>
      {trait.effect && <p className="text-[10px] mt-1 text-slate-200 font-bold border-t border-white/10 pt-1">{trait.effect}</p>}
      {trait.duration !== undefined && trait.duration >= 0 && (
         <div className="absolute bottom-1 right-2 text-[10px] font-mono font-bold bg-black/40 px-1 rounded">
            {trait.duration} lượt
         </div>
      )}
    </div>
  );
};

const AchievementItem: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const Icon = achievement.type === 'combat' ? Sword : 
               achievement.type === 'collection' ? Box : 
               achievement.type === 'exploration' ? Map : Trophy;
  
  return (
    <div className={`p-3 rounded border mb-2 flex items-start gap-3 transition-all ${achievement.isUnlocked ? 'bg-yellow-950/30 border-yellow-700/50 opacity-100' : 'bg-slate-900 border-slate-800 opacity-60 grayscale'}`}>
      <div className={`p-2 rounded-full ${achievement.isUnlocked ? 'bg-yellow-900/50 text-yellow-400' : 'bg-slate-800 text-slate-600'}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
           <h4 className={`font-bold text-sm ${achievement.isUnlocked ? 'text-yellow-200' : 'text-slate-400'}`}>{achievement.name}</h4>
           {achievement.isUnlocked && <span className="text-[9px] font-bold bg-yellow-600 text-black px-1.5 py-0.5 rounded uppercase">Hoàn Thành</span>}
        </div>
        <p className="text-xs text-slate-500 italic mb-1">{achievement.description}</p>
        {achievement.isUnlocked && achievement.reward && (
           <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Sparkles size={10} /> {achievement.reward}</p>
        )}
        {!achievement.isUnlocked && (
           <p className="text-[10px] text-slate-600 border-t border-slate-800 pt-1 mt-1">Điều kiện: {achievement.condition}</p>
        )}
      </div>
    </div>
  );
};

const StatusPanel: React.FC<Props> = ({ character, world, onCharacterUpdate }) => {
  const [isFusionOpen, setIsFusionOpen] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [fusionResult, setFusionResult] = useState<Skill | null>(null);
  const [activeInvTab, setActiveInvTab] = useState<ItemCategory>('equipment');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [sortMode, setSortMode] = useState<'name' | 'quantity' | 'rank'>('rank');
  const [generatingSkillId, setGeneratingSkillId] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null); // NEW: State for skill details
  
  // State for collapsible sections
  const [expanded, setExpanded] = useState<{traits: boolean, statuses: boolean, achievements: boolean}>({ traits: true, statuses: true, achievements: true });
  
  // State for Add Status Modal
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusForm, setNewStatusForm] = useState<Partial<Trait>>({ type: 'buff', duration: 3 });

  const toggleTraits = () => setExpanded(prev => ({ ...prev, traits: !prev.traits }));
  const toggleStatuses = () => setExpanded(prev => ({ ...prev, statuses: !prev.statuses }));
  const toggleAchievements = () => setExpanded(prev => ({ ...prev, achievements: !prev.achievements }));

  const getLevelLabel = () => {
    const genre = world.genre?.toLowerCase() || "";
    if (genre.includes('tu tiên') || genre.includes('tiên hiệp')) return "Cảnh Giới";
    if (genre.includes('võ hiệp')) return "Tu Vi";
    if (genre.includes('fantasy') || genre.includes('dị giới')) return "Đẳng Cấp";
    if (genre.includes('game')) return "Level";
    return "Cấp Độ";
  };
  
  const levelLabel = getLevelLabel();
  const displayLevel = character.levelName || character.level.toString();

  const handleSkillClick = (skill: Skill) => {
    if (isFusionOpen) {
      if (selectedSkillIds.length === 0) { setSelectedSkillIds([skill.id]); return; }
      if (selectedSkillIds.includes(skill.id)) { setSelectedSkillIds(selectedSkillIds.filter(id => id !== skill.id)); return; }
      const firstSkill = character.skills?.find(s => s.id === selectedSkillIds[0]);
      if (firstSkill && firstSkill.type === skill.type) setSelectedSkillIds([...selectedSkillIds, skill.id]);
    } else {
      setViewingSkill(skill);
    }
  };

  const toggleSkillSelection = (skill: Skill) => {
    if (selectedSkillIds.includes(skill.id)) {
      setSelectedSkillIds(selectedSkillIds.filter(id => id !== skill.id));
    } else {
      if (selectedSkillIds.length === 0) {
        setSelectedSkillIds([skill.id]);
      } else {
        const firstSkill = character.skills?.find(s => s.id === selectedSkillIds[0]);
        if (firstSkill && firstSkill.type === skill.type) {
          setSelectedSkillIds([...selectedSkillIds, skill.id]);
        }
      }
    }
  };

  const handleFusion = async () => {
    if (selectedSkillIds.length < 2) return;
    setFusionLoading(true);
    const ingredients = (character.skills || []).filter(s => selectedSkillIds.includes(s.id));
    const result = await fuseSkills(world, ingredients);
    if (!result) {
       alert("Dung hợp thất bại. Cảm ngộ chưa đủ hoặc thiên ý trêu ngươi. Hãy thử lại!");
       setFusionLoading(false);
       return;
    }
    setFusionResult(result);
    setFusionLoading(false);
  };

  const confirmFusion = () => {
    if (!fusionResult || !onCharacterUpdate) return;
    const remainingSkills = (character.skills || []).filter(s => !selectedSkillIds.includes(s.id));
    const newSkills = [...remainingSkills, fusionResult];
    onCharacterUpdate({ ...character, skills: newSkills });
    setFusionResult(null);
    setSelectedSkillIds([]);
    setIsFusionOpen(false);
  };

  const cancelFusion = () => setFusionResult(null);
  const closeFusionModal = () => { setIsFusionOpen(false); setSelectedSkillIds([]); setFusionResult(null); };

  const handleGenerateSkillIcon = async (skill: Skill) => {
    if (generatingSkillId || !onCharacterUpdate) return;
    setGeneratingSkillId(skill.id);
    try {
      const base64Data = await generateSkillImage(skill, world.genre);
      if (base64Data) {
        const updatedSkills = character.skills.map(s => s.id === skill.id ? { ...s, imageUrl: base64Data } : s);
        onCharacterUpdate({ ...character, skills: updatedSkills });
      } else {
        alert("Không thể họa hình cho kỹ năng này lúc này.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingSkillId(null);
    }
  };

  const handleAddStatus = () => {
    if (!newStatusForm.name || !onCharacterUpdate) return;
    const newStatus: Trait = {
        id: Date.now().toString(),
        name: newStatusForm.name,
        type: newStatusForm.type as TraitType,
        duration: newStatusForm.duration,
        description: newStatusForm.description || '',
        effect: newStatusForm.effect || ''
    };
    onCharacterUpdate({
        ...character,
        activeStatuses: [...(character.activeStatuses || []), newStatus]
    });
    setIsAddingStatus(false);
    setNewStatusForm({ type: 'buff', duration: 3, name: '', description: '', effect: '' });
  };

  const selectedType = selectedSkillIds.length > 0 && character.skills ? character.skills.find(s => s.id === selectedSkillIds[0])?.type : null;

  const getFilteredItems = (category: ItemCategory) => {
    const items = character.inventory ? character.inventory.filter(item => (!item.category && category === 'consumable') || item.category === category) : [];
    
    return items.sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === 'quantity') {
        return b.quantity - a.quantity;
      }
      if (sortMode === 'rank') {
        // Simple string compare for rank, or fallback to name
        return (b.rank || '').localeCompare(a.rank || '') || a.name.localeCompare(b.name);
      }
      return 0;
    });
  };

  // --- EQUIP / UNEQUIP LOGIC ---
  const handleToggleEquip = (item: InventoryItem) => {
    if (!onCharacterUpdate) return;
    
    const isEquipping = !item.isEquipped;
    const newInventory = character.inventory.map(i => i.id === item.id ? { ...i, isEquipped: isEquipping } : i);
    
    let newStats = [...character.stats];
    
    // Attempt to parse effect string: "Sức mạnh +5, Nhanh nhẹn -2"
    if (item.effect) {
       const effects = item.effect.split(',').map(s => s.trim());
       const regex = /^(.*?)\s*([+-]\d+)$/i; // Matches "Stat Name +10"
       
       effects.forEach(eff => {
          const match = eff.match(regex);
          if (match) {
             const statName = match[1].trim();
             const val = parseInt(match[2]);
             
             // Update matched stat
             newStats = newStats.map(s => {
                if (s.name.toLowerCase() === statName.toLowerCase()) {
                   return { ...s, value: s.value + (isEquipping ? val : -val) };
                }
                return s;
             });
          }
       });
    }

    onCharacterUpdate({
       ...character,
       inventory: newInventory,
       stats: newStats
    });
    
    // Update local modal state
    setSelectedItem({ ...item, isEquipped: isEquipping });
  };

  const renderInventoryList = () => {
    const items = getFilteredItems(activeInvTab);
    if (items.length === 0) return <div className="text-center text-slate-600 text-xs italic py-4">Trống trơn.</div>;
    return (
      <div className="space-y-1">
        {items.map((item, idx) => (
          <button key={item.id || idx} onClick={() => setSelectedItem(item)} className="w-full flex justify-between items-center p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700/50">
             <div className="text-left flex items-center gap-2">
                {activeInvTab === 'equipment' && (
                  <div className={`w-2 h-2 rounded-full ${item.isEquipped ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
                )}
                <div>
                   <div className="text-sm text-slate-300 font-bold">{item.name}{item.quantity > 1 && <span className="ml-2 text-xs text-slate-500 font-mono">x{item.quantity}</span>}</div>
                </div>
             </div>
             {activeInvTab === 'equipment' && item.rank && (<span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-yellow-500">{item.rank}</span>)}
             {activeInvTab === 'currency' && (<span className="font-mono font-bold text-yellow-500">{item.quantity}</span>)}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 h-full p-4 overflow-y-auto relative">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700"><User className="text-slate-400" /></div>
        <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="text-xl font-bold text-white leading-tight truncate">{character.name}</h2>{character.title && (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse"><Crown size={10} className="mb-0.5" /> {character.title}</span>)}</div><p className="text-[10px] text-slate-500 uppercase leading-tight mt-1"><span className="text-blue-400 font-bold">{character.race}</span> • {character.class}</p></div>
        <div className="ml-auto flex flex-col items-center justify-center min-w-[80px] border-l border-slate-800 pl-3"><span className="text-[10px] text-slate-500 uppercase font-bold text-center leading-none mb-1">{levelLabel}</span><span className={`font-bold text-yellow-500 text-center leading-tight ${displayLevel.length > 10 ? 'text-[10px]' : displayLevel.length > 6 ? 'text-xs' : 'text-xl'}`}>{displayLevel}</span></div>
      </div>

      <div className="space-y-4 mb-6">
        <ProgressBar current={character.hp} max={character.maxHp} color="bg-red-500" label="Sinh Lực (HP)" />
        <ProgressBar current={character.mana} max={character.maxMana} color="bg-blue-500" label="Năng Lượng (MP)" />
        <ProgressBar current={character.exp} max={character.expToNextLevel} color="bg-yellow-500" label="Kinh Nghiệm (EXP)" />
      </div>

      {character.permanentInjuries && character.permanentInjuries.length > 0 && (<div className="mb-6 bg-red-950/20 border border-red-900/50 rounded p-3"><h3 className="text-sm font-bold text-red-400 uppercase mb-2 flex items-center gap-2"><Activity size={16} /> Thương Tật Vĩnh Viễn</h3><ul className="list-disc list-inside space-y-1">{character.permanentInjuries.map((injury, i) => (<li key={i} className="text-xs text-red-300 italic">{injury}</li>))}</ul></div>)}
      
      {/* --- TRAIT SECTION: BLOODLINE & DIVINE BODY (COLLAPSIBLE) --- */}
      {(character.bloodlines?.length > 0 || character.divineBodies?.length > 0) && (
        <div className="mb-6">
           <button 
             onClick={toggleTraits}
             className="w-full flex justify-between items-center text-sm font-bold text-slate-300 uppercase mb-3 group hover:text-slate-100 transition-colors"
           >
             <span className="flex items-center gap-2"><Flame size={16} className="text-slate-500" /> Huyết Mạch & Thần Thể</span>
             {expanded.traits ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
           </button>
           
           {expanded.traits && (
             <div className="space-y-2 animate-fade-in">
               {character.bloodlines?.map(t => <TraitItem key={t.id} trait={t} />)}
               {character.divineBodies?.map(t => <TraitItem key={t.id} trait={t} />)}
             </div>
           )}
        </div>
      )}

      {/* --- TRAIT SECTION: ACTIVE STATUS (COLLAPSIBLE) --- */}
      <div className="mb-6">
           <div className="flex justify-between items-center mb-3">
             <button onClick={toggleStatuses} className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase group hover:text-slate-100 transition-colors">
               <Activity size={16} className="text-slate-500" /> Trạng Thái
               {expanded.statuses ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
             </button>
             <button onClick={() => setIsAddingStatus(true)} className="p-1 text-slate-500 hover:text-blue-400"><PlusCircle size={16}/></button>
           </div>
           
           {expanded.statuses && (
             <div className="space-y-2 animate-fade-in">
               {character.activeStatuses && character.activeStatuses.length > 0 ? (
                 character.activeStatuses.map(t => <TraitItem key={t.id} trait={t} />)
               ) : (
                 <p className="text-xs text-slate-600 italic">Không có trạng thái đặc biệt.</p>
               )}
             </div>
           )}
      </div>

      {/* --- ACHIEVEMENT SECTION (NEW) --- */}
      <div className="mb-6">
           <div className="flex justify-between items-center mb-3">
             <button onClick={toggleAchievements} className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase group hover:text-slate-100 transition-colors">
               <Trophy size={16} className="text-slate-500" /> Thành Tựu
               {expanded.achievements ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
             </button>
             <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-800 px-2 py-0.5 rounded">
                {(character.achievements || []).filter(a => a.isUnlocked).length} / {(character.achievements || []).length}
             </span>
           </div>
           
           {expanded.achievements && (
             <div className="space-y-1 animate-fade-in">
               {character.achievements && character.achievements.length > 0 ? (
                 character.achievements.map(ach => <AchievementItem key={ach.id} achievement={ach} />)
               ) : (
                 <p className="text-xs text-slate-600 italic">Chưa có hệ thống thành tựu.</p>
               )}
             </div>
           )}
      </div>

      <div className="mb-6"><h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2"><Shield size={16} className="text-slate-500" /> Chỉ Số Cơ Bản</h3><div className="grid grid-cols-2 gap-2">{(character.stats || []).map((stat, i) => (<div key={i} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700/50"><span className="text-xs text-slate-400">{stat.name}</span><span className="font-mono font-bold text-slate-200">{stat.value}</span></div>))}</div></div>
      {character.resistances && character.resistances.length > 0 && (<div className="mb-6"><h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-slate-500" /> Chỉ Số Kháng</h3><div className="bg-slate-800/50 rounded border border-slate-700/50 p-3 space-y-2">{character.resistances.map((res, i) => (<ResistanceBar key={i} name={res.name} value={res.value} />))}</div></div>)}

      {/* --- SKILLS SECTION (IMPROVED) --- */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
           <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-2">
              <Book size={16} className="text-slate-500" /> Kỹ Năng
           </h3>
           {onCharacterUpdate && character.skills && character.skills.length >= 2 && (
              <button 
                 onClick={() => setIsFusionOpen(true)} 
                 className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900 text-purple-300 text-[10px] font-bold rounded-full border border-purple-700 transition-colors flex items-center gap-1"
              >
                 <Sparkles size={12} /> DUNG HỢP
              </button>
           )}
        </div>
        <div className="space-y-2">
           {character.skills && character.skills.length > 0 ? (
              character.skills.map((skill) => (
                <div 
                   key={skill.id} 
                   onClick={() => handleSkillClick(skill)}
                   className={`bg-slate-800 p-2 rounded border border-slate-700 flex items-center gap-3 relative overflow-hidden transition-all hover:border-blue-500 hover:bg-slate-750 cursor-pointer ${selectedSkillIds.includes(skill.id) ? 'border-purple-500 bg-purple-900/20' : ''}`}
                >
                    {/* Skill Icon Display */}
                    <div className="w-10 h-10 shrink-0 bg-slate-900 rounded border border-slate-700 flex items-center justify-center overflow-hidden group">
                      {skill.imageUrl ? (
                         <img src={`data:image/png;base64,${skill.imageUrl}`} alt={skill.name} className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center text-slate-600">
                           {generatingSkillId === skill.id ? <div className="w-4 h-4 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin"/> : <Book size={16} />}
                         </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-blue-200 flex items-center gap-2 truncate">
                          {skill.name}
                          <span className="text-[9px] uppercase bg-slate-900 px-1 py-0.5 rounded text-slate-500 border border-slate-800 shrink-0">{skill.type}</span>
                          {skill.rank && (<span className="text-[9px] uppercase bg-indigo-900/50 px-1 py-0.5 rounded text-indigo-300 border border-indigo-700/50 shrink-0">{skill.rank}</span>)}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{skill.description}</div>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded shrink-0">
                       {skill.mastery}
                    </div>
                    {/* Selection Checkmark for Fusion */}
                    {isFusionOpen && selectedSkillIds.includes(skill.id) && (
                       <div className="absolute right-2 top-2 bg-purple-600 rounded-full p-0.5 shadow-lg">
                          <Check size={12} className="text-white"/>
                       </div>
                    )}
                </div>
              ))
           ) : (
              <p className="text-xs text-slate-500 italic">Chưa học kỹ năng nào.</p>
           )}
        </div>
      </div>

      <div className="mb-6"><h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2"><Zap size={16} className="text-slate-500" /> Thiên Phú Khởi Đầu</h3><div className="flex flex-wrap gap-2">{(character.talents || []).map((t, i) => (<span key={i} className="text-[10px] px-2 py-1 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50">{t}</span>))}</div></div>

      <div className="pb-10">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-2"><Backpack size={16} className="text-slate-500" /> Hành Trang</h3>
            <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
               <button onClick={() => setSortMode('name')} className={`p-1.5 rounded transition-colors ${sortMode === 'name' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} title="Tên"><ArrowDownAZ size={14} /></button>
               <button onClick={() => setSortMode('quantity')} className={`p-1.5 rounded transition-colors ${sortMode === 'quantity' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} title="Số lượng"><ArrowUp10 size={14} /></button>
               <button onClick={() => setSortMode('rank')} className={`p-1.5 rounded transition-colors ${sortMode === 'rank' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} title="Phẩm cấp"><Star size={14} /></button>
            </div>
        </div>
        
        <div className="flex bg-slate-800 rounded p-1 mb-3">
          <button onClick={() => setActiveInvTab('equipment')} className={`flex-1 py-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeInvTab === 'equipment' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-400'}`}><Sword size={14} /> Trang Bị</button>
          <button onClick={() => setActiveInvTab('consumable')} className={`flex-1 py-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeInvTab === 'consumable' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-400'}`}><Beaker size={14} /> Vật Phẩm</button>
          <button onClick={() => setActiveInvTab('material')} className={`flex-1 py-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeInvTab === 'material' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-400'}`}><Box size={14} /> Nguyên Liệu</button>
          <button onClick={() => setActiveInvTab('currency')} className={`flex-1 py-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeInvTab === 'currency' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-400'}`}><Coins size={14} /> Tiền Tệ</button>
        </div>
        <div className="min-h-[150px]">{renderInventoryList()}</div>
      </div>

      {selectedItem && (<div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 animate-fade-in"><div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl relative"><button onClick={() => setSelectedItem(null)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white bg-slate-800 rounded-full z-10"><X size={20} /></button><div className="bg-slate-800 p-6 border-b border-slate-700 flex flex-col items-center text-center"><div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-600 mb-3 shadow-inner">{selectedItem.category === 'equipment' ? <Sword size={32} className="text-blue-400" /> : selectedItem.category === 'consumable' ? <Beaker size={32} className="text-green-400" /> : selectedItem.category === 'material' ? <Box size={32} className="text-amber-400" /> : <Coins size={32} className="text-yellow-400" />}</div><h3 className="text-xl font-serif font-bold text-white">{selectedItem.name}</h3>{selectedItem.rank && (<span className="text-xs font-bold text-yellow-500 border border-yellow-900/50 bg-yellow-900/20 px-2 py-0.5 rounded mt-2 inline-block">{selectedItem.rank}</span>)}</div><div className="p-6 space-y-4">{selectedItem.type && (<div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500 text-sm">Loại</span><span className="text-slate-300 font-bold text-sm">{selectedItem.type}</span></div>)}{selectedItem.quantity > 1 && (<div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500 text-sm">Số lượng</span><span className="text-white font-mono font-bold text-sm">x{selectedItem.quantity}</span></div>)}<div className="bg-slate-950 p-4 rounded text-sm text-slate-300 leading-relaxed italic border border-slate-800">{selectedItem.description || selectedItem.effect || "Không có thông tin chi tiết."}</div>{selectedItem.category === 'equipment' && (<div className="pt-2"><button onClick={() => handleToggleEquip(selectedItem)} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${selectedItem.isEquipped ? 'bg-red-900/50 hover:bg-red-900 border border-red-700 text-red-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-lg'}`}>{selectedItem.isEquipped ? <><X size={18} /> THÁO BỎ</> : <><CheckCircle2 size={18} /> TRANG BỊ</>}</button><p className="text-[10px] text-slate-500 text-center mt-2 italic">{selectedItem.isEquipped ? "Đang tăng chỉ số cho nhân vật" : "Sẽ cập nhật chỉ số nếu có hiệu ứng"}</p></div>)}</div></div></div>)}
      
      {/* Skill Detail Modal */}
      {viewingSkill && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 animate-fade-in">
           <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl relative">
              <button onClick={() => setViewingSkill(null)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white bg-slate-800 rounded-full z-10"><X size={20} /></button>
              <div className="bg-slate-800 p-6 border-b border-slate-700 flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-slate-600 mb-3 shadow-inner overflow-hidden relative group">
                    {viewingSkill.imageUrl ? (
                       <img src={`data:image/png;base64,${viewingSkill.imageUrl}`} alt={viewingSkill.name} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                          {generatingSkillId === viewingSkill.id ? (
                              <div className="w-6 h-6 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin"/> 
                          ) : (
                              <Book size={32} />
                          )}
                       </div>
                    )}
                    {/* Floating paint button */}
                    {!viewingSkill.imageUrl && !generatingSkillId && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleGenerateSkillIcon(viewingSkill); }} 
                         className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity"
                       >
                         <Palette size={20} />
                       </button>
                    )}
                 </div>
                 <h3 className="text-xl font-serif font-bold text-blue-300">{viewingSkill.name}</h3>
                 <div className="flex gap-2 mt-2">
                    <span className="text-[10px] font-bold bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800 uppercase">{viewingSkill.type}</span>
                    {viewingSkill.rank && <span className="text-[10px] font-bold bg-indigo-900/50 px-2 py-0.5 rounded text-indigo-300 border border-indigo-700/50 uppercase">{viewingSkill.rank}</span>}
                 </div>
              </div>
              <div className="p-6 space-y-4">
                 <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500 text-sm">Cảnh giới / Độ thuần thục</span>
                    <span className="text-yellow-500 font-mono font-bold text-sm">{viewingSkill.mastery}</span>
                 </div>
                 <div className="bg-slate-950 p-4 rounded text-sm text-slate-300 leading-relaxed italic border border-slate-800 min-h-[100px]">
                    {viewingSkill.description}
                 </div>
                 {!viewingSkill.imageUrl && (
                    <button 
                       onClick={() => handleGenerateSkillIcon(viewingSkill)}
                       disabled={!!generatingSkillId}
                       className="w-full py-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 text-blue-200 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                       {generatingSkillId === viewingSkill.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Palette size={16} />}
                       Vẽ Minh Họa Kỹ Năng
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {isFusionOpen && (<div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-fade-in"><div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-purple-400 flex items-center gap-2 uppercase tracking-tighter"><Sparkles size={20} /> Cảm Ngộ Dung Hợp</h2><button onClick={closeFusionModal} className="p-1 text-slate-500 hover:text-white"><X size={24} /></button></div>{!fusionResult ? (<div className="flex-1 flex flex-col min-h-0"><p className="text-xs text-slate-400 mb-4 italic">Dung hợp các kỹ năng <span className="text-purple-400 font-bold uppercase">{selectedType || "Cùng Loại"}</span> để tạo ra tuyệt kỹ mới mạnh mẽ hơn.</p><div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">{(character.skills || []).map(skill => {const isSelected = selectedSkillIds.includes(skill.id);const isCompatible = !selectedType || skill.type === selectedType;return (<button key={skill.id} onClick={() => toggleSkillSelection(skill)} disabled={!isSelected && !isCompatible} className={`w-full text-left p-3 rounded border transition-all flex justify-between items-center ${isSelected ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : isCompatible ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-slate-900 border-slate-800 opacity-20 cursor-not-allowed'}`}><div className="min-w-0 pr-2"><div className={`font-bold text-sm truncate ${isSelected ? 'text-purple-300' : 'text-slate-300'}`}>{skill.name}</div><div className="text-[9px] text-slate-500 uppercase">{skill.type} • {skill.mastery}</div></div>{isSelected && <Check size={18} className="text-purple-400 shrink-0" />}</button>);})}</div><button onClick={handleFusion} disabled={selectedSkillIds.length < 2 || fusionLoading} className="w-full py-4 bg-gradient-to-r from-purple-700 via-blue-700 to-purple-700 bg-[length:200%_100%] animate-gradient-x hover:from-purple-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:grayscale flex justify-center items-center gap-2 border border-purple-500/30">{fusionLoading ? (<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />) : (<><Sparkles size={18} /> DUNG HỢP ({selectedSkillIds.length})</>)}</button></div>) : (<div className="flex-1 flex flex-col justify-center items-center animate-fade-in text-center"><div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.5)] mb-8 animate-pulse"><Zap size={48} className="text-purple-400" /></div><h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-2 uppercase tracking-tighter">Đã Lĩnh Ngộ!</h3><div className="bg-slate-800 p-5 rounded-2xl border border-purple-500/30 w-full mb-8 text-left shadow-2xl"><div className="flex justify-between items-center mb-3"><span className="text-xl font-bold text-white">{fusionResult.name}</span><span className="text-[10px] font-bold bg-slate-950 px-2 py-1 rounded text-purple-400 border border-purple-800">{fusionResult.type}</span></div><p className="text-slate-300 text-sm leading-relaxed mb-4 italic">{fusionResult.description}</p><div className="text-xs font-mono text-yellow-500 bg-yellow-900/10 inline-block px-3 py-1 rounded-full border border-yellow-700/30">Cảnh giới: {fusionResult.mastery}</div></div><div className="flex gap-3 w-full"><button onClick={cancelFusion} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><RotateCcw size={18} /> QUAY LẠI</button><button onClick={confirmFusion} className="flex-[1.5] py-4 bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 transition-transform active:scale-95"><Check size={20} /> LĨNH NGỘ TUYỆT KỸ</button></div></div>)}</div>)}

      {/* Add Status Modal */}
      {isAddingStatus && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-fade-in items-center justify-center">
           <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white uppercase flex items-center gap-2"><PlusCircle size={18}/> Thêm Trạng Thái</h3>
                <button onClick={() => setIsAddingStatus(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="space-y-3">
                 <div>
                   <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Tên trạng thái</label>
                   <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={newStatusForm.name || ''} onChange={e => setNewStatusForm({...newStatusForm, name: e.target.value})} placeholder="VD: Trúng độc, Cuồng nộ..." />
                 </div>
                 <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Loại</label>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={newStatusForm.type} onChange={e => setNewStatusForm({...newStatusForm, type: e.target.value as any})}>
                          <option value="buff">Buff (Lợi)</option>
                          <option value="debuff">Debuff (Hại)</option>
                          <option value="mental">Tâm Linh</option>
                          <option value="special">Đặc Biệt</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Lượt</label>
                      <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={newStatusForm.duration} onChange={e => setNewStatusForm({...newStatusForm, duration: parseInt(e.target.value)})} />
                    </div>
                 </div>
                 <div>
                   <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Hiệu ứng (Ngắn)</label>
                   <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={newStatusForm.effect || ''} onChange={e => setNewStatusForm({...newStatusForm, effect: e.target.value})} placeholder="VD: -50 HP/lượt, +20% Sát thương" />
                 </div>
                 <div>
                   <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Mô tả chi tiết</label>
                   <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white resize-none h-20" value={newStatusForm.description || ''} onChange={e => setNewStatusForm({...newStatusForm, description: e.target.value})} placeholder="Mô tả nguyên nhân hoặc tác dụng cụ thể..." />
                 </div>
                 <button onClick={handleAddStatus} disabled={!newStatusForm.name} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50"><Check size={18}/> Xác Nhận</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StatusPanel;
