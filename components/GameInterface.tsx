
import React, { useState, useEffect, useRef } from 'react';
import { GameState, NPC, GamePhase, InventoryItem, TroopUnit, Trait, TurnResponse, TraitType, Quest, PlayerNote } from '../types';
import { processTurn, syncGameData, summarizeStory } from '../services/geminiService';
import StatusPanel from './StatusPanel';
import HistoryLog from './HistoryLog';
import { Menu, Users, X, Send, Skull, LogOut, Save, FileText, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, Upload, Eye, EyeOff, Sparkles, Star, Trash2, ChevronDown, Zap, Flag, Link, Shield, MessageCircle, HeartPulse, Activity, Swords, Crown, UserPlus, Users2, RefreshCw, PenLine, PlusCircle, MinusCircle, Check, ArrowUpCircle, ArrowDownCircle, HelpCircle, BookMarked, Pin, StickyNote, Target, ScrollText } from 'lucide-react';

interface Props {
  gameState: GameState;
  updateState: (newState: GameState) => void;
  resetGame: () => void;
}

const ITEMS_PER_PAGE = 10;
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// Helper function to determine style based on system message content
const getSystemMessageStyle = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('thăng cấp') || lower.includes('chúc mừng') || lower.includes('đột phá') || lower.includes('hoàn thành')) {
    return "text-yellow-400 font-bold bg-yellow-950/40 border-yellow-600/50 shadow-[0_0_8px_rgba(250,204,21,0.2)]";
  }
  if (lower.includes('+') || lower.includes('hồi') || lower.includes('nhận') || lower.includes('thu được') || lower.includes('tăng')) {
    return "text-emerald-400 font-bold bg-emerald-950/40 border-emerald-600/50";
  }
  if (lower.includes('-') || lower.includes('sát thương') || lower.includes('mất') || lower.includes('trừ') || lower.includes('bị thương') || lower.includes('trúng đòn')) {
    return "text-red-400 font-bold bg-red-950/40 border-red-800/50 shadow-[0_0_5px_rgba(248,113,113,0.1)]";
  }
  if (lower.includes('kỹ năng') || lower.includes('chiêu') || lower.includes('kích hoạt') || lower.includes('thi triển')) {
    return "text-cyan-400 font-bold bg-cyan-950/40 border-cyan-600/50 shadow-[0_0_5px_rgba(34,211,238,0.15)]";
  }
  if (lower.includes('thiên phú') || lower.includes('hiệu ứng') || lower.includes('trạng thái') || lower.includes('buff') || lower.includes('debuff') || lower.includes('huyết mạch') || lower.includes('thần thể')) {
    return "text-purple-400 font-bold bg-purple-950/40 border-purple-600/50";
  }
  return "text-slate-400 font-mono text-sm bg-slate-800/50 border-slate-600/50";
};

const NarrativeText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const regex = /("[^"]+"|'[^']+'|“[^”]+”|‘[^’]+’|\*[^*]+\*|\[[^\]]+\])/g;
  const parts = text.split(regex);

  return (
    <span className="font-serif text-xl leading-loose text-slate-300">
      {parts.filter(part => part).map((part, i) => {
        const str = part;
        if (
          str.startsWith('"') || 
          str.startsWith("'") || 
          str.startsWith('“') || 
          str.startsWith('‘')
        ) {
          return <span key={i} className="text-sky-300 font-bold drop-shadow-[0_0_5px_rgba(14,165,233,0.3)] bg-sky-400/10 px-1 rounded-sm italic mx-0.5">{str}</span>;
        }
        if (str.startsWith('*')) {
          return <span key={i} className="text-cyan-400 italic font-medium opacity-90 mx-0.5">{str}</span>;
        }
        if (str.startsWith('[')) {
          const content = str.slice(1, -1);
          const styleClass = getSystemMessageStyle(content);
          return <span key={i} className={`inline-block px-2 py-0.5 rounded border mx-0.5 my-0.5 align-middle text-sm tracking-tight ${styleClass}`}>{str}</span>;
        }
        return <span key={i}>{str}</span>;
      })}
    </span>
  );
};

