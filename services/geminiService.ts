

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Character, GameState, TurnResponse, World, Skill, InventoryItem, Achievement, Quest } from "../types";
import { SYSTEM_PROMPT } from "../constants";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-flash-preview';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

// --- HELPER: ROBUST JSON PARSER ---
const parseAIResponse = (text: string): any => {
  if (!text) return null;
  try {
    // 1. Try cleaning markdown code blocks first
    let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 2. Find the first '{' or '[' and the last '}' or ']' to isolate JSON
    const firstCurly = clean.indexOf('{');
    const firstSquare = clean.indexOf('[');
    
    let startIndex = -1;
    if (firstCurly !== -1 && firstSquare !== -1) {
      startIndex = Math.min(firstCurly, firstSquare);
    } else if (firstCurly !== -1) {
      startIndex = firstCurly;
    } else {
      startIndex = firstSquare;
    }

    if (startIndex !== -1) {
       const lastCurly = clean.lastIndexOf('}');
       const lastSquare = clean.lastIndexOf(']');
       const endIndex = Math.max(lastCurly, lastSquare);
       
       if (endIndex > startIndex) {
         clean = clean.substring(startIndex, endIndex + 1);
       }
    }

    return JSON.parse(clean);
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    console.error(e);
    return null;
  }
};

// --- HELPER: GET LEVEL SYSTEM BY GENRE ---
const getLevelSystemHint = (genre: string): string => {
  const g = genre.toLowerCase();
  if (g.includes('tu tiên') || g.includes('tiên hiệp')) {
    return "Hệ thống Tu Tiên (BẮT BUỘC): Luyện Khí -> Trúc Cơ -> Kim Đan -> Nguyên Anh -> Hóa Thần -> Luyện Hư -> Hợp Thể -> Đại Thừa -> Độ Kiếp. (TUYỆT ĐỐI KHÔNG dùng 'Cấp 1', 'Level 1').";
  }
  if (g.includes('võ hiệp') || g.includes('kiếm hiệp')) {
    return "Hệ thống Võ Học: Tam Lưu -> Nhị Lưu -> Nhất Lưu -> Hậu Thiên -> Tiên Thiên -> Tông Sư -> Đại Tông Sư -> Võ Thánh.";
  }
  if (g.includes('huyền huyễn') || g.includes('dị giới') || g.includes('fantasy')) {
    return "Hệ thống Ma Pháp/Đấu Khí: Học Đồ -> Chính Thức -> Đại Sư -> Thánh Vực -> Bán Thần -> Thần Cấp (Hoặc Rank F -> E -> D -> C -> B -> A -> S -> SS).";
  }
  if (g.includes('game') || g.includes('vrmmo')) {
    return "Hệ thống Level: Level 1 -> Level 100+ (Kèm Rank: Thường -> Tinh Anh -> Boss -> Lord).";
  }
  if (g.includes('mạt thế') || g.includes('zombie')) {
    return "Hệ thống Tiến Hóa: Người Thường -> Cấp 1 (Sơ Tỉnh) -> Cấp 2 -> ... -> Cấp 9 -> Vương Cấp.";
  }
  return "Hệ thống tự do: Tùy chỉnh theo bối cảnh (Cấp 1-100 hoặc Sơ/Trung/Cao cấp).";
};

// --- HELPER: SANITIZE CHARACTER FOR PROMPT ---
// Removes heavy data like base64 images from skills to save tokens
const sanitizeCharacterForPrompt = (character: Character): any => {
  if (!character) return null;
  return {
    ...character,
    skills: character.skills?.map(s => {
      // Destructure to exclude imageUrl from the object sent to AI
      const { imageUrl, ...rest } = s; 
      return rest;
    }) || []
  };
};

/**
 * Generates 3 premade world concepts based on a genre.
 */
