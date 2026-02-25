import {
  DEFAULT_TRUSTED_LLM_HOSTS,
  LLM_RATE_LIMIT_PER_MIN,
  LLM_TIMEOUT_MS,
} from "@/lib/constants";
import { getDefaultClarifyQuestion, getFallbackActionDescription } from "@/lib/pet/pet-templates";
import type {
  ActionType,
  LocalSettings,
  PetConversationResult,
  PetIntent,
} from "@/lib/types";

export interface PromptAssistInput {
  actionId: ActionType;
  actionLabel: string;
  customPrompt: string;
  userMessage: string;
  settings: LocalSettings;
}

export interface PromptAssistResult {
  source: "llm" | "fallback";
  needClarify: boolean;
  questionZh: string;
  actionDescriptionEn: string;
  error?: string;
}

export interface PetConversationInput extends PromptAssistInput {
  smalltalkTurnsInSession?: number;
  clarifyTurnsInSession?: number;
  forceOptimize?: boolean;
}

interface ParsedLlmResponse {
  need_clarify?: boolean;
  question_zh?: string;
  action_description_en?: string;
}

interface ParsedConversationResponse {
  intent?: string;
  reply_zh?: string;
  need_clarify?: boolean;
  question_zh?: string;
  action_description_en?: string;
  should_offer_fill?: boolean;
}

const callTimestamps: number[] = [];
const LLM_MAX_RETRY = 1;
const LLM_RETRY_DELAY_MS = 450;
const ACTION_DESCRIPTION_TARGET_CHARS = 280;
const ACTION_DESCRIPTION_HARD_CHARS = 300;

function markRateLimit(): void {
  const now = Date.now();
  while (callTimestamps.length > 0 && now - callTimestamps[0] > 60_000) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= LLM_RATE_LIMIT_PER_MIN) {
    throw new Error("LLM 调用过于频繁，请稍后再试。");
  }
  callTimestamps.push(now);
}

function extractHostname(input: string): string | null {
  try {
    const value = input.includes("://") ? input : `https://${input}`;
    const url = new URL(value);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function validateLlmHost(settings: LocalSettings): URL {
  let url: URL;
  try {
    url = new URL(settings.llmApiHost);
  } catch {
    throw new Error("LLM Host 格式无效，请填写完整 https 地址。");
  }
  if (url.protocol !== "https:") {
    throw new Error("LLM Host 仅支持 https 协议。");
  }

  const allowedHostnames = new Set(
    [...DEFAULT_TRUSTED_LLM_HOSTS, ...(settings.trustedLlmHosts ?? [])]
      .map((item) => extractHostname(item))
      .filter((item): item is string => Boolean(item)),
  );
  if (!allowedHostnames.has(url.hostname.toLowerCase())) {
    throw new Error("当前 LLM Host 不在白名单中，请先在设置页加入受信任域名。");
  }

  return url;
}

function buildLlmEndpoint(baseUrl: URL): string {
  const base = baseUrl.toString().replace(/\/+$/, "");
  // OpenAI-compatible endpoints:
  // - OpenAI style: https://api.openai.com/v1/chat/completions
  // - Volcengine Ark style: https://ark.cn-beijing.volces.com/api/v3/chat/completions
  if (base.endsWith("/chat/completions")) {
    return base;
  }
  if (base.endsWith("/v1") || base.endsWith("/api/v3")) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

function supportsJsonResponseFormat(settings: LocalSettings): boolean {
  // Doubao Ark chat/completions currently rejects response_format=json_object for this model.
  // Keep compatibility by relying on prompt-constrained JSON + local parser fallback.
  return settings.llmProvider !== "doubao_ark";
}

function extractMessageContent(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find(
      (item) => typeof item === "object" && item !== null && "text" in item,
    ) as { text?: string } | undefined;
    if (textPart?.text) return textPart.text;
  }
  return "";
}

function parseJsonFromText<T extends object>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    // handle fenced markdown or extra commentary around JSON
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as T;
    } catch {
      return null;
    }
  }
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    error instanceof TypeError ||
    text.includes("networkerror") ||
    text.includes("failed to fetch") ||
    text.includes("err_network_changed") ||
    text.includes("network changed")
  );
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return text.includes("abort") || text.includes("timeout") || text.includes("timed out");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postLlmRequest(
  endpoint: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= LLM_MAX_RETRY; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      const retryable = isTimeoutError(error) || isTransientNetworkError(error);
      if (!retryable || attempt >= LLM_MAX_RETRY) throw error;
      await wait(LLM_RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM 调用失败");
}

function normalizeNetworkErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    const timeoutSeconds = Math.round(LLM_TIMEOUT_MS / 1000);
    return `LLM 请求超时（${timeoutSeconds}s，已自动重试一次），请检查网络或稍后重试。`;
  }
  if (isTransientNetworkError(error)) {
    return "网络连接异常（可能网络切换/代理变更导致）。请固定网络后重试。";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "LLM 调用失败";
}