const GameInterface: React.FC<Props> = ({ gameState, updateState, resetGame }) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'status' | 'history' | 'npcs' | 'memory'>('narrative');
  const [socialTab, setSocialTab] = useState<'none' | 'faction' | 'slave' | 'troops'>('none');
  const [actionInput, setActionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [expandedNpcId, setExpandedNpcId] = useState<string | null>(null);
  const [selectedTroopId, setSelectedTroopId] = useState<string | null>(null);
  const [assigningCommanderRole, setAssigningCommanderRole] = useState<'commander' | 'vice' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // NPC Editing State
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null);
  const [newStatusForm, setNewStatusForm] = useState<Partial<Trait>>({ type: 'buff', duration: 3 });

  // Note State
  const [newNote, setNewNote] = useState('');
  const [customRuleInput, setCustomRuleInput] = useState('');

  const narrativeContainerRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(gameState.history.length / ITEMS_PER_PAGE));
  
  useEffect(() => {
    if (gameState.history.length > 0) setCurrentPage(totalPages);
  }, [gameState.history.length, totalPages]);

  useEffect(() => {
    if (narrativeContainerRef.current) narrativeContainerRef.current.scrollTop = 0;
  }, [currentPage]); 

  // --- AUTOMATIC SUMMARIZATION TRIGGER ---
  useEffect(() => {
    const checkAndSummarize = async () => {
      // Summarize every 15 turns
      if (gameState.turnCount > 0 && gameState.turnCount % 15 === 0 && !isProcessing) {
         try {
           const newSummary = await summarizeStory(gameState);
           updateState({ ...gameState, summary: newSummary });
         } catch (e) {
           console.error("Auto-summarize failed", e);
         }
      }
    };
    checkAndSummarize();
  }, [gameState.turnCount]);

  // Reusable function to merge AI response into state
  const handleAIResponse = (result: TurnResponse, actionLabel: string, incrementTurn: boolean) => {
      // --- STATS MERGE --- (Same as original)
      let mergedStats = gameState.character?.stats || [];
      let statHpBonus = 0;
      let statMpBonus = 0;

      if (result.statUpdates?.stats && Array.isArray(result.statUpdates.stats)) {
        mergedStats = mergedStats.map(existingStat => {
          const update = result.statUpdates!.stats!.find((s: any) => s.name === existingStat.name);
          if (update) {
            const delta = update.value - existingStat.value;
            if (delta > 0) {
              if (/thể|sinh|vit|cons|sức|str/i.test(existingStat.name)) statHpBonus += delta * 10;
              if (/thần|trí|int|wis|mana|hồn/i.test(existingStat.name)) statMpBonus += delta * 10;
            }
            return { ...existingStat, value: update.value };
          }
          return existingStat;
        });
      }

      let mergedResistances = [...(gameState.character?.resistances || [])];
      if (result.statUpdates?.resistances && Array.isArray(result.statUpdates.resistances)) {
        const resUpdates = result.statUpdates.resistances;
        mergedResistances = mergedResistances.map(existingRes => {
          const update = resUpdates.find((u: any) => u.name === existingRes.name);
          return update ? { ...existingRes, value: update.value } : existingRes; 
        });
      }

      // --- SKILL MERGE (ENHANCED) ---
      let mergedSkills = [...(gameState.character?.skills || [])];
      if (result.statUpdates?.skills && Array.isArray(result.statUpdates.skills)) {
        result.statUpdates.skills.forEach((skillUpdate: any) => {
           // Case insensitive matching to prevent duplicates
           const updateName = skillUpdate.name.trim().toLowerCase();
           const index = mergedSkills.findIndex(s => s.name.trim().toLowerCase() === updateName);
           
           if (index !== -1) {
             // Update existing skill info (Mastery, Description, Rank)
             mergedSkills[index] = { 
                ...mergedSkills[index], 
                ...skillUpdate, 
                // Preserve ID and Image
                id: mergedSkills[index].id, 
                imageUrl: mergedSkills[index].imageUrl,
                // Preserve Name casing unless explicitly changed
                name: mergedSkills[index].name
             };
           } else {
             // Add New Skill
             mergedSkills.push({ 
                id: skillUpdate.id || generateId(), 
                type: 'Special', // Default type if missing
                mastery: 'Sơ nhập', // Default mastery if missing
                description: 'Kỹ năng mới lĩnh ngộ.', 
                ...skillUpdate 
             });
           }
        });
      }

      if (result.removedSkillIds?.length) mergedSkills = mergedSkills.filter(s => !result.removedSkillIds!.includes(s.id));

      let currentInjuries = gameState.character?.permanentInjuries || [];
      if (result.statUpdates?.permanentInjuries !== undefined) currentInjuries = result.statUpdates.permanentInjuries;

      // --- INVENTORY MERGE ---
      let currentInventory = [...(gameState.character?.inventory || [])];
      
      // Handle ID based removals
      if (result.removedInventoryIds?.length) {
        currentInventory = currentInventory.filter(item => !result.removedInventoryIds!.includes(item.id));
      }

      // Handle Additions & Updates (including reduction via negative quantity)
      if (result.addedInventoryItems?.length) {
        result.addedInventoryItems.forEach(newItem => {
           const qty = Number(newItem.quantity) || 1;
           const stackableCategories = ['consumable', 'material', 'currency'];
           
           // Normalize for comparison
           const newItemName = newItem.name?.toLowerCase().trim();
           const newItemCategory = newItem.category?.toLowerCase().trim();

           // Try to find existing stackable item
           const existingIndex = currentInventory.findIndex(i => 
             i.name.toLowerCase().trim() === newItemName && 
             (i.category.toLowerCase().trim() === newItemCategory || stackableCategories.includes(i.category))
           );

           if (existingIndex !== -1 && stackableCategories.includes(currentInventory[existingIndex].category)) {
              // Update quantity
              const newQuantity = currentInventory[existingIndex].quantity + qty;
              if (newQuantity <= 0) {
                 // Remove if quantity depleted
                 currentInventory.splice(existingIndex, 1);
              } else {
                 currentInventory[existingIndex] = { ...currentInventory[existingIndex], quantity: newQuantity };
              }
           } else if (qty > 0) {
              // Add new item only if positive quantity
              currentInventory.push({ 
                ...newItem, 
                id: newItem.id || generateId(),
                quantity: qty 
              });
           }
        });
      }

      // --- TRAITS MERGE ---
      let bloodlines = [...(gameState.character?.bloodlines || [])];
      let divineBodies = [...(gameState.character?.divineBodies || [])];
      let activeStatuses = [...(gameState.character?.activeStatuses || [])];

      if (incrementTurn) {
        activeStatuses = activeStatuses.map(s => {
          if (s.duration !== undefined && s.duration > 0) return { ...s, duration: s.duration - 1 };
          return s;
        }).filter(s => s.duration === undefined || s.duration > 0);
      }

      if (result.traitUpdates) {
        result.traitUpdates.forEach(update => {
          let targetList: Trait[] | null = null;
          if (update.type === 'bloodline') targetList = bloodlines;
          else if (update.type === 'divine_body') targetList = divineBodies;
          else targetList = activeStatuses;

          if (targetList) {
             const existingIdx = targetList.findIndex(t => t.name === update.name);
             
             if (update.isRemoved) {
               if (existingIdx !== -1) targetList.splice(existingIdx, 1);
             } else {
               const newTrait: Trait = {
                 id: existingIdx !== -1 ? targetList[existingIdx].id : generateId(),
                 name: update.name,
                 type: update.type,
                 description: update.description || (existingIdx !== -1 ? targetList[existingIdx].description : ""),
                 quality: update.quality || (existingIdx !== -1 ? targetList[existingIdx].quality : undefined),
                 duration: update.setDuration !== undefined ? update.setDuration : 
                           (existingIdx !== -1 && targetList[existingIdx].duration !== undefined 
                             ? targetList[existingIdx].duration! + (update.durationChange || 0) 
                             : update.durationChange),
                 effect: (existingIdx !== -1 ? targetList[existingIdx].effect : undefined) // Persist manual effect if any
               };
               if (existingIdx !== -1) targetList[existingIdx] = newTrait;
               else targetList.push(newTrait);
             }
          }
        });
      }

      // --- ACHIEVEMENTS MERGE ---
      let updatedAchievements = [...(gameState.character?.achievements || [])];
      if (result.unlockedAchievementIds && result.unlockedAchievementIds.length > 0) {
        updatedAchievements = updatedAchievements.map(ach => {
          if (result.unlockedAchievementIds!.includes(ach.id) && !ach.isUnlocked) {
            return { ...ach, isUnlocked: true };
          }
          return ach;
        });
      }

      // --- QUESTS MERGE ---
      let updatedQuests = [...(gameState.character?.quests || [])];
      if (result.questUpdates && result.questUpdates.length > 0) {
        result.questUpdates.forEach(qUpdate => {
           // Try to find existing by name or ID
           const index = updatedQuests.findIndex(q => q.name === qUpdate.name || q.id === qUpdate.id);
           if (index !== -1) {
             // Update
             updatedQuests[index] = {
               ...updatedQuests[index],
               status: qUpdate.status,
               description: qUpdate.description || updatedQuests[index].description,
               progress: qUpdate.progress || updatedQuests[index].progress
             };
           } else if (qUpdate.status === 'active') {
             // New Quest
             updatedQuests.push({
               id: generateId(),
               name: qUpdate.name,
               description: qUpdate.description || "Nhiệm vụ mới.",
               status: 'active',
               progress: qUpdate.progress
             });
           }
        });
      }

      // --- NPC MERGE (ENHANCED) ---
      const incomingNewNpcs = result.newNpcs || [];
      const incomingUpdates = result.npcUpdates || [];
      const npcMap = new Map<string, NPC>();
      const npcNameMap = new Map<string, string>(); // Name (lowercase) -> ID

      // Pre-populate maps with existing NPCs
      gameState.npcs.forEach(npc => {
        npcMap.set(npc.id, npc);
        if (npc.name) npcNameMap.set(npc.name.toLowerCase().trim(), npc.id);
      });

      // 1. Tick down duration for ALL existing NPCs if turning
      if (incrementTurn) {
         for (const [id, npc] of npcMap.entries()) {
            if (npc.activeStatuses && npc.activeStatuses.length > 0) {
              const updatedStatuses = npc.activeStatuses.map(s => {
                 if (s.duration !== undefined && s.duration > 0) return { ...s, duration: s.duration - 1 };
                 return s;
              }).filter(s => s.duration === undefined || s.duration > 0);
              npcMap.set(id, { ...npc, activeStatuses: updatedStatuses });
            }
         }
      }

      // 2. Handle New NPCs (Try to avoid duplicates by checking name)
      incomingNewNpcs.forEach(newNpc => {
        const normName = newNpc.name.toLowerCase().trim();
        let matchId = newNpc.id || npcNameMap.get(normName);
        
        if (matchId && npcMap.has(matchId)) {
           // Exists: Update it instead of creating new
           const existing = npcMap.get(matchId)!;
           npcMap.set(matchId, { ...existing, ...newNpc, id: matchId, activeStatuses: newNpc.activeStatuses || existing.activeStatuses || [] });
        } else {
           // Create new
           const newId = newNpc.id || generateId();
           npcMap.set(newId, { 
             ...newNpc, 
             id: newId, 
             affiliation: newNpc.affiliation || 'none', 
             relation: newNpc.relation || 'neutral', 
             notes: newNpc.notes || "Nhân vật mới.", 
             isDead: newNpc.isDead || false, 
             activeStatuses: newNpc.activeStatuses || [] 
           });
           npcNameMap.set(normName, newId);
        }
      });

      // 3. Handle Updates (Robust lookup by ID -> Name -> Create)
      incomingUpdates.forEach(update => {
         let targetId = update.id;
         
         // If ID not found, try to match by Name
         if (!npcMap.has(targetId) && update.name) {
             const normName = update.name.toLowerCase().trim();
             const foundId = npcNameMap.get(normName);
             if (foundId) targetId = foundId;
         }

         if (npcMap.has(targetId)) {
            const existing = npcMap.get(targetId)!;
            // Merge statuses
            let mergedNpcStatuses = [...(existing.activeStatuses || [])];
            if (update.activeStatuses) {
               update.activeStatuses.forEach(newS => {
                  const idx = mergedNpcStatuses.findIndex(s => s.name === newS.name);
                  if (idx !== -1) mergedNpcStatuses[idx] = { ...mergedNpcStatuses[idx], ...newS };
                  else mergedNpcStatuses.push({ id: generateId(), ...newS });
               });
            }

            npcMap.set(targetId, { 
              ...existing, 
              ...update, 
              id: targetId, // Ensure ID is preserved
              name: update.name || existing.name, 
              isDead: update.isDead !== undefined ? update.isDead : existing.isDead,
              activeStatuses: mergedNpcStatuses
            });
         } else {
             // Orphan update -> Treat as New Character
             const orphanName = (update as any).name || "Nhân vật bí ẩn";
             const newId = update.id || generateId();
             npcMap.set(newId, { 
               id: newId, 
               name: orphanName, 
               relation: update.relation || 'neutral', 
               affiliation: update.affiliation || 'none', 
               notes: update.notes || "Thông tin được cập nhật.", 
               levelName: update.levelName, 
               emotion: update.emotion, 
               currentActivity: update.currentActivity, 
               isDead: update.isDead || false, 
               activeStatuses: update.activeStatuses || [], 
               ...update 
             } as NPC);
             npcNameMap.set(orphanName.toLowerCase().trim(), newId);
         }
      });
      const finalNpcs = Array.from(npcMap.values());

      // --- FINAL CHARACTER ---
      const cleanStatUpdates = { ...result.statUpdates };
      delete cleanStatUpdates.stats;
      delete cleanStatUpdates.skills; // Don't allow basic spread to overwrite the merged skills
      delete cleanStatUpdates.permanentInjuries; 
      delete cleanStatUpdates.resistances; 

      let finalMaxHp = cleanStatUpdates.maxHp ?? gameState.character?.maxHp ?? 100;
      let finalMaxMana = cleanStatUpdates.maxMana ?? gameState.character?.maxMana ?? 50;
      if (cleanStatUpdates.maxHp === undefined) finalMaxHp += statHpBonus;
      if (cleanStatUpdates.maxMana === undefined) finalMaxMana += statMpBonus;

      let finalHp = cleanStatUpdates.hp ?? gameState.character?.hp ?? 100;
      let finalMana = cleanStatUpdates.mana ?? gameState.character?.mana ?? 50;
      
      let updatedCharacter = gameState.character ? {
        ...gameState.character,
        ...cleanStatUpdates,
        stats: mergedStats,
        skills: mergedSkills,
        resistances: mergedResistances,
        permanentInjuries: currentInjuries,
        inventory: currentInventory,
        bloodlines: bloodlines,
        divineBodies: divineBodies,
        activeStatuses: activeStatuses,
        achievements: updatedAchievements,
        quests: updatedQuests,
        maxHp: finalMaxHp,
        maxMana: finalMaxMana,
        hp: finalHp,
        mana: finalMana
      } : null;

      if (updatedCharacter && gameState.character && updatedCharacter.level > gameState.character.level) {
          const oldThreshold = gameState.character.expToNextLevel;
          if (updatedCharacter.expToNextLevel <= oldThreshold) {
              const diff = updatedCharacter.level - gameState.character.level;
              updatedCharacter.expToNextLevel = Math.floor(oldThreshold * Math.pow(1.5, diff));
          }
      }
      if (updatedCharacter) {
        while (updatedCharacter.exp >= updatedCharacter.expToNextLevel) {
            updatedCharacter.exp -= updatedCharacter.expToNextLevel;
            updatedCharacter.level += 1;
            updatedCharacter.expToNextLevel = Math.floor(updatedCharacter.expToNextLevel * 1.5);
        }
        if (updatedCharacter.hp > updatedCharacter.maxHp) updatedCharacter.hp = updatedCharacter.maxHp;
        if (updatedCharacter.mana > updatedCharacter.maxMana) updatedCharacter.mana = updatedCharacter.maxMana;
      }

      // --- TROOP UPDATES ---
      let updatedTroops = [...(gameState.troops || [])];
      if (result.troopUpdates && result.troopUpdates.length > 0) {
        result.troopUpdates.forEach(update => {
           const existingIndex = updatedTroops.findIndex(t => t.name === update.name);
           if (existingIndex !== -1) {
             const newQuantity = Math.max(0, updatedTroops[existingIndex].quantity + update.quantityChange);
             updatedTroops[existingIndex] = {
               ...updatedTroops[existingIndex],
               name: update.renameTo || updatedTroops[existingIndex].name,
               quantity: newQuantity,
               description: update.description || updatedTroops[existingIndex].description
             };
           } else if (update.quantityChange > 0) {
             updatedTroops.push({
               id: generateId(),
               name: update.renameTo || update.name,
               quantity: update.quantityChange,
               description: update.description || "Đơn vị quân mới.",
               viceCommanderIds: []
             });
           }
        });
      }

      let historyResult = result.historyLog?.result;
      if (!historyResult || historyResult.trim() === "..." || historyResult.trim() === "") {
         const narrativeClean = result.narrative.replace(/["*\[\]]/g, "");
         const firstSentence = narrativeClean.split(/[.!?]/)[0];
         historyResult = firstSentence.length > 50 ? firstSentence.substring(0, 50) + "..." : firstSentence;
      }
      
      const newHistoryEntry = {
            id: generateId(),
            turn: incrementTurn ? gameState.turnCount + 1 : gameState.turnCount,
            action: result.historyLog?.action || actionLabel,
            result: historyResult,
            narrative: result.narrative,
            type: result.historyLog?.type || 'info'
      };

      const shouldAddToHistory = incrementTurn || !!result.narrative;
      const newHistory = shouldAddToHistory ? [...gameState.history, newHistoryEntry] : gameState.history;

      const newState: GameState = {
        ...gameState,
        turnCount: incrementTurn ? gameState.turnCount + 1 : gameState.turnCount,
        lastNarrative: result.narrative || gameState.lastNarrative, 
        suggestedActions: result.suggestedActions || gameState.suggestedActions, 
        character: updatedCharacter,
        history: newHistory,
        npcs: finalNpcs,
        troops: updatedTroops,
        memory: result.memory || gameState.memory // --- NEW: Update memory from AI
      };

      if (result.isGameOver) {
         newState.phase = GamePhase.GAME_OVER;
         newState.error = result.gameOverReason || "Định mệnh đã an bài.";
      }

      updateState(newState);
  };

  const handleAction = async (forcedAction?: string) => {
    const inputToSend = forcedAction || actionInput;
    if (!inputToSend.trim() || isProcessing) return;
    setIsProcessing(true);
    setActionInput('');
    try {
      const result = await processTurn(gameState, inputToSend);
      handleAIResponse(result, inputToSend, true);
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối AI. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSync = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await syncGameData(gameState);
      handleAIResponse(result, "Đồng bộ dữ liệu", false);
    } catch (e) {
      console.error(e);
      alert("Lỗi đồng bộ: " + e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAction();
    }
  };

  const handleSaveGame = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `save_${gameState.character?.name}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setShowExitMenu(false);
  };

  const handleAddRule = () => {
    if (!customRuleInput.trim()) return;
    const newRules = [...(gameState.customRules || []), customRuleInput];
    updateState({ ...gameState, customRules: newRules });
    setCustomRuleInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) updateState({ ...gameState, customRules: [...(gameState.customRules || []), ...text.split('\n').filter(l => l.trim().length > 0)] });
    };
    reader.readAsText(file);
  };

  // --- MEMORY & NOTES HANDLERS ---
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: PlayerNote = { id: generateId(), content: newNote, isImportant: false };
    updateState({ ...gameState, playerNotes: [...(gameState.playerNotes || []), note] });
    setNewNote('');
  };

  const toggleNoteImportance = (id: string) => {
    const updatedNotes = (gameState.playerNotes || []).map(n => n.id === id ? { ...n, isImportant: !n.isImportant } : n);
    updateState({ ...gameState, playerNotes: updatedNotes });
  };

  const deleteNote = (id: string) => {
    const updatedNotes = (gameState.playerNotes || []).filter(n => n.id !== id);
    updateState({ ...gameState, playerNotes: updatedNotes });
  };

  // --- NPC MANAGEMENT ---

  const toggleNpcLock = (npcId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateState({ ...gameState, npcs: gameState.npcs.map(npc => npc.id === npcId ? { ...npc, isLocked: !npc.isLocked } : npc) });
  };

  const deleteNpc = (npcId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gameState.npcs.find(n => n.id === npcId)?.isLocked) updateState({ ...gameState, npcs: gameState.npcs.filter(n => n.id !== npcId) });
  };

  const moveNpc = (npcId: string, affiliation: 'none' | 'faction' | 'slave', e: React.MouseEvent) => {
    e.stopPropagation();
    updateState({ ...gameState, npcs: gameState.npcs.map(npc => npc.id === npcId ? { ...npc, affiliation } : npc) });
  };

  const toggleExpandNpc = (npcId: string) => setExpandedNpcId(expandedNpcId === npcId ? null : npcId);

  // NPC Editing Functions
  const startEditingNpc = (npc: NPC, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNpc({ ...npc });
    setNewStatusForm({ type: 'buff', duration: 3 });
  };

  const saveNpcChanges = () => {
    if (!editingNpc) return;
    const newNpcs = gameState.npcs.map(n => n.id === editingNpc.id ? editingNpc : n);
    updateState({ ...gameState, npcs: newNpcs });
    setEditingNpc(null);
  };

  const addStatusToNpc = () => {
    if (!editingNpc || !newStatusForm.name) return;
    const newStatus: Trait = {
       id: generateId(),
       name: newStatusForm.name,
       type: newStatusForm.type as TraitType,
       duration: newStatusForm.duration,
       description: newStatusForm.description || '',
       effect: newStatusForm.effect || ''
    };
    setEditingNpc({
      ...editingNpc,
      activeStatuses: [...(editingNpc.activeStatuses || []), newStatus]
    });
    setNewStatusForm({ type: 'buff', duration: 3, name: '', description: '', effect: '' });
  };

  const removeStatusFromNpc = (statusId: string) => {
    if (!editingNpc) return;
    setEditingNpc({
      ...editingNpc,
      activeStatuses: (editingNpc.activeStatuses || []).filter(s => s.id !== statusId)
    });
  };

  // --- TROOP MANAGEMENT ---
  const assignCommander = (npcId: string) => {
    if (!selectedTroopId || !assigningCommanderRole) return;
    const newTroops = gameState.troops.map(t => {
      if (t.id === selectedTroopId) {
        if (assigningCommanderRole === 'commander') return { ...t, commanderId: npcId };
        else if (!t.viceCommanderIds?.includes(npcId)) return { ...t, viceCommanderIds: [...(t.viceCommanderIds || []), npcId] };
      }
      return t;
    });
    updateState({ ...gameState, troops: newTroops });
    setAssigningCommanderRole(null);
  };

  const removeCommander = (troopId: string, role: 'commander' | 'vice', npcId?: string) => {
    const newTroops = gameState.troops.map(t => {
      if (t.id === troopId) {
        if (role === 'commander') return { ...t, commanderId: undefined };
        else if (role === 'vice' && npcId) return { ...t, viceCommanderIds: t.viceCommanderIds?.filter(id => id !== npcId) || [] };
      }
      return t;
    });
    updateState({ ...gameState, troops: newTroops });
  };

  // Helper to group NPCs
  const groupNpcs = (npcs: NPC[]) => {
    const groups: { [key: string]: NPC[] } = {};
    const ungrouped: NPC[] = [];
    
    npcs.forEach(npc => {
      if (npc.group) {
        if (!groups[npc.group]) groups[npc.group] = [];
        groups[npc.group].push(npc);
      } else {
        ungrouped.push(npc);
      }
    });
    
    return { groups, ungrouped };
  };

  const currentLogs = gameState.history.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const filteredNpcs = gameState.npcs.filter(npc => (npc.affiliation || 'none') === socialTab);
  const { groups, ungrouped } = groupNpcs(filteredNpcs);
  const factionNpcs = gameState.npcs.filter(npc => npc.affiliation === 'faction' && !npc.isDead);
  const selectedTroop = gameState.troops?.find(t => t.id === selectedTroopId);

  const getTroopTabName = () => {
    const genre = gameState.world?.genre?.toLowerCase() || '';
    if (genre.includes('tu tiên') || genre.includes('tiên hiệp')) return 'Đệ Tử / Đạo Binh';
    if (genre.includes('chiến tranh') || genre.includes('war')) return 'Quân Đội';
    return 'Binh Chủng';
  };

  const getNpcCardStyle = (affiliation: 'none' | 'faction' | 'slave', isExpanded: boolean, isDead?: boolean) => {
    if (isDead) return "rounded border transition-all cursor-pointer bg-slate-900 border-slate-800 opacity-60 grayscale";
    const base = "rounded border transition-all cursor-pointer ";
    switch (affiliation) {
      case 'faction': return base + (isExpanded ? "bg-indigo-900/20 border-indigo-400 shadow-lg" : "bg-indigo-900/10 border-indigo-800 hover:border-indigo-600");
      case 'slave': return base + (isExpanded ? "bg-rose-900/20 border-rose-400 shadow-lg" : "bg-rose-900/10 border-rose-800 hover:border-rose-600");
      default: return base + (isExpanded ? "bg-slate-800 border-blue-500 shadow-lg" : "bg-slate-800 border-slate-700 hover:border-slate-600");
    }
  };

  const renderNpcCard = (npc: NPC) => {
    const isExpanded = expandedNpcId === npc.id;
    const affiliation = npc.affiliation || 'none';
    return (
      <div key={npc.id} onClick={() => toggleExpandNpc(npc.id)} className={getNpcCardStyle(affiliation, isExpanded, npc.isDead)}>
        <div className="p-3">
          <div className="flex items-center gap-3">
             <button onClick={(e) => toggleNpcLock(npc.id, e)} className={`p-1 rounded-full transition-colors ${npc.isLocked ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}><Star size={18} fill={npc.isLocked ? "currentColor" : "none"} /></button>
             <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                   <span className={`font-bold ${affiliation === 'faction' ? 'text-indigo-200' : affiliation === 'slave' ? 'text-rose-200' : 'text-slate-200'} ${npc.isDead ? 'line-through text-slate-500' : ''}`}>{npc.name}</span>
                   {npc.gender && <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 px-1 rounded">{npc.gender}</span>}
                   <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${npc.isDead ? 'bg-black text-slate-500 border border-slate-700' : npc.relation === 'hostile' || npc.relation === 'nemesis' ? 'bg-red-900 text-red-300' : npc.relation === 'friendly' || npc.relation === 'devoted' ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-300'}`}>{npc.isDead ? 'ĐÃ CHẾT' : npc.relation}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                   {npc.isDead ? <Skull size={10} className="text-slate-500" /> : <Zap size={10} className="text-yellow-500" />}
                   <span className={`text-[10px] font-bold uppercase tracking-tighter ${npc.isDead ? 'text-slate-600' : 'text-yellow-500'}`}>{npc.levelName || `Cấp ${npc.level || 1}`}</span>
                   {/* Improved Status Icons */}
                   {npc.activeStatuses && npc.activeStatuses.length > 0 && (
                      <div className="flex items-center gap-1 ml-1">
                        {npc.activeStatuses.slice(0, 3).map((s, idx) => (
                           <div key={idx} className="group relative" title={`${s.name}: ${s.description}`}>
                              {s.type === 'debuff' ? (
                                <ArrowDownCircle size={12} className="text-red-400" />
                              ) : (
                                <ArrowUpCircle size={12} className="text-emerald-400" />
                              )}
                           </div>
                        ))}
                        {npc.activeStatuses.length > 3 && <span className="text-[9px] text-slate-500">+{npc.activeStatuses.length - 3}</span>}
                      </div>
                   )}
                </div>
                {!isExpanded && (<div className="mt-1 text-xs text-slate-400 truncate w-48 animate-fade-in">{npc.currentActivity ? (<span className="text-blue-300 italic flex items-center gap-1"><Activity size={10} /> {npc.currentActivity}</span>) : (npc.notes)}</div>)}
             </div>
             <div className="flex gap-1">
                <button onClick={(e) => startEditingNpc(npc, e)} className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors"><PenLine size={16} /></button>
                {!npc.isLocked && (<button onClick={(e) => deleteNpc(npc.id, e)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>)}
             </div>
             <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 animate-fade-in border-t border-slate-700/10 mt-1">
            <div className="pt-2 text-[9px] text-slate-500 font-mono mb-2 flex justify-between"><span>ID: {npc.id}</span></div>
            <div className={`p-3 rounded space-y-3 ${affiliation === 'faction' ? 'bg-indigo-950/40' : affiliation === 'slave' ? 'bg-rose-950/40' : 'bg-slate-900/50'}`}>
               <div className="flex gap-2 text-xs mb-2">
                 <button onClick={(e) => moveNpc(npc.id, 'none', e)} className={`flex-1 py-1 rounded border ${affiliation === 'none' ? 'bg-slate-700 text-white' : 'bg-slate-900/50 text-slate-500 hover:bg-slate-800'}`}>Tự Do</button>
                 <button onClick={(e) => moveNpc(npc.id, 'faction', e)} className={`flex-1 py-1 rounded border ${affiliation === 'faction' ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-900/50 text-slate-500 hover:bg-indigo-900/30'}`}>Thế Lực</button>
                 <button onClick={(e) => moveNpc(npc.id, 'slave', e)} className={`flex-1 py-1 rounded border ${affiliation === 'slave' ? 'bg-rose-900 text-rose-200' : 'bg-slate-900/50 text-slate-500 hover:bg-rose-900/30'}`}>Nô Lệ</button>
               </div>
               
               {/* Detailed Appearance */}
               {(npc.hairColor || npc.eyeColor || npc.bodyType) && (
                 <div className="bg-black/20 p-2 rounded border border-white/5 grid grid-cols-3 gap-1 text-[10px]">
                    <div className="text-slate-400">Tóc: <span className="text-slate-200">{npc.hairColor || '-'}</span></div>
                    <div className="text-slate-400">Mắt: <span className="text-slate-200">{npc.eyeColor || '-'}</span></div>
                    <div className="text-slate-400">Dáng: <span className="text-slate-200">{npc.bodyType || '-'}</span></div>
                 </div>
               )}

               {(npc.emotion || npc.currentActivity) && (<div className="bg-black/20 p-2.5 rounded border border-white/5 space-y-2">{npc.emotion && (<div className="flex items-center gap-2 text-pink-300"><HeartPulse size={14} className="shrink-0" /> <span className="text-xs font-bold uppercase tracking-wide">Cảm xúc:</span><span className="text-sm italic">{npc.emotion}</span></div>)}{npc.currentActivity && (<div className="flex items-start gap-2 text-blue-300"><MessageCircle size={14} className="shrink-0 mt-0.5" /> <span className="text-xs font-bold uppercase tracking-wide whitespace-nowrap">Hoạt động:</span><span className="text-sm italic leading-tight">{npc.currentActivity}</span></div>)}</div>)}
               
               {/* Improved Active Statuses Display */}
               {npc.activeStatuses && npc.activeStatuses.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Hiệu ứng đang chịu</span>
                    <div className="grid grid-cols-1 gap-1">
                      {npc.activeStatuses.map(s => (
                        <div key={s.id} className={`text-xs px-2 py-1 rounded border flex justify-between items-center ${s.type === 'buff' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300' : 'bg-red-900/30 border-red-800 text-red-300'}`} title={s.description}>
                          <div className="flex items-center gap-1">
                             {s.type === 'buff' ? <ArrowUpCircle size={12}/> : <ArrowDownCircle size={12}/>}
                             <span className="font-bold">{s.name}</span>
                          </div>
                          {s.duration && <span className="font-mono text-[10px] bg-black/30 px-1 rounded">{s.duration}t</span>}
                        </div>
                      ))}
                    </div>
                  </div>
               )}

               <div><span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 flex items-center gap-1"><FileText size={10} /> Ghi chú</span><p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{npc.notes || "Chưa có thông tin chi tiết."}</p></div>
               {npc.isDead && (<div className="bg-red-950/50 border border-red-900 p-2 rounded text-center"><Skull className="mx-auto text-red-500 mb-1" size={16} /><span className="text-xs font-bold text-red-400 uppercase">Đã Tử Vong</span></div>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (gameState.phase === GamePhase.GAME_OVER) {
    return (
      <div className="flex flex-col h-screen max-w-md mx-auto bg-black text-white items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542259681-d2b3887eb338?q=80&w=1000&auto=format&fit=crop')] opacity-20 bg-cover bg-center grayscale mix-blend-overlay"></div>
        <div className="z-10 text-center space-y-6 animate-fade-in">
          <Skull size={64} className="mx-auto text-red-600 mb-4 animate-pulse" />
          <h1 className="text-4xl font-serif font-bold text-red-600 uppercase tracking-widest">Tử Vong</h1>
          <p className="text-slate-400 text-lg italic max-w-xs mx-auto">"{gameState.error}"</p>
          <div className="h-px w-24 bg-red-900 mx-auto my-6"></div>
          <div className="space-y-3 w-full max-w-xs mx-auto">
             <button onClick={resetGame} className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded font-bold transition-colors">Màn Hình Chính</button>
             <button onClick={handleSaveGame} className="w-full py-3 bg-blue-900/50 hover:bg-blue-800 border border-blue-800 rounded font-bold transition-colors">Lưu Di Sản (Log)</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 relative overflow-hidden shadow-2xl border-x border-slate-800">
      <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-800 z-20">
        <div className="flex gap-3 text-xs font-mono">
           <div className="flex items-center gap-1 text-red-400"><span className="font-bold">HP</span><div className="w-16 h-2 bg-slate-800 rounded-full"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(gameState.character!.hp / gameState.character!.maxHp) * 100}%`}}></div></div></div>
           <div className="flex items-center gap-1 text-blue-400"><span className="font-bold">MP</span><div className="w-16 h-2 bg-slate-800 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(gameState.character!.mana / gameState.character!.maxMana) * 100}%`}}></div></div></div>
        </div>
        
        <div className="flex items-center gap-2"><div className="text-xs text-slate-500 font-mono">Lượt: {gameState.turnCount}</div><button onClick={() => setShowExitMenu(true)} className="p-1 text-slate-400 hover:text-white"><LogOut size={16} /></button></div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div ref={narrativeContainerRef} className={`absolute inset-0 bg-slate-950 overflow-y-auto p-4 pb-48 transition-transform duration-300 ${activeTab === 'narrative' ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="space-y-8">
             {totalPages > 1 && (<div className="flex justify-between items-center text-xs text-slate-500 pb-2 border-b border-slate-800"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button><span>Trang {currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button></div>)}
             {currentLogs.map((log) => (
               <div key={log.id} className="animate-fade-in">
                 <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 font-mono opacity-50"><span>#{log.turn}</span><span className="h-[1px] flex-1 bg-slate-800"></span></div>
                 <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-slate-100 max-w-none"><p className="whitespace-pre-wrap"><NarrativeText text={log.narrative || log.result} /></p></div>
               </div>
             ))}
             <div className="fixed right-4 bottom-32 flex flex-col gap-2 z-10 opacity-50 hover:opacity-100 transition-opacity">
                <button onClick={() => narrativeContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="p-2 bg-slate-800 rounded-full text-white border border-slate-600 shadow-lg"><ArrowUp size={20} /></button>
                <button onClick={() => narrativeContainerRef.current?.scrollTo({ top: narrativeContainerRef.current.scrollHeight, behavior: 'smooth' })} className="p-2 bg-slate-800 rounded-full text-white border border-slate-600 shadow-lg"><ArrowDown size={20} /></button>
             </div>
           </div>
        </div>

        <div className={`absolute inset-0 z-10 transition-transform duration-300 ${activeTab === 'status' ? 'translate-x-0' : 'translate-x-full'}`}>
          <StatusPanel character={gameState.character!} world={gameState.world!} onCharacterUpdate={(newChar) => updateState({...gameState, character: newChar})} />
        </div>

        <div className={`absolute inset-0 z-10 bg-slate-900 p-4 transition-transform duration-300 ${activeTab === 'rules' ? 'translate-x-0' : 'translate-x-full'}`}>
           <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2"><FileText size={16} /> Luật Lệ Tuyệt Đối</h3>
           <div className="mb-4 space-y-2"><div className="flex gap-2"><input className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm" placeholder="Thêm luật mới..." value={customRuleInput} onChange={e => setCustomRuleInput(e.target.value)} /><button onClick={handleAddRule} className="px-3 bg-blue-600 text-white rounded font-bold">+</button></div><label className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded cursor-pointer hover:bg-slate-700"><Upload size={16} className="text-slate-400" /><span className="text-sm text-slate-300">Tải file luật (.txt)</span><input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" /></label></div>
           <div className="space-y-2 max-h-[60vh] overflow-y-auto">{(gameState.customRules || []).map((rule, idx) => (<div key={idx} className="bg-slate-800/50 p-3 rounded border border-slate-700 text-sm text-yellow-100 font-mono">{idx + 1}. {rule}</div>))}</div>
        </div>

        <div className={`absolute inset-0 z-10 transition-transform duration-300 ${activeTab === 'history' ? 'translate-x-0' : 'translate-x-full'}`}>
          <HistoryLog history={gameState.history} />
        </div>

        <div className={`absolute inset-0 z-10 bg-slate-900 p-4 transition-transform duration-300 ${activeTab === 'npcs' ? 'translate-x-0' : 'translate-x-full'}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2 overflow-x-auto pb-1 flex-1 no-scrollbar">
                  <button onClick={() => setSocialTab('none')} className={`flex-1 min-w-[70px] py-2 rounded text-[10px] font-bold uppercase border transition-colors flex flex-col items-center gap-1 ${socialTab === 'none' ? 'bg-slate-800 border-blue-500 text-blue-400 shadow-md' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}><Users size={16} /> Quan Hệ</button>
                  <button onClick={() => setSocialTab('faction')} className={`flex-1 min-w-[70px] py-2 rounded text-[10px] font-bold uppercase border transition-colors flex flex-col items-center gap-1 ${socialTab === 'faction' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400 shadow-md' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-indigo-400'}`}><Flag size={16} /> Thế Lực</button>
                  <button onClick={() => setSocialTab('slave')} className={`flex-1 min-w-[70px] py-2 rounded text-[10px] font-bold uppercase border transition-colors flex flex-col items-center gap-1 ${socialTab === 'slave' ? 'bg-rose-900/40 border-rose-500 text-rose-400 shadow-md' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-rose-400'}`}><Link size={16} /> Nô Lệ</button>
                  <button onClick={() => setSocialTab('troops')} className={`flex-1 min-w-[70px] py-2 rounded text-[10px] font-bold uppercase border transition-colors flex flex-col items-center gap-1 ${socialTab === 'troops' ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400 shadow-md' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-emerald-400'}`}><Swords size={16} /> {getTroopTabName()}</button>
              </div>
              <button onClick={handleSync} disabled={isProcessing} className="ml-2 p-2 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-colors" title="Đồng bộ hóa dữ liệu NPC/Quân đội từ cốt truyện">
                 <RefreshCw size={18} className={isProcessing ? "animate-spin" : ""} />
              </button>
           </div>
           
           <div className="space-y-3 overflow-y-auto max-h-[75vh] pb-32">
             {socialTab === 'troops' && (<>{(!gameState.troops || gameState.troops.length === 0) && (<p className="text-slate-600 text-sm italic text-center py-4">Chưa chiêu mộ binh chủng nào.</p)}{(gameState.troops || []).map(troop => (<div key={troop.id} onClick={() => setSelectedTroopId(troop.id)} className="bg-emerald-950/20 border border-emerald-900/50 hover:border-emerald-600 hover:bg-emerald-950/40 rounded p-3 transition-all cursor-pointer"><div className="flex justify-between items-start mb-2"><h4 className="text-emerald-300 font-bold flex items-center gap-2"><Users2 size={16} /> {troop.name}</h4><span className="bg-emerald-900 text-emerald-100 font-mono font-bold text-xs px-2 py-0.5 rounded border border-emerald-700">x{troop.quantity}</span></div><p className="text-xs text-slate-400 italic mb-2 line-clamp-2">{troop.description}</p><div className="flex gap-2 text-[10px]">{troop.commanderId ? (<span className="flex items-center gap-1 text-indigo-300 bg-indigo-900/30 px-1.5 py-0.5 rounded"><Crown size={10} /> {gameState.npcs.find(n => n.id === troop.commanderId)?.name || "Unknown"}</span>) : (<span className="flex items-center gap-1 text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-dashed border-slate-600"><Crown size={10} /> Trống</span>)}</div></div>))}</>)}
             
             {socialTab !== 'troops' && (
               <>
                {/* Render Grouped NPCs */}
                {Object.keys(groups).map(groupName => (
                  <div key={groupName} className="mb-2">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1 ml-1 bg-slate-800/50 inline-block px-2 py-0.5 rounded border border-slate-700/50">{groupName}</div>
                    <div className="space-y-2">
                      {groups[groupName].map(npc => renderNpcCard(npc))}
                    </div>
                  </div>
                ))}
                
                {/* Render Ungrouped NPCs */}
                {ungrouped.length > 0 && (
                  <div className="space-y-2">
                     {Object.keys(groups).length > 0 && <div className="h-px bg-slate-800 my-2"></div>}
                     {ungrouped.map(npc => renderNpcCard(npc))}
                  </div>
                )}
               </>
             )}
           </div>
        </div>

        {/* --- NEW: MEMORY & QUEST TAB --- */}
        <div className={`absolute inset-0 z-10 bg-slate-900 p-4 transition-transform duration-300 ${activeTab === 'memory' ? 'translate-x-0' : 'translate-x-full'}`}>
           <h3 className="text-sm font-bold text-yellow-400 uppercase mb-4 flex items-center gap-2"><BookMarked size={16} /> Ký Ức & Nhiệm Vụ</h3>
           
           <div className="space-y-6 overflow-y-auto max-h-[75vh] pb-32">
              {/* Story Summary */}
              <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                 <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><ScrollText size={12}/> Cốt Truyện Tóm Tắt</h4>
                 <p className="text-sm text-slate-300 italic leading-relaxed whitespace-pre-wrap">
                    {gameState.summary || "Hành trình vừa mới bắt đầu..."}
                 </p>
              </div>

              {/* Quest List */}
              <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Target size={12}/> Nhiệm Vụ Đang Làm</h4>
                 <div className="space-y-2">
                    {(!gameState.character?.quests || gameState.character.quests.length === 0 || !gameState.character.quests.some(q => q.status === 'active')) && (
                       <p className="text-xs text-slate-500 italic text-center">Không có nhiệm vụ nào.</p>
                    )}
                    {(gameState.character?.quests || []).filter(q => q.status === 'active').map(quest => (
                       <div key={quest.id} className="bg-slate-800 p-3 rounded border border-blue-900/50 hover:border-blue-500 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                             <div className="font-bold text-blue-300 text-sm">{quest.name}</div>
                             {quest.progress && <span className="text-[10px] bg-blue-900/30 px-2 py-0.5 rounded text-blue-200 font-mono">{quest.progress}</span>}
                          </div>
                          <p className="text-xs text-slate-400">{quest.description}</p>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Completed Quests (Collapsible or just listed below) */}
              {(gameState.character?.quests || []).some(q => q.status === 'completed') && (
                 <div className="opacity-60">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Đã Hoàn Thành</h4>
                    <div className="space-y-1">
                       {(gameState.character?.quests || []).filter(q => q.status === 'completed').map(quest => (
                          <div key={quest.id} className="flex justify-between text-xs text-slate-500 border-b border-slate-800 pb-1">
                             <span className="line-through">{quest.name}</span>
                             <Check size={12} className="text-green-500"/>
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              {/* Player Notes Section */}
              <div className="border-t border-slate-800 pt-4">
                 <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><StickyNote size={12}/> Ghi Chú Cá Nhân</h4>
                 
                 <div className="flex gap-2 mb-3">
                    <input 
                       className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" 
                       placeholder="Ghi chú điều quan trọng..." 
                       value={newNote}
                       onChange={e => setNewNote(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                    />
                    <button onClick={handleAddNote} className="p-2 bg-blue-600 rounded text-white hover:bg-blue-500"><PlusCircle size={16}/></button>
                 </div>

                 <div className="space-y-2">
                    {(gameState.playerNotes || []).map(note => (
                       <div key={note.id} className={`p-3 rounded border flex justify-between items-start gap-2 ${note.isImportant ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-slate-800 border-slate-700'}`}>
                          <p className={`text-xs flex-1 ${note.isImportant ? 'text-yellow-100' : 'text-slate-300'}`}>{note.content}</p>
                          <div className="flex flex-col gap-1">
                             <button onClick={() => toggleNoteImportance(note.id)} className={`p-1 rounded hover:bg-white/10 ${note.isImportant ? 'text-yellow-400' : 'text-slate-500'}`} title="Ghim vào trí nhớ AI">
                                <Pin size={14} fill={note.isImportant ? "currentColor" : "none"} />
                             </button>
                             <button onClick={() => deleteNote(note.id)} className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400">
                                <Trash2 size={14} />
                             </button>
                          </div>
                       </div>
                    ))}
                    {(gameState.playerNotes || []).length === 0 && <p className="text-xs text-slate-600 italic text-center">Chưa có ghi chú nào.</p>}
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* MODALS */}

      {/* NPC Edit Modal */}
      {editingNpc && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800">
               <h3 className="font-bold text-white flex items-center gap-2"><PenLine size={18} /> Chỉnh Sửa NPC</h3>
               <button onClick={() => setEditingNpc(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                 <div>
                   <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Tên</label>
                   <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={editingNpc.name} onChange={e => setEditingNpc({...editingNpc, name: e.target.value})} />
                 </div>
                 <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Giới tính</label>
                      <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" placeholder="Nam/Nữ..." value={editingNpc.gender || ''} onChange={e => setEditingNpc({...editingNpc, gender: e.target.value})} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Nhóm / Tổ chức</label>
                      <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" placeholder="Môn phái..." value={editingNpc.group || ''} onChange={e => setEditingNpc({...editingNpc, group: e.target.value})} />
                    </div>
                 </div>
                 
                 {/* Detailed Appearance Fields */}
                 <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Màu Tóc</label>
                      <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" placeholder="Đen..." value={editingNpc.hairColor || ''} onChange={e => setEditingNpc({...editingNpc, hairColor: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Màu Mắt</label>
                      <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" placeholder="Nâu..." value={editingNpc.eyeColor || ''} onChange={e => setEditingNpc({...editingNpc, eyeColor: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Dáng</label>
                      <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" placeholder="Cao..." value={editingNpc.bodyType || ''} onChange={e => setEditingNpc({...editingNpc, bodyType: e.target.value})} />
                    </div>
                 </div>
              </div>

              {/* Status Management */}
              <div className="border-t border-slate-800 pt-4">
                 <h4 className="text-xs font-bold text-purple-400 uppercase mb-3 flex items-center gap-2"><Activity size={14} /> Quản Lý Trạng Thái</h4>
                 
                 {/* Current Statuses */}
                 <div className="space-y-2 mb-4">
                    {(editingNpc.activeStatuses || []).map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                         <div className="text-xs">
                            <div className={`font-bold flex items-center gap-1 ${s.type === 'buff' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {s.type === 'buff' ? <ArrowUpCircle size={12}/> : <ArrowDownCircle size={12}/>}
                                {s.name}
                            </div>
                            <div className="text-slate-500">{s.duration} lượt • {s.effect}</div>
                         </div>
                         <button onClick={() => removeStatusFromNpc(s.id)} className="text-slate-600 hover:text-red-500"><MinusCircle size={16} /></button>
                      </div>
                    ))}
                    {(editingNpc.activeStatuses || []).length === 0 && <p className="text-slate-600 text-xs italic text-center">Không có hiệu ứng nào.</p>}
                 </div>

                 {/* Add Status Form */}
                 <div className="bg-slate-800 p-3 rounded space-y-2 border border-slate-700/50">
                    <div className="flex gap-2">
                       <input className="flex-[2] bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white" placeholder="Tên trạng thái (VD: Trúng độc)" value={newStatusForm.name || ''} onChange={e => setNewStatusForm({...newStatusForm, name: e.target.value})} />
                       <select className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white" value={newStatusForm.type} onChange={e => setNewStatusForm({...newStatusForm, type: e.target.value as any})}>
                          <option value="buff">Buff</option>
                          <option value="debuff">Debuff</option>
                       </select>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input type="number" className="w-16 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white" placeholder="Lượt" value={newStatusForm.duration} onChange={e => setNewStatusForm({...newStatusForm, duration: parseInt(e.target.value)})} />
                        <span className="text-xs text-slate-500">Lượt</span>
                        <input className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white" placeholder="Hiệu ứng (VD: -5 HP/lượt)" value={newStatusForm.effect || ''} onChange={e => setNewStatusForm({...newStatusForm, effect: e.target.value})} />
                    </div>
                    <button onClick={addStatusToNpc} disabled={!newStatusForm.name} className="w-full py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1 disabled:opacity-50"><PlusCircle size={14}/> Thêm Trạng Thái</button>
                 </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-800">
               <button onClick={saveNpcChanges} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded flex items-center justify-center gap-2"><Save size={18} /> Lưu Thay Đổi</button>
            </div>
          </div>
        </div>
      )}

      {selectedTroopId && selectedTroop && !assigningCommanderRole && (<div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-fade-in"><div className="flex justify-between items-center mb-6 border-b border-emerald-800 pb-4"><h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2 uppercase"><Swords size={24} /> Chi Tiết Binh Chủng</h2><button onClick={() => setSelectedTroopId(null)} className="p-1 text-slate-500 hover:text-white"><X size={24} /></button></div><div className="bg-emerald-900/10 border border-emerald-700 rounded-xl p-5 mb-6 text-center shadow-[0_0_20px_rgba(16,185,129,0.1)]"><div className="text-3xl font-bold text-white mb-1">{selectedTroop.name}</div><div className="inline-block bg-emerald-900/50 text-emerald-300 border border-emerald-600/50 px-3 py-1 rounded-full text-sm font-mono font-bold">Số lượng: {selectedTroop.quantity}</div><p className="mt-4 text-slate-300 italic leading-relaxed text-sm">{selectedTroop.description}</p></div><div className="space-y-4"><div className="bg-slate-900 border border-slate-800 rounded-lg p-3"><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-1"><Crown size={12} /> Đội Trưởng</span>{selectedTroop.commanderId ? (<button onClick={() => removeCommander(selectedTroop.id, 'commander')} className="text-xs text-red-400 hover:text-red-300 underline">Bãi Nhiệm</button>) : (<button onClick={() => setAssigningCommanderRole('commander')} className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"><UserPlus size={12} /> Bổ Nhiệm</button>)}</div>{selectedTroop.commanderId ? (<div className="text-white font-bold text-sm bg-indigo-900/20 p-2 rounded border border-indigo-900/50">{gameState.npcs.find(n => n.id === selectedTroop.commanderId)?.name || "Unknown"}</div>) : (<div className="text-slate-600 text-sm italic p-2 border border-dashed border-slate-800 rounded">Trống</div>)}</div><div className="bg-slate-900 border border-slate-800 rounded-lg p-3"><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1"><Shield size={12} /> Đội Phó</span><button onClick={() => setAssigningCommanderRole('vice')} className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"><UserPlus size={12} /> Thêm Mới</button></div><div className="space-y-2">{(!selectedTroop.viceCommanderIds || selectedTroop.viceCommanderIds.length === 0) && (<div className="text-slate-600 text-sm italic p-2 border border-dashed border-slate-800 rounded">Chưa có ai</div>)}{selectedTroop.viceCommanderIds?.map(viceId => (<div key={viceId} className="flex justify-between items-center bg-blue-900/10 p-2 rounded border border-blue-900/30"><span className="text-slate-200 text-sm font-bold">{gameState.npcs.find(n => n.id === viceId)?.name || "Unknown"}</span><button onClick={() => removeCommander(selectedTroop.id, 'vice', viceId)} className="text-xs text-slate-500 hover:text-red-400"><X size={14} /></button></div>))}</div></div></div></div>)}
      {assigningCommanderRole && (<div className="absolute inset-0 z-[60] bg-slate-900 flex flex-col p-4 animate-fade-in"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white uppercase">Chọn {assigningCommanderRole === 'commander' ? 'Đội Trưởng' : 'Đội Phó'}</h3><button onClick={() => setAssigningCommanderRole(null)} className="p-1 text-slate-500 hover:text-white">Hủy</button></div><div className="flex-1 overflow-y-auto space-y-2">{factionNpcs.length === 0 && (<div className="text-center text-slate-500 py-10 italic">Chưa có thành viên nào trong Thế Lực (Faction).<br/>Hãy thu phục NPC trước.</div>)}{factionNpcs.map(npc => {const isCommander = selectedTroop?.commanderId === npc.id;const isVice = selectedTroop?.viceCommanderIds?.includes(npc.id);const isDisabled = isCommander || isVice;return (<button key={npc.id} disabled={isDisabled} onClick={() => assignCommander(npc.id)} className={`w-full text-left p-3 rounded border flex justify-between items-center ${isDisabled ? 'bg-slate-800 opacity-50 cursor-not-allowed border-slate-700' : 'bg-indigo-900/20 border-indigo-800 hover:bg-indigo-900/40 text-indigo-200'}`}><span className="font-bold">{npc.name}</span><span className="text-xs bg-slate-900 px-2 py-1 rounded text-slate-400">{npc.levelName}</span></button>);})}</div></div>)}
      
      {/* SUGGESTED ACTIONS */}
      {showSuggestions && gameState.suggestedActions && gameState.suggestedActions.length > 0 && !isProcessing && (
         <div className="absolute bottom-32 left-0 right-0 px-3 z-30 flex flex-wrap gap-2 justify-end pointer-events-none">
            {gameState.suggestedActions.map((s, i) => (
              <button key={i} onClick={() => setActionInput(s)} className="pointer-events-auto bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-blue-300 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg animate-fade-in transition-all flex items-center gap-1">
                <Sparkles size={10} /> {s}
              </button>
            ))}
         </div>
      )}

      <div className="bg-slate-900 border-t border-slate-800 p-3 z-30 pb-safe">
        <div className="flex gap-2 mb-2 items-center"><button onClick={() => setShowSuggestions(!showSuggestions)} className={`p-3 rounded-lg ${showSuggestions ? 'text-blue-400 bg-slate-800' : 'text-slate-500 bg-slate-900 hover:bg-slate-800'}`}>{showSuggestions ? <Eye size={20} /> : <EyeOff size={20} />}</button><div className="relative flex-1"><textarea className="w-full bg-slate-800 text-white rounded-lg pl-3 pr-10 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none h-12 overflow-hidden" placeholder="Bạn sẽ làm gì?" value={actionInput} onChange={(e) => setActionInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isProcessing} /><button onClick={() => handleAction()} disabled={!actionInput.trim() || isProcessing} className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 transition-colors">{isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}</button></div></div>
        <div className="flex justify-around items-center pt-2 border-t border-slate-800/50"><button onClick={() => setActiveTab('narrative')} className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${activeTab === 'narrative' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xs font-bold uppercase">Truyện</span></button><button onClick={() => setActiveTab('status')} className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${activeTab === 'status' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xs font-bold uppercase">Nhân Vật</span></button><button onClick={() => setActiveTab('rules')} className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${activeTab === 'rules' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xs font-bold uppercase">Luật Lệ</span></button><button onClick={() => setActiveTab('memory')} className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${activeTab === 'memory' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xs font-bold uppercase">Ký Ức</span></button><button onClick={() => setActiveTab('npcs')} className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${activeTab === 'npcs' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xs font-bold uppercase">Xã Hội</span></button></div>
      </div>
      
      {showExitMenu && (<div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4"><h2 className="text-xl font-bold text-white text-center mb-6">Tùy Chọn Thoát</h2><button onClick={handleSaveGame} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center justify-center gap-2"><Save size={20} /> LƯU & THOÁT (JSON)</button><button onClick={resetGame} className="w-full py-4 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200 rounded font-bold flex items-center justify-center gap-2"><LogOut size={20} /> THOÁT KHÔNG LƯU</button><button onClick={() => setShowExitMenu(false)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold">QUAY LẠI GAME</button></div></div>)}
    </div>
  );
};

export default GameInterface;