export const suggestWorlds = async (genre: string): Promise<Partial<World>[]> => {
  const prompt = `
    Người chơi chọn thể loại RPG: "${genre}".
    Hãy sáng tạo 3 thế giới khác biệt thuộc thể loại này để người chơi lựa chọn.
    
    Yêu cầu trả về mảng JSON (Array) gồm 3 object, mỗi object có cấu trúc:
    {
      "name": "Tên thế giới hấp dẫn",
      "description": "Mô tả ngắn gọn về bối cảnh (1-2 câu)",
      "dangerLevel": "Độ khó/Nguy hiểm",
      "style": "Phong cách chủ đạo (Dark, Heroic, Mystery...)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    
    const data = parseAIResponse(response.text || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error suggesting worlds:", error);
    return [];
  }
};

/**
 * Generates a full detailed World Profile based on inputs.
 */
export const generateWorldConfig = async (inputData: { 
  genre?: string;
  name?: string;
  description?: string; 
  dangerLevel?: string; 
  style?: string; 
  isCustom?: boolean;
}): Promise<World> => {
  
  let userIntent = "";

  if (inputData.isCustom) {
    userIntent = `Người chơi muốn nhập vai vào thế giới có tên (hoặc dựa trên tác phẩm): "${inputData.name}".
    
    NHIỆM VỤ CỦA BẠN:
    1. Phân tích tên gọi:
       - Nếu là tác phẩm nổi tiếng (Anime/Manga/Novel/Game/Film): Hãy truy xuất dữ liệu thực tế để tái hiện CHÍNH XÁC bối cảnh, hệ thống sức mạnh, cấp độ và phong cách của tác phẩm đó.
       - Nếu là tên tự đặt/mới lạ: Hãy sáng tạo ra một thế giới hoàn chỉnh, logic và hấp dẫn dựa trên cảm hứng từ cái tên đó.
    
    2. Tự động điền đầy đủ và chi tiết các trường thông tin dựa trên phân tích trên.`;
  } else {
    userIntent = `Người chơi chọn thế giới mẫu: 
       - Tên: ${inputData.name}
       - Mô tả sơ bộ: ${inputData.description}
       - Thể loại gốc: ${inputData.genre}`;
  }

  const prompt = `
    ${userIntent}

    HÃY TẠO "HỒ SƠ THẾ GIỚI" CHI TIẾT ĐỂ NGƯỜI CHƠI XEM TRƯỚC (PREVIEW).
    BẮT BUỘC hiển thị đầy đủ thông tin. Nếu thiếu, hãy tự bổ sung cho đủ.
    
    Yêu cầu JSON output đầy đủ các trường sau:
    {
      "name": "Tên chính thức của thế giới",
      "genre": "Thể loại chính (Ví dụ: ${inputData.genre || 'Tự do'})",
      "description": "Bối cảnh tổng quan (lịch sử, tình hình hiện tại, khoảng 100 từ)",
      "structure": "Cấu trúc thế giới (Khu vực, Phe phái, Xã hội)",
      "rules": "Luật vận hành cốt lõi & Hệ thống sức mạnh (Chỉ nêu tên hệ thống, vd: Linh Khí, Ma Pháp, Tech Level...)",
      "dangerLevel": "Mức độ nguy hiểm (Mô tả)",
      "deathRate": "Tỷ lệ tử vong ước tính (cho chế độ 1 mạng)",
      "style": "Phong cách nghệ thuật (Vd: U tối, Hùng tráng...)",
      "gameplayFeatures": "Điểm đặc thù về gameplay",
      "statSystem": ["Danh sách 4-6 chỉ số nhân vật phù hợp nhất"],
      "resistanceTypes": ["Danh sách 4 loại kháng đặc trưng (VD Tiên Hiệp: [Hỏa, Băng, Lôi, Độc, Tâm Ma], Fantasy: [Vật Lý, Phép Thuật, Lửa, Băng])"],
      "risksAndOpportunities": "Nguy cơ & Cơ hội chính cho người chơi (Gạch đầu dòng)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    
    const data = parseAIResponse(response.text || "{}");
    return data as World;
  } catch (error) {
    console.error("Error generating world details:", error);
    throw new Error("Không thể khởi tạo chi tiết thế giới. Vui lòng thử lại.");
  }
};