function fallbackResult(
  input: PromptAssistInput,
  error?: string,
): PromptAssistResult {
  const sourceDescription = getFallbackActionDescription(input.actionId, input.userMessage);
  return {
    source: "fallback",
    needClarify: false,
    questionZh: "",
    actionDescriptionEn: compressActionDescription(sourceDescription),
    error,
  };
}

function createSystemPrompt(input: PromptAssistInput): string {
  return [
    "你是像素动画提示词助手，专为 16 帧角色精灵动画提炼动作描述。",
    "你的输出会注入英文 prompt，用于 AI 生成 4×4 精灵表（16 帧无缝循环）。",
    "",
    `当前动作：${input.actionId}（${input.actionLabel}）`,
    `用户已填描述：${input.customPrompt || "无"}`,
    "",
    "当前动作模板只作为参考，优先根据用户最新输入生成可执行的动作描述。",
    "不要逐帧列 16 帧；改为动作总结 + 动作顺序 + 肢体机制。",
    "动作顺序要可执行，描述具体身体部位与节奏，不要只给动作名。",
    "输出必须是英文，并使用以下结构：",
    "Summary: ... Sequence: ... Body: ...",
    "长度控制：目标 220-280 字符，硬上限 300 字符。",
    "若信息不足，先追问一个关键问题。",
    "",
    "严格输出 JSON，不含其他内容：",
    '{"need_clarify": false, "question_zh": "", "action_description_en": ""}',
    "",
    "规则：",
    "1. 信息不足 -> need_clarify=true，question_zh 给中文追问（可 1-2 句）。",
    "2. 信息足够 -> need_clarify=false，action_description_en 输出 Summary/Sequence/Body。",
    "3. action_description_en 只输出一段英文，不要 markdown，不要换行。",
    "4. 仅输出 JSON。",
  ].join("\n");
}

const OPTIMIZE_HINTS = [
  "优化",
  "整理",
  "润色",
  "改写",
  "生成",
  "动作",
  "prompt",
  "提示词",
  "细节",
  "描述",
  "跳舞",
  "舞蹈",
  "招手",
  "挥手",
  "转圈",
  "奔跑",
  "行走",
  "跳跃",
  "攻击",
  "待机",
  "倒地",
  "run",
  "walk",
  "jump",
  "attack",
  "idle",
  "fall",
];

const CLARIFY_HINTS = ["不知道", "不确定", "怎么写", "帮我想", "没想好", "不太会", "给我建议"];

function includesAny(input: string, pool: string[]): boolean {
  return pool.some((item) => input.includes(item));
}

function normalizeInlineText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTrailingPunctuation(input: string): string {
  return input.replace(/[;,:.\s]+$/g, "").trim();
}

function clampByChars(input: string, maxChars: number): string {
  if (input.length <= maxChars) return trimTrailingPunctuation(input);
  const cut = input.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const value = (lastSpace > Math.floor(maxChars * 0.65) ? cut.slice(0, lastSpace) : cut).trim();
  return trimTrailingPunctuation(value);
}

function extractSection(text: string, section: "Summary" | "Sequence" | "Body"): string {
  const pattern = new RegExp(
    `${section}\\s*:\\s*([\\s\\S]*?)(?=(?:Summary|Sequence|Body)\\s*:|$)`,
    "i",
  );
  const matched = text.match(pattern)?.[1] ?? "";
  return normalizeInlineText(matched);
}

function ensureSentence(input: string): string {
  const normalized = trimTrailingPunctuation(normalizeInlineText(input));
  if (!normalized) return "";
  return `${normalized}.`;
}

