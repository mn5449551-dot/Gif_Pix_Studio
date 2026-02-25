export type ActionType =
  | "walk"
  | "run"
  | "idle"
  | "attack"
  | "jump"
  | "fall"
  | "custom";

export type GifExportSize = "original" | 300 | 360 | 480 | 640;

export type LocalTaskStatus =
  | "draft"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "expired";

export interface LocalSettings {
  apiHost: "https://grsai.dakka.com.cn" | "https://grsaiapi.com";
  apiKey: string;
  defaultModel: string;
  llmProvider: "doubao_ark" | "openai_compatible" | "custom_compatible";
  llmApiHost: string;
  llmApiKey: string;
  llmModel: string;
  trustedLlmHosts: string[];
}

export interface LocalHistoryItem {
  id: string;
  actionId: ActionType;
  prompt: string;
  fps?: number;
  finalPrompt?: string;
  model: string;
  providerTaskId?: string;
  createdAt: string;
  updatedAt: string;
  status: LocalTaskStatus;
  progress: number;
  resultUrl?: string;
  localGifReady?: boolean;
  localSpriteReady?: boolean;
  editedGifReady?: boolean;
  removedFrameIndexes?: number[];
  editedAt?: string;
  urlExpiresAt?: string;
  failureReason?: string;
  error?: string;
}

export interface PromptComposeInput {
  actionType: ActionType;
  userCustomPrompt?: string;
}

export interface PromptComposeOutput {
  baseTemplate: string;
  actionPrompt: string;
  customPrompt: string;
  finalPrompt: string;
}

export interface NanoCreateTaskResponse {
  code?: number;
  msg?: string;
  data?: { id?: string };
  id?: string;
}

export interface NanoResultData {
  id?: string;
  results?: Array<{ url?: string; content?: string }>;
  progress?: number;
  status?: "running" | "succeeded" | "failed";
  failure_reason?: string;
  error?: string;
}

export type PetMood =
  | "idle"
  | "guide"
  | "thinking"
  | "happy"
  | "celebrate"
  | "error";

export type PetOverlayMood = "happy" | "angry" | "attack";

export type AutoAnim = "patrol_left" | "patrol_right" | "auto_jump" | null;

export type PromptFillMode = "replace" | "append";

export interface PromptFillCommand {
  id: string;
  text: string;
  mode: PromptFillMode;
}

export interface PendingPromptFill extends PromptFillCommand {
  createdAt: number;
}

export interface PetCreateContext {
  actionId: ActionType;
  actionLabel: string;
  customPrompt: string;
  hasImage: boolean;
}

export type PetEventType =
  | "page:create:entered"
  | "image:uploaded"
  | "image:audit"
  | "image:cleared"
  | "task:generate:start"
  | "task:generate:progress"
  | "task:generate:success"
  | "task:generate:failed"
  | "task:generate:cancelled"
  | "task:reencode:start"
  | "task:reencode:success"
  | "task:reencode:failed"
  | "action:preview"
  | "prompt:input:blur";

export interface PetEventPayloadMap {
  "page:create:entered": Partial<PetCreateContext>;
  "image:uploaded": Partial<PetCreateContext>;
  "image:audit": {
    grade: "good" | "ok" | "warn";
    summary: string;
  };
  "image:cleared": Partial<PetCreateContext>;
  "task:generate:start": Partial<PetCreateContext>;
  "task:generate:progress": { progress: number };
  "task:generate:success": { milestone?: boolean };
  "task:generate:failed": { reason?: string };
  "task:generate:cancelled": Record<string, never>;
  "task:reencode:start": Record<string, never>;
  "task:reencode:success": Record<string, never>;
  "task:reencode:failed": { reason?: string };
  "action:preview": { actionId: ActionType };
  "prompt:input:blur": { hasContent: boolean };
}

export interface PetPreferences {
  enabled: boolean;
  collapsed: boolean;
  lastMood: PetMood;
}

export interface PetChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

export interface PetChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: PetChatMessage[];
}

export type PetIntent = "smalltalk" | "optimize" | "clarify";

export interface PetPersonaProfile {
  name: "小灵";
  personaVersion: "v1";
}

export interface PetConversationResult {
  source: "llm" | "fallback";
  intent: PetIntent;
  replyZh: string;
  actionDescriptionEn?: string;
  needClarify?: boolean;
  questionZh?: string;
  shouldOfferFill?: boolean;
  error?: string;
}