// --- NEW: ACHIEVEMENT GENERATION ---
export const generateInitialAchievements = async (world: World): Promise<Achievement[]> => {
  const prompt = `
    Thế giới: "${world.name}"
    Thể loại: "${world.genre}"
    Độ khó: "${world.dangerLevel}"
    Luật: "${world.rules}"

    Hãy sáng tạo 8-10 Thành tựu (Achievements) đầy thử thách và thú vị cho người chơi trong thế giới này.
    
    Yêu cầu:
    - Đa dạng loại hình: Chiến đấu (combat), Thu thập (collection), Khám phá (exploration), Cột mốc (milestone).
    - Có độ khó tăng dần.
    
    Output JSON Array of Achievement objects:
    [
      {
        "id": "unique_string_id",
        "name": "Tên thành tựu (Hùng tráng)",
        "description": "Mô tả ngắn",
        "condition": "Điều kiện cụ thể để AI kiểm tra (Ví dụ: 'Đạt cảnh giới Trúc Cơ', 'Sở hữu 1000 Linh Thạch', 'Đánh bại 1 Tông Sư')",
        "type": "combat", // combat/collection/exploration/milestone
        "isUnlocked": false,
        "reward": "Phần thưởng tinh thần hoặc danh hiệu (Text)"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const data = parseAIResponse(response.text);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Achievement generation error:", e);
    return [];
  }
};

// --- NEW: SKILL ICON GENERATION ---
export const generateSkillImage = async (skill: Skill, genre: string): Promise<string | null> => {
  const prompt = `
    Game Icon Art. 
    Subject: A skill icon for an RPG game. 
    Skill Name: "${skill.name}". 
    Description: "${skill.description}". 
    Genre/Style: ${genre}.
    Visuals: High contrast, centered composition, digital painting style, clean background or simple gradient, vibrant colors, detailed.
    No text inside the icon. Square aspect ratio.
  `;

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: prompt,
      config: {
        // No responseMimeType for image models
      },
    });

    // Parse image data from response
    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return part.inlineData.data; // Return base64 string
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
};

// --- NEW: MEMORY SUMMARIZATION ---
export const summarizeStory = async (gameState: GameState): Promise<string> => {
  const recentLogs = gameState.history.slice(-15); // Take last 15 logs
  const oldSummary = gameState.summary || "Bắt đầu hành trình.";
  
  const prompt = `
    Cốt truyện tóm tắt cũ: "${oldSummary}"
    
    Diễn biến mới (15 lượt gần nhất):
    ${JSON.stringify(recentLogs.map(l => l.narrative || l.result))}
    
    NHIỆM VỤ:
    Hãy viết lại một bản tóm tắt cốt truyện MỚI, kết hợp cái cũ và cái mới.
    - Giữ lại các sự kiện quan trọng (tên kẻ thù chính, địa điểm, vật phẩm quan trọng).
    - Lược bỏ chi tiết vụn vặt (đánh quái nhỏ, mua bán lặt vặt).
    - Độ dài: Khoảng 200-300 từ.
    - Văn phong: Tóm tắt biên niên sử.
    
    Output: Chỉ trả về nội dung tóm tắt (Text).
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text?.trim() || oldSummary;
  } catch (e) {
    console.error("Summarization error:", e);
    return oldSummary;
  }
};

// --- CHARACTER CREATION WIZARD FUNCTIONS ---

export const getCharacterCreationOptions = async (world: World) => {
  const prompt = `
    Dựa trên thế giới: ${JSON.stringify(world)}
    Hãy đề xuất các lựa chọn tạo nhân vật phù hợp.
    
    BẮT BUỘC SỐ LƯỢNG GỢI Ý:
    - Backgrounds: 5-6 gợi ý.
    - Races: 5-6 gợi ý.
    - Classes: 4-5 gợi ý.

    Trả về JSON:
    {
      "backgrounds": ["Xuất thân 1", "Xuất thân 2", ...],
      "races": ["Chủng tộc/Thân phận 1", "Chủng tộc/Thân phận 2", ...],
      "classes": ["Con đường 1", "Con đường 2", ...]
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const data = parseAIResponse(response.text);
    // CRITICAL FIX: Ensure return value always has arrays
    return {
      backgrounds: data?.backgrounds || [],
      races: data?.races || [],
      classes: data?.classes || []
    };
  } catch (e) { return { backgrounds: [], races: [], classes: [] }; }
};

export const checkSuitability = async (world: World, category: string, input: string) => {
  const prompt = `
    Thế giới: ${world.name}
    Người chơi nhập ${category}: "${input}".
    Đánh giá xem lựa chọn này có hợp lý với bối cảnh không?
    Trả về JSON: { "suitable": boolean, "reason": "Lý do ngắn gọn" }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return parseAIResponse(response.text) || { suitable: true, reason: "Không thể kiểm tra" };
  } catch (e) { return { suitable: true, reason: "Không thể kiểm tra" }; }
};

