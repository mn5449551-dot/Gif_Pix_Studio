import type { ActionType, PetMood, PetOverlayMood } from "@/lib/types";

const MOOD_SCRIPTS: Record<PetMood, string[]> = {
  idle: [
    "小灵在，随时可以帮你打磨动作描述。",
    "想到动作灵感就叫我，我会整理成可直接用的描述。",
    "上传素材后我们就可以开始施法了。",
  ],
  guide: [
    "先上传一张角色图，我来帮你安排动作细节。",
    "你可以先选动作模板，再补充个性化描述。",
    "准备好后点生成，我会全程盯进度。",
  ],
  thinking: [
    "正在处理中，我会盯着每一步进度。",
    "施法进行中，马上就能看到结果。",
    "我在拼装动画碎片，稍等一下。",
  ],
  happy: [
    "这次效果不错，我们可以继续调细节。",
    "完成了，要不要再试一版不同节奏？",
    "干得漂亮，我们可以继续升级动作。",
  ],
  celebrate: [
    "成功！这版节奏很顺。",
    "里程碑达成，导出和复用都准备好了。",
    "表现很好，建议保存这次参数。",
  ],
  error: [
    "这次没成功，我们先换个思路再试一次。",
    "可以先把动作描述简化一点，再继续尝试。",
    "别着急，我陪你一步步排查并重试。",
  ],
};

const OVERLAY_SCRIPTS: Record<PetOverlayMood, string[]> = {
  happy: ["收到，继续协作。", "在的，我会继续帮你。"],
  angry: ["别连点我，我还在工作。", "我会响应，慢一点点点我。"],
  attack: ["点太快了，我要防御了。", "触发过载了，先停一下。"],
};

function pickFromPool(pool: string[], prev?: string): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0];
  const candidates = prev ? pool.filter((item) => item !== prev) : pool;
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function pickMoodScript(mood: PetMood, prev?: string): string {
  return pickFromPool(MOOD_SCRIPTS[mood], prev);
}

export function pickOverlayScript(mood: PetOverlayMood, prev?: string): string {
  return pickFromPool(OVERLAY_SCRIPTS[mood], prev);
}

const ACTION_DEMO_SCRIPTS: Partial<Record<ActionType, string>> = {
  walk: "来，我给你走一段！行走动作是这样的~",
  run: "奔跑模式开启，看好了！",
  idle: "待机就是这样，悠闲自在~",
  jump: "我来给你看看跳跃是什么样！",
  attack: "攻击动作登场，看好了！",
  fall: "摔倒动作，有点心疼，但就是这个感觉！",
};

export function pickActionDemoScript(actionId: ActionType): string {
  return ACTION_DEMO_SCRIPTS[actionId] ?? `来，看看${actionId}动作是什么样的！`;
}

const PROMPT_BLUR_SCRIPTS = [
  "我看到你写了描述，要不要我帮你润色成英文 prompt？",
  "有了描述，让我帮你优化成更精准的 prompt 吧！",
  "看到你有描述了，我可以帮你整理成标准英文 prompt。",
];

export function pickPromptBlurScript(prev?: string): string {
  return pickFromPool(PROMPT_BLUR_SCRIPTS, prev);
}

const IDLE_AUTO_SCRIPTS: Record<"idle" | "guide", string[]> = {
  idle: [
    "练练步伐~",
    "有什么需要我帮忙的吗？",
    "今天要生成什么动图呢…",
    "…（伸懒腰）",
    "像素宇宙好大啊",
    "要不要试试生成一个动图？",
    "可以帮你优化描述哦，叫我一声！",
  ],
  guide: [
    "把图片拖进来，我来变魔法！",
    "上传一张图片，我帮你做成动图~",
    "先上传角色图，我来帮你安排动作！",
  ],
};

export function pickRandomIdleScript(mood: PetMood, prev?: string): string {
  const pool = mood === "guide" ? IDLE_AUTO_SCRIPTS.guide : IDLE_AUTO_SCRIPTS.idle;
  return pickFromPool(pool, prev);
}
