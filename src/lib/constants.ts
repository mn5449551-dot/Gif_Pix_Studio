import type { ActionType, GifExportSize, LocalSettings, PetPersonaProfile } from "@/lib/types";

export const SETTINGS_KEY_V1 = "gifwechat.settings.v1";
export const SETTINGS_KEY_V2 = "gifwechat.settings.v2";
export const SETTINGS_KEY = SETTINGS_KEY_V2;
export const HISTORY_KEY = "gifwechat.history.v1";
export const PET_PREFERENCES_KEY = "gifwechat_pet_preferences";
export const PET_CHAT_HISTORY_KEY = "gifwechat.pet.chat.history.v1";
export const PET_PROFILE_KEY = "gifwechat.pet.profile.v1";
export const MAX_HISTORY = 200;
export const RESULT_TTL_MS = 2 * 60 * 60 * 1000;
export const PENDING_TASK_STALE_MS = 5 * 60 * 1000;
export const DEFAULT_FPS = 12;
export const FPS_OPTIONS = [8, 10, 12, 16, 20, 24] as const;
export const MAX_REMOVED_FRAMES = 8;
export const SPRITE_ROWS = 4;
export const SPRITE_COLS = 4;
export const SPRITE_FRAME_COUNT = 16;
export const BG_REMOVAL_TOLERANCE = 30;
export const TOAST_DURATION_MS = 2400;
export const CUSTOM_PROMPT_MAX_LENGTH = 300;
export const GIF_EXPORT_SIZE_OPTIONS: Array<{ value: GifExportSize; label: string }> = [
  { value: "original", label: "原始尺寸" },
  { value: 300, label: "300 x 300" },
  { value: 360, label: "360 x 360" },
  { value: 480, label: "480 x 480" },
  { value: 640, label: "640 x 640" },
];
export const LLM_TIMEOUT_MS = 20_000;
export const LLM_RATE_LIMIT_PER_MIN = 6;
export const DEFAULT_TRUSTED_LLM_HOSTS = ["ark.cn-beijing.volces.com", "api.openai.com"];

export const DOUBAO_ARK_DEFAULT_HOST = "https://ark.cn-beijing.volces.com/api/v3";
export const DOUBAO_ARK_DEFAULT_MODEL = "doubao-seed-2-0-mini-260215";
export const GRSAI_APIKEY_URL = "https://grsai.com/zh/dashboard/api-keys";
export const DOUBAO_ARK_APIKEY_URL =
  "https://console.volcengine.com/ark/region:ark+cn-beijing/apikey";
export const DOUBAO_ARK_DOC_URL = "https://www.volcengine.com/docs/82379/1399008?lang=zh";

export const DEFAULT_SETTINGS: LocalSettings = {
  apiHost: "https://grsaiapi.com",
  apiKey: "",
  defaultModel: "nano-banana-pro",
  llmProvider: "doubao_ark",
  llmApiHost: DOUBAO_ARK_DEFAULT_HOST,
  llmApiKey: "",
  llmModel: DOUBAO_ARK_DEFAULT_MODEL,
  trustedLlmHosts: [...DEFAULT_TRUSTED_LLM_HOSTS],
};

export const ACTION_LABELS: Record<ActionType, string> = {
  walk: "行走",
  run: "奔跑",
  idle: "待机",
  attack: "攻击",
  jump: "跳跃",
  fall: "倒地",
  custom: "自定义",
};

export const ACTION_PROMPTS: Record<ActionType, string> = {
  walk:
    "16-frame side-view walk loop, one facing direction. Key pose order: right-contact -> down -> passing -> up -> left-contact -> down -> passing -> up, then continue to frame 16 and loop to frame 1. Obvious stepping (not idle): clear foot separation, left-right weight shift, opposite arm swing. No duplicate or near-duplicate adjacent frames.",
  run:
    "16-frame run loop, one facing direction only. Fast contact/recoil with clear airborne moments, strong forward lean, and energetic opposite arm swing. Keep motion progression obvious in every frame; no duplicate or near-duplicate adjacent frames. Never flip/mirror or turn to the opposite side.",
  jump:
    "16-frame jump loop: crouch -> takeoff -> peak -> descent -> landing -> recovery. Keep arc and timing coherent, with clear vertical displacement and landing compression. No duplicate or near-duplicate adjacent frames; frame 16 loops naturally to frame 1.",
  idle:
    "16-frame subtle idle loop, one facing direction. Keep frames mostly similar with tiny breathing, slight body sway, and occasional blink. Motion must stay minimal and calm; micro-change is expected (adjacent frames can be close). Seamless loop from frame 16 to frame 1.",
  attack:
    "16-frame melee attack loop: wind-up -> strike -> follow-through -> recover. Keep strong silhouette changes and readable impact timing. Clear progression per frame, no duplicate or near-duplicate adjacent frames, and natural loop continuity.",
  fall:
    "16-frame fall/hit loop: lose balance -> descend -> impact -> settle. Emphasize gravity and weight with visible vertical change and impact compression. Keep per-frame progression clear, avoid duplicate or near-duplicate adjacent frames, and maintain a smooth loop.",
  custom:
    "16-frame animation of: {user_custom_prompt}. Keep a complete smooth loop.",
};

export const PET_PERSONA_PROFILE: PetPersonaProfile = {
  name: "小灵",
  personaVersion: "v1",
};

export const BASE_TEMPLATE = `Convert this character image into a pixel art sprite sheet for game animation.

=== LAYOUT ===
- 4 rows x 4 columns = 16 animation frames total (left-to-right, top-to-bottom)
- Square canvas (1:1 ratio)
- Seamless white background (#FFFFFF), no cell border lines

=== CHARACTER CONSISTENCY (CRITICAL) ===
- Keep body proportions, face/hair/clothes colors and character size consistent across all frames
- Only limb pose changes between frames
- Full body visible in each frame

=== LOOP STABILITY (CRITICAL) ===
- Fixed camera and framing for all 16 frames (no zoom, no pan, no crop changes)
- Keep character anchored to a stable center and stable scale to avoid jitter/flicker
- Preserve silhouette readability frame-to-frame; no random shape mutation
- Use smooth in-between transitions with even temporal spacing
- Frame 16 must connect naturally back to frame 1 for a seamless loop

=== ANIMATION ===
[INJECT_ACTION_PROMPT]

=== PIXEL ART STYLE ===
- 8-bit retro game sprite style
- Clean black outlines
- Limited palette (16-32 colors)
- No anti-aliasing`;