function parseStructuredSections(input: string): {
  summary: string;
  sequence: string;
  body: string;
} {
  const normalized = normalizeInlineText(input);
  const summary = extractSection(normalized, "Summary");
  const sequence = extractSection(normalized, "Sequence");
  const body = extractSection(normalized, "Body");

  if (summary || sequence || body) {
    return {
      summary: summary || "Custom action loop",
      sequence: sequence || "anticipation; main burst; follow-through; reset to loop",
      body: body || "clear weight shift, readable limb arcs, smooth settle",
    };
  }

  const sentences = normalized
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    summary: sentences[0] || "Custom action loop",
    sequence: sentences.slice(1, 3).join("; ") || normalized || "anticipation; main burst; follow-through; reset",
    body: "clear weight shift, readable limb arcs, smooth settle",
  };
}

function composeStructuredDescription(sections: {
  summary: string;
  sequence: string;
  body: string;
}): string {
  const summary = ensureSentence(sections.summary);
  const sequence = ensureSentence(sections.sequence);
  const body = ensureSentence(sections.body);
  return `Summary: ${summary} Sequence: ${sequence} Body: ${body}`;
}

function compressActionDescription(input: string): string {
  const sections = parseStructuredSections(input);
  const phaseOne = {
    summary: clampByChars(sections.summary, 56),
    sequence: clampByChars(sections.sequence, 138),
    body: clampByChars(sections.body, 92),
  };
  let output = composeStructuredDescription(phaseOne);

  if (output.length > ACTION_DESCRIPTION_TARGET_CHARS) {
    output = composeStructuredDescription({
      summary: clampByChars(phaseOne.summary, 44),
      sequence: clampByChars(phaseOne.sequence, 118),
      body: clampByChars(phaseOne.body, 72),
    });
  }

  if (output.length > ACTION_DESCRIPTION_HARD_CHARS) {
    output = clampByChars(output, ACTION_DESCRIPTION_HARD_CHARS);
    if (!/[.!?]$/.test(output)) output = `${output}.`;
  }

  return output;
}

function isLikelyOptimizeMessage(userMessage: string): boolean {
  const text = userMessage.trim().toLowerCase();
  return includesAny(text, OPTIMIZE_HINTS);
}

function isLikelyClarifyMessage(userMessage: string): boolean {
  const text = userMessage.trim().toLowerCase();
  return includesAny(text, CLARIFY_HINTS);
}

const SMALLTALK_HINTS = [
  "你好",
  "在吗",
  "哈哈",
  "谢谢",
  "hi",
  "hello",
  "good morning",
  "good night",
];

function isLikelySmalltalkMessage(userMessage: string): boolean {
  const text = userMessage.trim().toLowerCase();
  return includesAny(text, SMALLTALK_HINTS);
}

function pickSmalltalkFallbackReply(smalltalkTurnsInSession: number): {
  replyZh: string;
  shouldOfferFill: boolean;
} {
  const replies = [
    "小灵在，今天想做什么风格呀？",
    "收到，我可以陪你聊，也可以随时帮你整理动作描述。",
    "我在这儿，想到动作灵感就告诉我。",
  ];
  const base = replies[Math.floor(Math.random() * replies.length)];
  const shouldOfferFill = smalltalkTurnsInSession >= 2;
  if (!shouldOfferFill) {
    return { replyZh: base, shouldOfferFill: false };
  }
  return {
    replyZh: `${base} 要不要现在给我一句动作想法，我帮你整理成可生成描述？`,
    shouldOfferFill: true,
  };
}

function classifyIntentLocally(userMessage: string): PetIntent {
  const text = userMessage.trim();
  if (!text) return "clarify";
  if (isLikelyClarifyMessage(text)) return "clarify";
  if (isLikelyOptimizeMessage(text)) return "optimize";
  if (isLikelySmalltalkMessage(text)) return "smalltalk";
  // Action-style short input (e.g. "跳舞", "招手", "spin kick") should go to optimize by default.
  if (text.length <= 32) return "optimize";
  return "smalltalk";
}