export const analyzeClassChoice = async (world: World, className: string) => {
  const prompt = `
    Thế giới: ${world.name}
    Hệ phái/Class: "${className}"
    
    Phân tích cho người chơi (chế độ 1 mạng).
    Trả về JSON:
    {
      "style": "Phong cách chiến đấu chủ đạo",
      "pros": "Ưu điểm lớn nhất",
      "cons": "Nhược điểm chí mạng",
      "difficulty": "Độ khó sinh tồn (Thấp/Trung bình/Cao/Tử địa)"
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return parseAIResponse(response.text);
  } catch (e) { return null; }
};

export const generateTalentOptions = async (world: World) => {
  const prompt = `
    Thế giới: ${world.name}
    Hãy sáng tạo 5-6 Thiên phú (Talent) khởi đầu thú vị.
    Trả về JSON:
    {
      "talents": [
        { "name": "Tên", "description": "Mô tả công dụng" }
      ]
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const data = parseAIResponse(response.text);
    return data?.talents || [];
  } catch (e) { return []; }
};

export const balanceCustomTalent = async (world: World, talentName: string, description: string) => {
  const prompt = `
    Thế giới: ${world.name}
    Người chơi muốn tạo thiên phú: "${talentName}" - "${description}".
    Cân bằng nó cho chế độ Permadeath.
    Trả về JSON:
    {
      "name": "Tên",
      "description": "Mô tả đã cân bằng",
      "isBalanced": true
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return parseAIResponse(response.text);
  } catch (e) { return { name: talentName, description, isBalanced: false }; }
};

export const generateStartingLoadout = async (world: World, charInfo: any) => {
  const prompt = `
    DỮ LIỆU ĐẦU VÀO:
    - Thế giới: ${world.name} (${world.genre})
    - Nhân vật: ${charInfo.name}
    - Chủng tộc: ${charInfo.race}
    - Xuất thân: ${charInfo.background}
    - Class (Hệ phái): ${charInfo.class}
    - Thiên phú: ${charInfo.talents.map((t: any) => `${t.name} (${t.description})`).join(', ')}

    NHIỆM VỤ:
    Tạo bộ trang bị và kỹ năng khởi đầu PHÙ HỢP VỚI CLASS VÀ XUẤT THÂN.
    BẮT BUỘC PHẢI CÓ ĐẦY ĐỦ CÁC MỤC SAU:
    1. Một vũ khí chính (Bắt buộc phải phù hợp Class).
    2. Một bộ trang phục/giáp (Phù hợp Xuất thân).
    3. 2-3 vật phẩm tiêu hao (thuốc, thức ăn dự trữ).
    4. Tiền tệ khởi đầu (Số lượng hợp lý).
    5. Một kỹ năng khởi đầu (Passive hoặc Active) phù hợp Thiên phú/Class.

    YÊU CẦU JSON CẤU TRÚC (TUYỆT ĐỐI KHÔNG TRẢ VỀ RỖNG):
    {
      "inventory": [
         { "category": "equipment", "name": "Tên vũ khí", "type": "Vũ khí", "rank": "Phàm Phẩm", "effect": "Sát thương +...", "quantity": 1, "isEquipped": true },
         { "category": "equipment", "name": "Tên y phục", "type": "Giáp", "rank": "Phàm Phẩm", "effect": "Phòng thủ +...", "quantity": 1, "isEquipped": true },
         { "category": "consumable", "name": "Bánh bao/Thuốc...", "effect": "Hồi phục...", "quantity": 3 },
         { "category": "currency", "name": "Tên tiền tệ", "quantity": 100 }
      ],
      "skill": {
         "name": "Tên Kỹ Năng",
         "type": "Attack", // Attack/Defense/Support/Passive
         "description": "Mô tả chi tiết công dụng...",
         "mastery": "Sơ nhập"
      }
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const data = parseAIResponse(response.text);
    // Extra validation check: Ensure data is not null and has inventory
    if (!data || !data.inventory || data.inventory.length === 0) {
      throw new Error("AI returned empty loadout");
    }
    return data;
  } catch (e) { 
    return { 
      inventory: [
        { category: "equipment", name: "Trang bị tân thủ", type: "Vũ khí", rank: "Thường", quantity: 1, isEquipped: true },
        { category: "consumable", name: "Lương khô", effect: "Hồi phục thể lực", quantity: 3 },
        { category: "currency", name: "Tiền", quantity: 10 }
      ], 
      skill: { name: "Đánh thường", type: "Attack", description: "Tấn công cơ bản", mastery: "Sơ nhập" } 
    }; 
  }
};

