import type { LocalSettings, NanoCreateTaskResponse, NanoResultData } from "@/lib/types";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};
const APIKEY_VALIDATE_TIMEOUT_MS = 12_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldFallbackByMessage(message: string): boolean {
  return (
    message.includes("网络连接失败") ||
    message.includes("Failed to fetch") ||
    message.includes("请求失败(5")
  );
}

function parseJsonSafe(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getFallbackHost(host: LocalSettings["apiHost"]): LocalSettings["apiHost"] {
  return host === "https://grsai.dakka.com.cn"
    ? "https://grsaiapi.com"
    : "https://grsai.dakka.com.cn";
}

function parseApiLogicError(payload: unknown): { code: number; message: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const rawCode = record.code;
  if (typeof rawCode !== "number" || rawCode === 0) return null;

  const message =
    (typeof record.msg === "string" && record.msg) ||
    (typeof record.error === "string" && record.error) ||
    (typeof record.message === "string" && record.message) ||
    "unknown api error";
  return { code: rawCode, message };
}

async function requestWithAuthHost(
  apiHost: LocalSettings["apiHost"],
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiHost}${path}`, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : "unknown network error";
    throw new Error(`[${apiHost}] 网络连接失败: ${reason}`);
  }

  const text = await response.text();
  const payload = parseJsonSafe(text);

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null ? JSON.stringify(payload) : text;
    throw new Error(`请求失败(${response.status}): ${message || "unknown error"}`);
  }

  const logicError = parseApiLogicError(payload);
  if (logicError) {
    throw new Error(`接口返回错误(code=${logicError.code}): ${logicError.message}`);
  }

  return payload;
}

async function tryRequestWithFallback(
  host: LocalSettings["apiHost"],
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await requestWithAuthHost(host, apiKey, path, body, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const message = errorMessage(error);
    const shouldFallback = shouldFallbackByMessage(message);
    if (!shouldFallback) {
      throw error;
    }
    const fallbackHost = getFallbackHost(host);
    try {
      return await requestWithAuthHost(fallbackHost, apiKey, path, body, signal);
    } catch (fallbackError) {
      if (isAbortError(fallbackError)) {
        throw fallbackError;
      }
      const fallbackMessage = errorMessage(fallbackError);
      throw new Error(`主线路失败(${message})；备用线路失败(${fallbackMessage})`);
    }
  }
}

async function requestWithAuth(
  settings: LocalSettings,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return tryRequestWithFallback(settings.apiHost, settings.apiKey, path, body, signal);
}

export async function validateApiKey(settings: LocalSettings): Promise<boolean> {
  if (!settings.apiKey.trim()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIKEY_VALIDATE_TIMEOUT_MS);
  try {
    await requestWithAuth(settings, "/v1/draw/result", { id: "ping-validation-id" }, controller.signal);
    return true;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("验证超时，请检查网络后重试。");
    }
    const message = errorMessage(error);
    if (message.includes("apikey error") || message.includes("(401)") || message.includes("(403)")) {
      return false;
    }
    // 官方文档: code=-22 为任务不存在，鉴权通常已通过
    if (message.includes("code=-22") || message.includes("任务不存在")) {
      return true;
    }
    if (message.includes("网络连接失败") || message.includes("主线路失败")) {
      throw new Error("接口网络不可达，请切换到 grsaiapi.com 或检查本机网络/代理。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function createNanoTask(params: {
  settings: LocalSettings;
  prompt: string;
  urls: string[];
  aspectRatio?: string;
  imageSize?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const model = params.settings.defaultModel.trim() || "nano-banana-pro";
  const payload = (await requestWithAuth(params.settings, "/v1/draw/nano-banana", {
    model,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio ?? "1:1",
    imageSize: params.imageSize ?? "1K",
    urls: params.urls,
    webHook: "-1",
    shutProgress: false,
  }, params.signal)) as NanoCreateTaskResponse;

  const taskId = payload?.data?.id ?? payload?.id;
  if (!taskId) throw new Error("第三方接口未返回任务 id");
  return taskId;
}

export async function getNanoTaskResult(
  settings: LocalSettings,
  id: string,
  signal?: AbortSignal,
): Promise<NanoResultData> {
  const payload = (await requestWithAuth(settings, "/v1/draw/result", { id }, signal)) as {
    data?: NanoResultData;
  } & NanoResultData;
  return payload.data ?? payload;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort() {
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }

    function cleanup() {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForNanoResult(params: {
  settings: LocalSettings;
  id: string;
  timeoutMs?: number;
  pollMs?: number;
  onTick?: (result: NanoResultData) => void;
  signal?: AbortSignal;
}): Promise<NanoResultData> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  const pollMs = params.pollMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    throwIfAborted(params.signal);
    const result = await getNanoTaskResult(params.settings, params.id, params.signal);
    params.onTick?.(result);

    if (result.status === "succeeded" || result.status === "failed") {
      return result;
    }

    await sleep(pollMs, params.signal);
  }

  throw new Error("生成超时，请稍后重试");
}