function createConversationRoutePrompt(input: PetConversationInput): string {
  const clarifyTurns = Math.max(0, Number(input.clarifyTurnsInSession ?? 0));
  const shouldAssumeDefaults = Boolean(input.forceOptimize) || clarifyTurns >= 1;
  return [
    "你是“小灵”，像素动图创作搭档，语气俏皮简短（1-3句）。",
    "你要先判断用户输入意图，再输出统一 JSON。",
    "",
    `当前动作模板：${input.actionId}（${input.actionLabel}）`,
    `当前自定义描述：${input.customPrompt || "无"}`,
    `当前追问轮次：${clarifyTurns}`,
    `是否已到追问上限：${shouldAssumeDefaults ? "是" : "否"}`,
    "",
    "intent 仅可为：smalltalk | optimize | clarify",
    "",
    "路由规则：",
    "1. 用户给动作想法/要求优化/描述动作细节 -> optimize（无论当前是模板动作还是自定义动作）",
    "2. 与创作相关但关键信息不足 -> clarify（最多追问一轮）",
    "3. 若已追问过一轮仍信息不足，则不要再次 clarify，直接按常见默认补全并走 optimize",
    "4. 纯闲聊 -> smalltalk",
    "",
    "optimize 的 action_description_en 结构必须是：Summary: ... Sequence: ... Body: ...",
    "不要逐帧列 16 帧，要写动作顺序与肢体机制；目标 220-280 字符，最多 300 字符。",
    "",
    "返回 JSON（不要额外文本）：",
    '{"intent":"smalltalk","reply_zh":"","need_clarify":false,"question_zh":"","action_description_en":"","should_offer_fill":false}',
    "",
    "字段规则：",
    "- smalltalk: reply_zh 给闲聊或引导；action_description_en 置空。",
    "- optimize: reply_zh 先确认理解；action_description_en 给英文结构化动作描述。",
    "- clarify: need_clarify=true，question_zh 只问一个关键问题（可稍详细，1-2句）。",
    "- should_offer_fill 仅在建议“可帮你整理描述/可填入”时为 true。",
    "- 只输出 JSON。",
  ].join("\n");
}

function normalizeIntent(input: string | undefined, fallback: PetIntent): PetIntent {
  if (input === "smalltalk" || input === "optimize" || input === "clarify") return input;
  return fallback;
}

function hasReachedClarifyLimit(input: PetConversationInput): boolean {
  return Boolean(input.forceOptimize) || Math.max(0, Number(input.clarifyTurnsInSession ?? 0)) >= 1;
}

function buildAssumedOptimizeDescription(input: PetConversationInput): string {
  const merged = [input.userMessage.trim(), input.customPrompt.trim()].filter(Boolean).join(". ");
  const source = merged || "custom motion idea";
  return compressActionDescription(getFallbackActionDescription("custom", source));
}

async function fallbackRouteConversation(
  input: PetConversationInput,
  error?: string,
  options?: { skipLlmAssist?: boolean },
): Promise<PetConversationResult> {
  const trimmed = input.userMessage.trim();
  if (!trimmed) {
    const question = getDefaultClarifyQuestion(input.actionId);
    return {
      source: "fallback",
      intent: "clarify",
      replyZh: question,
      needClarify: true,
      questionZh: question,
      shouldOfferFill: false,
      error: error ?? "请先输入你想要的动作细节。",
    };
  }

  const localIntent = input.forceOptimize ? "optimize" : classifyIntentLocally(trimmed);
  if (localIntent === "smalltalk") {
    const smalltalk = pickSmalltalkFallbackReply(input.smalltalkTurnsInSession ?? 0);
    return {
      source: "fallback",
      intent: "smalltalk",
      replyZh: smalltalk.replyZh,
      shouldOfferFill: smalltalk.shouldOfferFill,
      error,
    };
  }

  if (localIntent === "clarify") {
    if (hasReachedClarifyLimit(input)) {
      return {
        source: "fallback",
        intent: "optimize",
        replyZh: "我先按常见动画节奏补全细节，给你一版可直接生成的描述。",
        actionDescriptionEn: buildAssumedOptimizeDescription(input),
        needClarify: false,
        questionZh: "",
        shouldOfferFill: true,
        error,
      };
    }

    const question = getDefaultClarifyQuestion(input.actionId);
    return {
      source: "fallback",
      intent: "clarify",
      replyZh: question,
      needClarify: true,
      questionZh: question,
      shouldOfferFill: false,
      error,
    };
  }

  if (options?.skipLlmAssist) {
    return {
      source: "fallback",
      intent: "optimize",
      replyZh: "我先用本地模板给你一版可用描述。",
      actionDescriptionEn: compressActionDescription(getFallbackActionDescription(input.actionId, trimmed)),
      needClarify: false,
      questionZh: "",
      shouldOfferFill: true,
      error,
    };
  }

  const assist = await requestPromptAssist(input);
  if (assist.needClarify) {
    if (hasReachedClarifyLimit(input)) {
      return {
        source: assist.source,
        intent: "optimize",
        replyZh: "我先按常见动画节奏补全细节，给你一版可直接生成的描述。",
        actionDescriptionEn: buildAssumedOptimizeDescription(input),
        needClarify: false,
        questionZh: "",
        shouldOfferFill: true,
        error: assist.error ?? error,
      };
    }

    const question = assist.questionZh || getDefaultClarifyQuestion(input.actionId);
    return {
      source: assist.source,
      intent: "clarify",
      replyZh: question,
      needClarify: true,
      questionZh: question,
      shouldOfferFill: false,
      error: assist.error ?? error,
    };
  }

  return {
    source: assist.source,
    intent: "optimize",
    replyZh:
      assist.source === "llm"
        ? "我先给你整理了一版可直接生成的动作描述。"
        : "小灵先用本地模板给你一版可用描述。",
    actionDescriptionEn: compressActionDescription(assist.actionDescriptionEn),
    needClarify: false,
    questionZh: "",
    shouldOfferFill: true,
    error: assist.error ?? error,
  };
}