export const fuseSkills = async (world: World, ingredients: Skill[]): Promise<Skill | null> => {
  const prompt = `
    THẾ GIỚI: ${world.name}
    Dung hợp các kỹ năng: ${JSON.stringify(ingredients.map(s => s.name))}.
    Tạo ra 1 Kỹ Năng Mới mạnh hơn cùng loại.
    TRẢ VỀ JSON:
    {
      "name": "Tên kỹ năng mới",
      "type": "${ingredients[0].type}",
      "description": "Mô tả chi tiết",
      "mastery": "Sơ nhập"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const data = parseAIResponse(response.text);
    if (!data || !data.name) return null;
    
    return {
      id: Date.now().toString(),
      ...data
    } as Skill;
  } catch (e) {
    console.error("Fusion error", e);
    return null;
  }
};

export const processTurn = async (
  gameState: GameState,
  userAction: string
): Promise<TurnResponse> => {
  if (!gameState.world || !gameState.character) throw new Error("Game state invalid");

  const SLIDING_WINDOW_SIZE = 5; // Slight increase for better immediate context
  const isPermadeath = gameState.world.difficultyMode?.includes('Ác Mộng') || gameState.world.difficultyMode === 'Địa Ngục';
  const levelSystemHint = getLevelSystemHint(gameState.world.genre);

  // --- OPTIMIZATION: INCLUDE CRITICAL STATE DATA IN CONTEXT ---
  // Defensively map NPCs to avoid "map of undefined" if state is corrupted
  const knownNPCsMinimal = (gameState.npcs || []).map(n => ({ 
    id: n.id, 
    name: n.name, 
    levelName: n.levelName, 
    currentActivity: n.currentActivity,
    isDead: n.isDead,
    relation: n.relation,
    affiliation: n.affiliation
  }));

  const lockedAchievements = (gameState.character.achievements || []).filter(a => !a.isUnlocked).map(a => ({ id: a.id, condition: a.condition }));
  
  // Filter active quests for context
  const activeQuests = (gameState.character.quests || []).filter(q => q.status === 'active');
  const importantNotes = (gameState.playerNotes || []).filter(n => n.isImportant);

  const context = {
    world: gameState.world,
    gameDifficulty: gameState.world.difficultyMode || "Thường",
    levelSystem: levelSystemHint,
    permadeathMode: isPermadeath ? "ENABLED - NO MERCY" : "DISABLED",
    
    // MEMORY SYSTEM
    memory: gameState.memory || {}, // Pass the MEMORY CORE LITE
    storySoFar: gameState.summary || "Bắt đầu hành trình.",
    activeQuests: activeQuests,
    importantNotes: importantNotes,

    character: sanitizeCharacterForPrompt(gameState.character),
    
    activeTraits: {
      bloodlines: gameState.character.bloodlines || [],
      divineBodies: gameState.character.divineBodies || [],
      statuses: gameState.character.activeStatuses || []
    },
    lockedAchievements: lockedAchievements,
    currentTurn: gameState.turnCount,
    // Provide recent raw logs for immediate continuity
    recentHistory: gameState.history.slice(-SLIDING_WINDOW_SIZE), 
    lastNarrative: gameState.lastNarrative,
    userAction: userAction,
    knownNPCs: knownNPCsMinimal, 
    currentTroops: gameState.troops || [], 
    customRules: gameState.customRules || [] 
  };

  const prompt = `
    DỮ LIỆU GAME HIỆN TẠI (JSON):
    ${JSON.stringify(context)}

    YÊU CẦU:
    Xử lý hành động "${userAction}" của người chơi.
    
    QUAN TRỌNG - CHẾ ĐỘ ĐỘ KHÓ: ${context.gameDifficulty}
    QUAN TRỌNG - HỆ THỐNG CẢNH GIỚI: ${levelSystemHint}
    
    ================================================================================
    MODULE MEMORY CORE LITE (QUAN TRỌNG NHẤT)
    ================================================================================
    1. ĐỌC 'memory' trong input. Đây là sự thật tuyệt đối.
    2. SO SÁNH với diễn biến mới.
    3. NẾU CÓ THAY ĐỔI VỀ TRẠNG THÁI (vị trí, sức khỏe, NPC quan trọng):
       -> HÃY TRẢ VỀ object 'memory' ĐÃ CẬP NHẬT trong JSON output.
    
    ================================================================================
    MODULE NHIỆM VỤ (QUESTS)
    ================================================================================
    1. CỐT TRUYỆN TỔNG QUAN: Sử dụng 'storySoFar' để nhớ bối cảnh lớn và các sự kiện cũ. Đừng mâu thuẫn với nó.
    2. NHIỆM VỤ (QUESTS):
       - Luôn kiểm tra 'activeQuests'. Nếu người chơi hoàn thành mục tiêu, hãy cập nhật trạng thái (completed) trong 'questUpdates'.
       - Nếu có nhiệm vụ mới nảy sinh từ hội thoại hoặc sự kiện, hãy THÊM MỚI vào 'questUpdates'.
       - Định dạng questUpdate: { "name": "...", "status": "active/completed/failed", "progress": "..." }
    3. GHI CHÚ NGƯỜI CHƠI (NOTES):
       - Lưu ý 'importantNotes' nếu người chơi đã đánh dấu điều gì đó quan trọng.

    ================================================================================
    MODULE HUYẾT MẠCH - THẦN THỂ - TRẠNG THÁI
    ================================================================================
    Sử dụng 'traitUpdates' để thêm/sửa/xóa hiệu ứng:
    - Nếu nhân vật thức tỉnh Huyết mạch/Thần thể: Thêm mới (type: 'bloodline'/'divine_body').
    - Nếu nhân vật bị thương/trúng độc/nhận buff: Thêm trạng thái (type: 'buff'/'debuff'/'mental').
    - Nếu trạng thái cũ hết hạn/giải trừ: Gửi { "name": "...", "isRemoved": true }.
    
    ================================================================================
    MODULE THÀNH TỰU (ACHIEVEMENTS)
    ================================================================================
    Kiểm tra danh sách 'lockedAchievements' trong dữ liệu.
    Nếu hành động hoặc kết quả của người chơi THỎA MÃN điều kiện ('condition') của thành tựu nào, hãy thêm ID của nó vào mảng 'unlockedAchievementIds' trong JSON trả về.
    
    ================================================================================
    MODULE XÃ HỘI (SOCIAL SCANNING) - BẮT BUỘC THỰC HIỆN NGHIÊM TÚC
    ================================================================================
    Sau khi viết truyện, bạn PHẢI thực hiện rà soát văn bản vừa viết để cập nhật NPC.
    
    1. DANH SÁCH NPC HIỆN CÓ: ${JSON.stringify(knownNPCsMinimal.map(n => n.name))}
       - Nếu tên của họ xuất hiện trong truyện -> BẮT BUỘC thêm vào 'npcUpdates' để cập nhật 'currentActivity'.
       - Ví dụ: Nếu "Lý Mạc Sầu" đang đánh nhau -> update: { id: "...", currentActivity: "Đang giao chiến..." }
    
    2. NPC MỚI (NEW CHARACTERS):
       - Chỉ khi có nhân vật MỚI HOÀN TOÀN xuất hiện -> Thêm vào 'newNpcs'.
       - HỆ THỐNG CẤP ĐỘ BẮT BUỘC: "${levelSystemHint}"
       - TUYỆT ĐỐI KHÔNG DÙNG "Level X" nếu hệ thống là Tu Tiên/Kiếm Hiệp.
       - PHẢI ĐIỀN ĐỦ: hairColor, eyeColor, bodyType. Không được để trống.
    
    ================================================================================
    
    QUAN TRỌNG - NỘI DUNG:
    - Viết tối thiểu 600 - 1000 từ.
    - Trả về JSON đúng định dạng.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    const data = parseAIResponse(response.text) as TurnResponse;
    if (!data) throw new Error("Parsed data is null");
    return data;
  } catch (error) {
    console.error("Error processing turn:", error);
    return {
      narrative: "Hệ thống gặp sự cố khi xử lý dữ liệu. Vui lòng thử lại.",
      historyLog: {
        action: userAction,
        result: "Lỗi hệ thống",
        type: "info"
      }
    };
  }
};

