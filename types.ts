
export enum GamePhase {
  INIT = 'INIT',
  WORLD_CREATION = 'WORLD_CREATION',
  CHARACTER_CREATION = 'CHARACTER_CREATION',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Stat {
  name: string;
  value: number;
  description?: string;
}

export type ItemCategory = 'equipment' | 'consumable' | 'material' | 'currency';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
  category: ItemCategory; 
  type?: string; 
  rank?: string; 
  isEquipped?: boolean;
  effect?: string; 
}

export interface Skill {
  id: string;
  name: string;
  type: 'Attack' | 'Defense' | 'Support' | 'Passive' | 'Movement' | 'Special' | 'Cultivation';
  description: string;
  mastery: string; 
  rank?: string; // e.g. "Thanh Đồng", "Bạch Ngân", "S"
  imageUrl?: string; // NEW: Base64 string for the generated icon
}

// NEW: Trait system for Bloodlines, Divine Bodies, and Status Effects
export type TraitType = 'bloodline' | 'divine_body' | 'buff' | 'debuff' | 'mental' | 'special';

export interface Trait {
  id: string;
  name: string;
  type: TraitType;
  description: string;
  quality?: string; // e.g., "Thượng Cổ", "Hoàng Kim", "Sơ Cấp"
  duration?: number; // Number of turns remaining. undefined or -1 for permanent.
  effect?: string; // Short summary of stat impact
}

// NEW: Achievement System
export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: string; // Instructions for AI to check (e.g., "Kill 100 enemies")
  type: 'combat' | 'collection' | 'exploration' | 'milestone';
  isUnlocked: boolean;
  reward?: string; // Narrative text reward
}

// NEW: Long-term Memory Structures
export interface Quest {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  progress?: string; // e.g. "2/10 wolves killed"
}

export interface PlayerNote {
  id: string;
  content: string;
  isImportant: boolean; // If true, always send to AI context
}

export interface Character {
  name: string;
  title?: string; 
  gender?: string;
  appearance: string; 
  personality: string; 
  race: string;
  class: string;
  level: number;
  levelName?: string; 
  exp: number;
  expToNextLevel: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: Stat[];
  resistances?: Stat[]; 
  inventory: InventoryItem[]; 
  skills: Skill[]; 
  
  // Updated Status System
  statusEffects: string[]; // Deprecated, kept for backward compatibility if needed, but UI will use the new arrays
  bloodlines: Trait[]; // New
  divineBodies: Trait[]; // New
  activeStatuses: Trait[]; // New (Buffs, Debuffs, etc.)
  
  achievements: Achievement[]; // NEW: List of achievements
  quests: Quest[]; // NEW: Long-term goals
  
  permanentInjuries?: string[]; 
  talents: string[];
  background: string;
}

export interface World {
  name: string;
  genre: string;
  description: string;
  rules: string;
  statSystem: string[];
  resistanceTypes?: string[]; 
  structure?: string;
  dangerLevel?: string; 
  difficultyMode?: 'Thường' | 'Khó' | 'Siêu Khó (Ác Mộng)' | 'Địa Ngục'; 
  style?: string;
  deathRate?: string;
  gameplayFeatures?: string;
  risksAndOpportunities?: string; 
}

export interface LogEntry {
  id: string;
  turn: number;
  action: string;
  result: string;
  narrative?: string; 
  type: 'info' | 'combat' | 'event' | 'milestone';
}

export interface NPC {
  id: string;
  name: string;
  gender?: string;
  group?: string; // For organizing into factions/groups
  
  // Detailed Appearance
  hairColor?: string;
  eyeColor?: string;
  bodyType?: string;

  relation: 'hostile' | 'neutral' | 'friendly' | 'devoted' | 'nemesis';
  affiliation?: 'none' | 'faction' | 'slave'; 
  notes: string;
  level?: number;
  levelName?: string; 
  isLocked?: boolean; 
  emotion?: string; 
  currentActivity?: string; 
  activeStatuses?: Trait[]; // NPCs can have buffs/debuffs
  isDead?: boolean; 
}

export interface TroopUnit {
  id: string;
  name: string; 
  quantity: number;
  description: string;
  commanderId?: string; 
  viceCommanderIds?: string[]; 
}

export interface GameState {
  phase: GamePhase;
  turnCount: number;
  world: World | null;
  character: Character | null;
  history: LogEntry[];
  
  // NEW: Long-term Memory Fields
  summary: string; // The "Story So Far" compressed text
  playerNotes: PlayerNote[]; // Manual notes from player
  
  // MEMORY CORE LITE: Stores the exact structure returned by AI for persistence
  memory?: any; 

  npcs: NPC[];
  troops: TroopUnit[]; 
  lastNarrative: string;
  customRules: string[]; 
  suggestedActions: string[]; 
  isLoading: boolean;
  error: string | null;
}

export interface TurnResponse {
  narrative: string;
  suggestedActions?: string[]; 
  statUpdates?: Partial<Character>;
  addedInventoryItems?: InventoryItem[]; 
  removedSkillIds?: string[]; 
  removedInventoryIds?: string[];
  
  // Trait Updates
  traitUpdates?: {
    name: string; // Key to identify (match existing or create new)
    type: TraitType;
    description?: string;
    quality?: string;
    durationChange?: number; // e.g., -1 (tick down), +5 (refresh), or set absolute if logic prefers
    setDuration?: number; // Force set duration
    isRemoved?: boolean; // Request to remove
  }[];

  unlockedAchievementIds?: string[]; // NEW: IDs of achievements unlocked this turn

  // Quest Updates
  questUpdates?: {
    id?: string; // If updating existing
    name: string;
    status: 'active' | 'completed' | 'failed';
    description?: string;
    progress?: string;
    isNew?: boolean;
  }[];

  // MEMORY CORE LITE UPDATE
  memory?: any;

  historyLog?: {
    action: string;
    result: string;
    type: 'info' | 'combat' | 'event' | 'milestone';
  };
  newNpcs?: NPC[];
  npcUpdates?: { 
    id: string; 
    name?: string; 
    gender?: string;
    group?: string;
    
    // Appearance updates
    hairColor?: string;
    eyeColor?: string;
    bodyType?: string;

    relation?: 'hostile' | 'neutral' | 'friendly' | 'devoted' | 'nemesis'; 
    affiliation?: 'none' | 'faction' | 'slave';
    notes?: string;
    level?: number;
    levelName?: string;
    emotion?: string;
    currentActivity?: string;
    activeStatuses?: Trait[];
    isDead?: boolean; 
  }[];
  troopUpdates?: {
    name: string; 
    renameTo?: string; 
    quantityChange: number; 
    description?: string; 
  }[];
  isGameOver?: boolean;
  gameOverReason?: string;
}