export async function validateLlmApiKey(settings: LocalSettings): Promise<boolean> {
  if (!settings.llmApiKey.trim()) return false;

  let endpoint = "";
  try {
    const host = validateLlmHost(settings);
    endpoint = buildLlmEndpoint(host);
  } catch (error) {
    throw error instanceof Error ? error : new Error("LLM Host 校验失败");
  }

  try {
    const apiKey = settings.llmApiKey.trim();
    const requestBody: Record<string, unknown> = {
      model: settings.llmModel,
      temperature: 0,
      max_tokens: 8,
      messages: [
        { role: "system", content: "Return a JSON object: {\"ok\": true}" },
        { role: "user", content: "ping" },
      ],
    };
    if (supportsJsonResponseFormat(settings)) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await postLlmRequest(endpoint, apiKey, requestBody);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) return false;
      throw new Error(`LLM 验证失败(${response.status}) ${detail.slice(0, 200)}`);
    }

    return true;
  } catch (error) {
    throw new Error(normalizeNetworkErrorMessage(error));
  }
}

export async function requestPromptAssist(
  input: PromptAssistInput,
): Promise<PromptAssistResult> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) {
    return {
      source: "fallback",
      needClarify: true,
      questionZh: getDefaultClarifyQuestion(input.actionId),
      actionDescriptionEn: "",
      error: "请先输入你想要的动作细节。",
    };
  }

  if (!input.settings.llmApiKey.trim()) {
    return fallbackResult(input, "未设置 LLM API Key，已切换到本地模板建议。");
  }

  try {
    markRateLimit();
    const host = validateLlmHost(input.settings);
    const endpoint = buildLlmEndpoint(host);
    const apiKey = input.settings.llmApiKey.trim();

    const requestBody: Record<string, unknown> = {
      model: input.settings.llmModel,
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        { role: "system", content: createSystemPrompt(input) },
        { role: "user", content: userMessage.slice(0, 300) },
      ],
    };
    if (supportsJsonResponseFormat(input.settings)) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await postLlmRequest(endpoint, apiKey, requestBody);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM 请求失败(${response.status}) ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as unknown;
    const content = extractMessageContent(payload);
    const parsed = parseJsonFromText<ParsedLlmResponse>(content);
    if (!parsed) {
      return fallbackResult(input, "LLM 返回格式异常，已使用本地模板建议。");
    }

    const needClarify = Boolean(parsed.need_clarify);
    const questionZh = (parsed.question_zh ?? "").toString().trim();
    const actionDescriptionEn = (parsed.action_description_en ?? "").toString().trim();

    if (needClarify) {
      return {
        source: "llm",
        needClarify: true,
        questionZh: questionZh || getDefaultClarifyQuestion(input.actionId),
        actionDescriptionEn: "",
      };
    }

    if (!actionDescriptionEn) {
      return fallbackResult(input, "LLM 未返回可用描述，已使用本地模板建议。");
    }

    return {
      source: "llm",
      needClarify: false,
      questionZh: "",
      actionDescriptionEn: compressActionDescription(actionDescriptionEn),
    };
  } catch (error) {
    return fallbackResult(input, normalizeNetworkErrorMessage(error));
  }
}