export const syncGameData = async (gameState: GameState): Promise<TurnResponse> => {
  if (!gameState.world || !gameState.character) throw new Error("Game state invalid");

  const levelSystemHint = getLevelSystemHint(gameState.world.genre);

  // Only send minimal context needed for sync
  const context = {
    genre: gameState.world.genre,
    levelSystem: levelSystemHint,
    // Sanitize character to remove heavy data (images)
    character: sanitizeCharacterForPrompt(gameState.character),
    lastNarrative: gameState.lastNarrative, // The narrative we need to sync with
    npcs: (gameState.npcs || []).map(n => ({ id: n.id, name: n.name, status: n.currentActivity, level: n.levelName })),
    troops: gameState.troops,
  };

  const prompt = `
    [CHẾ ĐỘ: ĐỒNG BỘ & TỰ SỬA LỖI TOÀN DIỆN]
    
    DỮ LIỆU HIỆN TẠI (JSON):
    ${JSON.stringify(context)}

    NHIỆM VỤ:
    Bạn là Module Quét Lỗi. Hãy đọc kỹ phần 'lastNarrative' (Nội dung truyện vừa xảy ra) và so sánh với 'character'/'npcs'/'troops'.
    Phát hiện mọi sự bất hợp lý và trả về các cập nhật để đồng bộ dữ liệu với cốt truyện.
    
    YÊU CẦU ĐẶC BIỆT VỀ CẤP ĐỘ NPC:
    - Hệ thống cảnh giới thế giới này là: ${levelSystemHint}
    - Nếu phát hiện NPC có 'levelName' sai lệch (Ví dụ: Thế giới Tu Tiên mà dùng 'Cấp 1'), HÃY SỬA LẠI NGAY LẬP TỨC trong 'npcUpdates'.
    - Ví dụ: Sửa 'Cấp 1' thành 'Luyện Khí Tầng 1' hoặc tương đương.
    
    QUY TẮC XỬ LÝ:
    1. NHÂN VẬT:
       - Kiểm tra HP/Mana/Exp. Nếu truyện mô tả bị thương mà HP đầy -> Trừ HP.
       - Nếu Exp đã đủ ngưỡng -> Tự động cho thăng cấp (level up).
    2. HÀNH TRANG:
       - Nếu truyện mô tả nhặt được vật phẩm -> Thêm vào 'addedInventoryItems'.
       - Nếu dùng vật phẩm/tiền -> Thêm vào 'removedInventoryIds' hoặc giảm số lượng.
    3. TRẠNG THÁI:
       - Đồng bộ Buff/Debuff. Nếu truyện nói đã hết tác dụng -> Xóa.
    4. NPC:
       - Cập nhật trạng thái (currentActivity) cho khớp với truyện.
       - CHUẨN HÓA TÊN CẤP ĐỘ (levelName) theo đúng Genre.
       - Nếu có thể suy luận từ truyện, hãy cập nhật ngoại hình: 'hairColor', 'eyeColor', 'bodyType'.
    
    OUTPUT:
    - Trả về JSON định dạng 'TurnResponse'.
    - Trường 'narrative': ĐỂ TRỐNG hoặc chỉ ghi thông báo hệ thống ngắn gọn (Ví dụ: "Đã đồng bộ trạng thái..."). KHÔNG VIẾT TRUYỆN MỚI.
    - Trường 'historyLog': Ghi "Đồng bộ dữ liệu".
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // Reuse system prompt for consisteny in data formats, though rules override behavior
        systemInstruction: SYSTEM_PROMPT, 
      },
    });

    const data = parseAIResponse(response.text) as TurnResponse;
    if (!data) throw new Error("Parsed data is null");
    return data;
  } catch (error) {
    console.error("Error syncing data:", error);
    return {
      narrative: "",
      historyLog: {
        action: "Đồng bộ",
        result: "Lỗi kết nối khi đồng bộ",
        type: "info"
      }
    };
  }
};