export async function routePetConversation(
  input: PetConversationInput,
): Promise<PetConversationResult> {
  const trimmed = input.userMessage.trim();
  const fallbackIntent = input.forceOptimize ? "optimize" : classifyIntentLocally(trimmed);
  if (!trimmed) {
    const question = getDefaultClarifyQuestion(input.actionId);
    return {
      source: "fallback",
      intent: "clarify",
      replyZh: question,
      needClarify: true,
      questionZh: question,
      shouldOfferFill: false,
      error: "请先输入你想要的动作细节。",
    };
  }

  if (!input.settings.llmApiKey.trim()) {
    return fallbackRouteConversation(input, "未设置 LLM API Key，已切换到本地路由建议。");
  }

  try {
    markRateLimit();
    const host = validateLlmHost(input.settings);
    const endpoint = buildLlmEndpoint(host);
    const apiKey = input.settings.llmApiKey.trim();

    const requestBody: Record<string, unknown> = {
      model: input.settings.llmModel,
      temperature: 0.45,
      max_tokens: 420,
      messages: [
        { role: "system", content: createConversationRoutePrompt(input) },
        { role: "user", content: trimmed.slice(0, 300) },
      ],
    };
    if (supportsJsonResponseFormat(input.settings)) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await postLlmRequest(endpoint, apiKey, requestBody);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM 请求失败(${response.status}) ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as unknown;
    const content = extractMessageContent(payload);
    const parsed = parseJsonFromText<ParsedConversationResponse>(content);
    if (!parsed) {
      return fallbackRouteConversation(input, "LLM 返回格式异常，已切换到本地路由。");
    }

    const intent = normalizeIntent(parsed.intent?.trim(), fallbackIntent);
    if (intent === "optimize") {
      const needClarify = Boolean(parsed.need_clarify);
      const questionZh = (parsed.question_zh ?? "").toString().trim();
      const actionDescriptionEn = compressActionDescription(
        (parsed.action_description_en ?? "").toString().trim(),
      );
      const replyZh = (parsed.reply_zh ?? "").toString().trim();

      if (needClarify || !actionDescriptionEn) {
        if (hasReachedClarifyLimit(input)) {
          return {
            source: "llm",
            intent: "optimize",
            replyZh: replyZh || "我先按常见动画节奏补全细节，给你一版可直接生成的描述。",
            actionDescriptionEn: buildAssumedOptimizeDescription(input),
            needClarify: false,
            questionZh: "",
            shouldOfferFill: true,
          };
        }

        const fallbackQuestion = questionZh || getDefaultClarifyQuestion(input.actionId);
        return {
          source: "llm",
          intent: "clarify",
          replyZh: replyZh || fallbackQuestion,
          needClarify: true,
          questionZh: fallbackQuestion,
          shouldOfferFill: false,
        };
      }

      return {
        source: "llm",
        intent: "optimize",
        replyZh: replyZh || "我先给你整理了一版可直接生成的动作描述。",
        actionDescriptionEn,
        needClarify: false,
        questionZh: "",
        shouldOfferFill: true,
      };
    }

    if (intent === "clarify") {
      if (hasReachedClarifyLimit(input)) {
        return {
          source: "llm",
          intent: "optimize",
          replyZh: "我先按常见动画节奏补全细节，给你一版可直接生成的描述。",
          actionDescriptionEn: buildAssumedOptimizeDescription(input),
          needClarify: false,
          questionZh: "",
          shouldOfferFill: true,
        };
      }

      const questionZh = (parsed.question_zh ?? "").toString().trim() || getDefaultClarifyQuestion(input.actionId);
      const replyZh = (parsed.reply_zh ?? "").toString().trim() || questionZh;
      return {
        source: "llm",
        intent: "clarify",
        replyZh,
        needClarify: true,
        questionZh,
        shouldOfferFill: false,
      };
    }

    const smalltalkFallback = pickSmalltalkFallbackReply(input.smalltalkTurnsInSession ?? 0);
    const replyZh = (parsed.reply_zh ?? "").toString().trim() || smalltalkFallback.replyZh;
    return {
      source: "llm",
      intent: "smalltalk",
      replyZh,
      shouldOfferFill: Boolean(parsed.should_offer_fill),
      needClarify: false,
      questionZh: "",
    };
  } catch (error) {
    return fallbackRouteConversation(input, normalizeNetworkErrorMessage(error), { skipLlmAssist: true });
  }
}
