"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ACTION_LABELS,
  PET_CHAT_HISTORY_KEY,
  PET_PERSONA_PROFILE,
  PET_PREFERENCES_KEY,
  PET_PROFILE_KEY,
} from "@/lib/constants";
import {
  CELEBRATE_RETURN_MS,
  HAPPY_RETURN_MS,
  createInitialPetControllerState,
  reducePetEvent,
} from "@/lib/pet/pet-controller";
import { routePetConversation } from "@/lib/pet/pet-llm";
import { pickActionDemoScript, pickMoodScript, pickOverlayScript, pickPromptBlurScript, pickRandomIdleScript } from "@/lib/pet/pet-scripts";
import { readSettings } from "@/lib/storage";
import type {
  ActionType,
  AutoAnim,
  PendingPromptFill,
  PetChatHistoryItem,
  PetChatMessage,
  PetCreateContext,
  PetEventPayloadMap,
  PetEventType,
  PetMood,
  PetOverlayMood,
  PetPersonaProfile,
  PetPreferences,
  PromptFillCommand,
  PromptFillMode,
} from "@/lib/types";

// Click thresholds for pet mood changes
const ANGRY_CLICK_THRESHOLD = 3;
const ATTACK_CLICK_THRESHOLD = 7;
const CLICK_RESET_DELAY_MS = 3000;
const ACTION_DEMO_DURATION_MS = 2500;
const BRIEF_ANIM_DURATION_MS = 1500;
const CHAT_RESPOND_ANIM_MS = 1000;
const PET_CHAT_HISTORY_LIMIT = 20;

interface PetContextValue {
  mood: PetMood;
  overlayMood: PetOverlayMood | null;
  demoAction: ActionType | null;
  autoAnim: AutoAnim;
  thinkingProgress: number;
  chatAnim: "asking" | "responding" | null;
  script: string;
  collapsed: boolean;
  bubbleOpen: boolean;
  chatOpen: boolean;
  messages: PetChatMessage[];
  chatHistory: PetChatHistoryItem[];
  asking: boolean;
  pendingSuggestion: string;
  emitPetEvent: <T extends PetEventType>(event: T, payload?: PetEventPayloadMap[T]) => void;
  updateCreateContext: (patch: Partial<PetCreateContext>) => void;
  onPetClick: () => void;
  toggleCollapsed: () => void;
  setBubbleOpen: (value: boolean) => void;
  openChat: (value: boolean) => void;
  startNewChatSession: () => void;
  deleteChatHistorySession: (id: string) => void;
  clearChatHistory: () => void;
  sendChatMessage: (message: string, options?: { forceOptimize?: boolean }) => Promise<void>;
  optimizeDraftPrompt: (prompt: string) => Promise<void>;
  confirmPromptSuggestion: (mode?: PromptFillMode) => void;
  clearPromptSuggestion: () => void;
  promptCommand: PromptFillCommand | null;
  consumePromptCommand: (id: string) => void;
  pendingPromptFill: PendingPromptFill | null;
  consumePendingPromptFill: (id: string) => void;
  createContext: PetCreateContext;
}

const PetContext = createContext<PetContextValue | null>(null);

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildChatHistoryTitle(messages: PetChatMessage[]): string {
  const firstUser = messages.find((item) => item.role === "user" && item.text.trim().length > 0)?.text.trim();
  if (firstUser) {
    return firstUser.length > 18 ? `${firstUser.slice(0, 18)}...` : firstUser;
  }
  const firstAssistant = messages.find((item) => item.role === "assistant" && item.text.trim().length > 0)?.text.trim();
  if (firstAssistant) {
    return firstAssistant.length > 18 ? `${firstAssistant.slice(0, 18)}...` : firstAssistant;
  }
  return `会话 ${new Date().toLocaleTimeString()}`;
}

function normalizePetErrorMessage(input: string): string {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (lower.includes("signal is aborted") || lower.includes("abort")) {
    return "请求被中断，请重试一次。";
  }
  return text;
}

function loadPetPreferences(): PetPreferences {
  if (typeof window === "undefined") {
    return { enabled: true, collapsed: false, lastMood: "idle" };
  }
  try {
    const raw = window.localStorage.getItem(PET_PREFERENCES_KEY);
    if (!raw) return { enabled: true, collapsed: false, lastMood: "idle" };
    const parsed = JSON.parse(raw) as Partial<PetPreferences>;
    return {
      enabled: parsed.enabled ?? true,
      collapsed: parsed.collapsed ?? false,
      lastMood: parsed.lastMood ?? "idle",
    };
  } catch {
    return { enabled: true, collapsed: false, lastMood: "idle" };
  }
}

function savePetPreferences(pref: PetPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PET_PREFERENCES_KEY, JSON.stringify(pref));
}

function loadPetChatHistory(): PetChatHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PET_CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PetChatHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
      .slice(0, PET_CHAT_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function savePetChatHistory(items: PetChatHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PET_CHAT_HISTORY_KEY, JSON.stringify(items.slice(0, PET_CHAT_HISTORY_LIMIT)));
  } catch {
    // Best-effort cache only.
  }
}

interface PetProfileStorage extends PetPersonaProfile {
  smalltalkTurnsInSession: number;
  clarifyTurnsInSession: number;
}

function loadPetProfileStorage(): PetProfileStorage {
  if (typeof window === "undefined") {
    return { ...PET_PERSONA_PROFILE, smalltalkTurnsInSession: 0, clarifyTurnsInSession: 0 };
  }
  try {
    const raw = window.localStorage.getItem(PET_PROFILE_KEY);
    if (!raw) return { ...PET_PERSONA_PROFILE, smalltalkTurnsInSession: 0, clarifyTurnsInSession: 0 };
    const parsed = JSON.parse(raw) as Partial<PetProfileStorage>;
    return {
      name: PET_PERSONA_PROFILE.name,
      personaVersion: PET_PERSONA_PROFILE.personaVersion,
      smalltalkTurnsInSession: Number.isFinite(parsed.smalltalkTurnsInSession)
        ? Math.max(0, Number(parsed.smalltalkTurnsInSession))
        : 0,
      clarifyTurnsInSession: Number.isFinite(parsed.clarifyTurnsInSession)
        ? Math.max(0, Number(parsed.clarifyTurnsInSession))
        : 0,
    };
  } catch {
    return { ...PET_PERSONA_PROFILE, smalltalkTurnsInSession: 0, clarifyTurnsInSession: 0 };
  }
}

function savePetProfileStorage(profile: PetProfileStorage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PET_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Best-effort cache only.
  }
}

export function PetProvider({ children }: { children: ReactNode }) {
  const [controller, setController] = useState(() => createInitialPetControllerState());
  const [script, setScript] = useState(() => pickMoodScript("idle"));
  const [overlayMood, setOverlayMood] = useState<PetOverlayMood | null>(null);
  const [demoAction, setDemoAction] = useState<ActionType | null>(null);
  const [autoAnim, setAutoAnim] = useState<AutoAnim>(null);
  const [thinkingProgress, setThinkingProgress] = useState(0);
  const [chatAnim, setChatAnim] = useState<"asking" | "responding" | null>(null);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<PetChatHistoryItem[]>(() => loadPetChatHistory());
  const [asking, setAsking] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState("");
  const [promptCommand, setPromptCommand] = useState<PromptFillCommand | null>(null);
  const [pendingPromptFill, setPendingPromptFill] = useState<PendingPromptFill | null>(null);
  const [collapsed, setCollapsed] = useState(() => loadPetPreferences().collapsed);

  const controllerRef = useRef(controller);
  const moodResetTimerRef = useRef<number | null>(null);
  const clickResetRef = useRef<number | null>(null);
  const demoResetTimerRef = useRef<number | null>(null);
  const chatAnimResetRef = useRef<number | null>(null);
  const generateScriptBucketRef = useRef(-1);
  const autoAnimTimerRef = useRef<number | null>(null);
  const autoAnimCycleRef = useRef(0);
  const idleScriptTimerRef = useRef<number | null>(null);
  const chatOpenRef = useRef(chatOpen);
  const messagesRef = useRef(messages);
  const clickCountRef = useRef(0);
  const petProfileRef = useRef<PetProfileStorage>(loadPetProfileStorage());

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    savePetPreferences({
      enabled: true,
      collapsed,
      lastMood: controller.mood,
    });
  }, [collapsed, controller.mood]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    savePetChatHistory(chatHistory);
  }, [chatHistory]);

  useEffect(() => {
    return () => {
      if (moodResetTimerRef.current) window.clearTimeout(moodResetTimerRef.current);
      if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
      if (demoResetTimerRef.current) window.clearTimeout(demoResetTimerRef.current);
      if (chatAnimResetRef.current) window.clearTimeout(chatAnimResetRef.current);
      if (autoAnimTimerRef.current) window.clearTimeout(autoAnimTimerRef.current);
      if (idleScriptTimerRef.current) window.clearTimeout(idleScriptTimerRef.current);
    };
  }, []);

  // Autonomous idle behavior engine
  useEffect(() => {
    const activeMood = controller.mood;
    const isIdleMood = activeMood === "idle" || activeMood === "guide";
    const hasBlocker = Boolean(overlayMood) || Boolean(demoAction) || Boolean(chatAnim);

    if (autoAnimTimerRef.current) {
      window.clearTimeout(autoAnimTimerRef.current);
      autoAnimTimerRef.current = null;
    }

    if (!isIdleMood || hasBlocker) {
      autoAnimTimerRef.current = window.setTimeout(() => setAutoAnim(null), 0);
      return () => {
        if (autoAnimTimerRef.current) window.clearTimeout(autoAnimTimerRef.current);
      };
    }

    const delay = 10_000 + Math.random() * 10_000;

    function finishCycle() {
      setAutoAnim(null);
      autoAnimCycleRef.current += 1;
      if (autoAnimCycleRef.current % 3 === 0) {
        const text = pickRandomIdleScript(activeMood);
        setScript(text);
        if (!chatOpenRef.current) {
          setBubbleOpen(true);
          if (idleScriptTimerRef.current) window.clearTimeout(idleScriptTimerRef.current);
          idleScriptTimerRef.current = window.setTimeout(() => {
            setBubbleOpen(false);
            setScript(pickMoodScript(controllerRef.current.mood));
          }, 3_000);
        }
      }
    }

    autoAnimTimerRef.current = window.setTimeout(() => {
      setAutoAnim("patrol_left");
      autoAnimTimerRef.current = window.setTimeout(() => {
        setAutoAnim("patrol_right");
        autoAnimTimerRef.current = window.setTimeout(() => {
          if (Math.random() < 0.5) {
            setAutoAnim("auto_jump");
            autoAnimTimerRef.current = window.setTimeout(() => {
              finishCycle();
            }, 1_500);
          } else {
            finishCycle();
          }
        }, 2_000);
      }, 2_000);
    }, delay);

    return () => {
      if (autoAnimTimerRef.current) window.clearTimeout(autoAnimTimerRef.current);
    };
  }, [controller.mood, overlayMood, demoAction, chatAnim]);

  const scheduleMoodReset = useCallback((sourceMood: PetMood, delayMs: number) => {
    if (moodResetTimerRef.current) window.clearTimeout(moodResetTimerRef.current);
    moodResetTimerRef.current = window.setTimeout(() => {
      setController((prev) => {
        if (prev.mood !== sourceMood) return prev;
        const nextMood: PetMood = prev.createContext.hasImage ? "idle" : "guide";
        setScript((prevScript) => pickMoodScript(nextMood, prevScript));
        return { ...prev, mood: nextMood };
      });
    }, delayMs);
  }, []);

  const updateCreateContext = useCallback((patch: Partial<PetCreateContext>) => {
    setController((prev) => {
      const nextAction = patch.actionId ?? prev.createContext.actionId;
      const merged: PetCreateContext = {
        ...prev.createContext,
        ...patch,
        actionId: nextAction,
        actionLabel: patch.actionLabel ?? ACTION_LABELS[nextAction],
      };
      return { ...prev, createContext: merged };
    });
  }, []);

  const emitPetEvent = useCallback(
    <T extends PetEventType>(event: T, payload?: PetEventPayloadMap[T]) => {
      // --- Events that bypass controller ---
      if (event === "action:preview") {
        const { actionId } = payload as { actionId: ActionType };
        setDemoAction(actionId);
        setScript(pickActionDemoScript(actionId));
        setBubbleOpen(true);
        if (demoResetTimerRef.current) window.clearTimeout(demoResetTimerRef.current);
        demoResetTimerRef.current = window.setTimeout(() => {
          setDemoAction(null);
          setScript((prevScript) => pickMoodScript(controllerRef.current.mood, prevScript));
        }, ACTION_DEMO_DURATION_MS);
        return;
      }

      if (event === "prompt:input:blur") {
        const { hasContent } = payload as { hasContent: boolean };
        if (!hasContent) return;
        setScript((prevScript) => pickPromptBlurScript(prevScript));
        setBubbleOpen(true);
        return;
      }

      // --- Normal events through controller ---
      // Reset idle behavior cycle so auto-patrol restarts after real events
      autoAnimCycleRef.current = 0;
      if (idleScriptTimerRef.current) {
        window.clearTimeout(idleScriptTimerRef.current);
        idleScriptTimerRef.current = null;
      }

      setController((prev) => {
        const result = reducePetEvent(prev, event, payload);
        const next = result.next;

        if (event === "task:generate:progress") {
          const progress = Math.max(0, Math.min(100, Number((payload as { progress?: number })?.progress ?? 0)));
          const bucket = progress >= 85 ? 3 : progress >= 60 ? 2 : progress >= 35 ? 1 : 0;
          if (bucket !== generateScriptBucketRef.current) {
            generateScriptBucketRef.current = bucket;
            if (bucket === 3) {
              setScript(`进入收尾阶段，马上完成（${Math.round(progress)}%）。`);
            } else if (bucket === 2) {
              setScript(`中段细化中，我会继续盯住节奏（${Math.round(progress)}%）。`);
            } else if (bucket === 1) {
              setScript(`生成进行中，动作骨架已跑起来（${Math.round(progress)}%）。`);
            } else {
              setScript(`刚开始施法，先把基础动作铺开（${Math.round(progress)}%）。`);
            }
          }
        } else if (event === "image:audit") {
          const audit = payload as { grade?: "good" | "ok" | "warn"; summary?: string } | undefined;
          const summary = audit?.summary?.trim() || "素材已检测完成。";
          if (audit?.grade === "good") {
            setScript(`素材状态优秀：${summary}`);
          } else if (audit?.grade === "ok") {
            setScript(`素材状态可用：${summary}`);
          } else {
            setScript(`素材可优化：${summary}`);
          }
        } else if (event === "task:generate:failed" || event === "task:reencode:failed") {
          const reason = (payload as { reason?: string } | undefined)?.reason;
          setScript(() => reason ? `失败：${reason}` : pickMoodScript("error", ""));
        } else if (next.mood !== prev.mood || event === "page:create:entered" || event === "image:uploaded" || event === "image:cleared") {
          setScript((prevScript) => pickMoodScript(next.mood, prevScript));
        }

        if (next.mood === "happy") {
          scheduleMoodReset("happy", HAPPY_RETURN_MS);
        }
        if (next.mood === "celebrate") {
          scheduleMoodReset("celebrate", CELEBRATE_RETURN_MS);
        }

        return next;
      });

      // --- Post-controller side effects ---

      // Track thinking progress
      if (event === "task:generate:progress") {
        const progress = Math.max(0, Math.min(100, Number((payload as { progress?: number })?.progress ?? 0)));
        setThinkingProgress(progress);
      } else if (event === "task:generate:start") {
        generateScriptBucketRef.current = -1;
        setThinkingProgress(0);
      } else if (
        event === "task:generate:success" ||
        event === "task:generate:failed" ||
        event === "task:generate:cancelled" ||
        event === "task:reencode:success" ||
        event === "task:reencode:failed"
      ) {
        generateScriptBucketRef.current = -1;
        setThinkingProgress(0);
      }

      // grade=good upload → brief jump
      if (event === "image:audit") {
        const audit = payload as { grade?: "good" | "ok" | "warn" } | undefined;
        if (audit?.grade === "good") {
          setDemoAction("jump");
          if (demoResetTimerRef.current) window.clearTimeout(demoResetTimerRef.current);
          demoResetTimerRef.current = window.setTimeout(() => setDemoAction(null), BRIEF_ANIM_DURATION_MS);
        }
      }

      // cancelled → brief fall then idle
      if (event === "task:generate:cancelled") {
        setDemoAction("fall");
        if (demoResetTimerRef.current) window.clearTimeout(demoResetTimerRef.current);
        demoResetTimerRef.current = window.setTimeout(() => setDemoAction(null), BRIEF_ANIM_DURATION_MS);
      }
    },
    [scheduleMoodReset],
  );

  const onPetClick = useCallback(() => {
    clickCountRef.current += 1;
    const count = clickCountRef.current;
    let mood: PetOverlayMood = "happy";
    if (count >= ATTACK_CLICK_THRESHOLD) mood = "attack";
    else if (count >= ANGRY_CLICK_THRESHOLD) mood = "angry";

    setOverlayMood(mood);
    setScript((prevScript) => pickOverlayScript(mood, prevScript));
    setBubbleOpen(true);

    if (clickResetRef.current) window.clearTimeout(clickResetRef.current);
    clickResetRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
      setOverlayMood(null);
      setScript((prevScript) => pickMoodScript(controllerRef.current.mood, prevScript));
    }, CLICK_RESET_DELAY_MS);
  }, []);

  const sendChatMessage = useCallback(async (
    message: string,
    options?: { forceOptimize?: boolean },
  ) => {
    const trimmed = message.trim();
    if (!trimmed || asking) return;

    setMessages((prev) => [...prev, { id: createId(), role: "user", text: trimmed }]);
    setAsking(true);
    setChatAnim("asking");

    let gotResponse = false;
    try {
      const settings = readSettings();
      const context = controllerRef.current.createContext;
      const response = await routePetConversation({
        actionId: context.actionId,
        actionLabel: context.actionLabel,
        customPrompt: context.customPrompt,
        userMessage: trimmed,
        settings,
        smalltalkTurnsInSession: petProfileRef.current.smalltalkTurnsInSession,
        clarifyTurnsInSession: petProfileRef.current.clarifyTurnsInSession,
        forceOptimize: Boolean(options?.forceOptimize),
      });

      gotResponse = true;

      if (response.intent === "smalltalk") {
        petProfileRef.current = {
          ...petProfileRef.current,
          smalltalkTurnsInSession: petProfileRef.current.smalltalkTurnsInSession + 1,
        };
        setPendingSuggestion("");
      } else if (response.intent === "clarify") {
        petProfileRef.current = {
          ...petProfileRef.current,
          smalltalkTurnsInSession: 0,
          clarifyTurnsInSession: Math.max(0, petProfileRef.current.clarifyTurnsInSession) + 1,
        };
      } else {
        petProfileRef.current = {
          ...petProfileRef.current,
          smalltalkTurnsInSession: 0,
          clarifyTurnsInSession: 0,
        };
      }
      savePetProfileStorage(petProfileRef.current);

      if (response.intent === "optimize") {
        const output = (response.actionDescriptionEn ?? "").trim();
        if (output) {
          setPendingSuggestion(output);
        } else {
          setPendingSuggestion("");
        }
      } else {
        setPendingSuggestion("");
      }

      const rawAssistantText =
        response.intent === "clarify"
          ? response.questionZh || response.replyZh || "可以再补充一点动作细节吗？"
          : response.replyZh || "小灵在，想到动作细节时告诉我。";
      const assistantText =
        response.intent === "smalltalk" && response.shouldOfferFill
          ? `${rawAssistantText}${rawAssistantText.includes("整理") ? "" : " 要不要给我一句动作想法，我帮你整理成可生成描述？"}`
          : rawAssistantText;

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: assistantText,
        },
      ]);

      if (response.error) {
        const errorText = normalizePetErrorMessage(response.error);
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "system", text: errorText },
        ]);
      }

      // Response received — briefly show walk_right then clear
      setChatAnim("responding");
      if (chatAnimResetRef.current) window.clearTimeout(chatAnimResetRef.current);
      chatAnimResetRef.current = window.setTimeout(() => setChatAnim(null), CHAT_RESPOND_ANIM_MS);
    } finally {
      setAsking(false);
      if (!gotResponse) setChatAnim(null);
    }
  }, [asking]);

  const archiveCurrentChat = useCallback(() => {
    const snapshot = messagesRef.current;
    if (snapshot.length === 0) return;
    const nowIso = new Date().toISOString();
    setChatHistory((prev) => {
      const last = prev[0];
      if (last && JSON.stringify(last.messages) === JSON.stringify(snapshot)) {
        return prev;
      }
      const entry: PetChatHistoryItem = {
        id: createId(),
        title: buildChatHistoryTitle(snapshot),
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: snapshot,
      };
      return [entry, ...prev].slice(0, PET_CHAT_HISTORY_LIMIT);
    });
  }, []);

  const startNewChatSession = useCallback(() => {
    setMessages([]);
    setPendingSuggestion("");
    petProfileRef.current = {
      ...petProfileRef.current,
      smalltalkTurnsInSession: 0,
      clarifyTurnsInSession: 0,
    };
    savePetProfileStorage(petProfileRef.current);
  }, []);

  const optimizeDraftPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setBubbleOpen(true);
      setScript("先写一点动作细节，我再帮你自动优化。");
      return;
    }
    setBubbleOpen(true);
    if (!chatOpenRef.current) {
      startNewChatSession();
    }
    setChatOpen(true);
    await sendChatMessage(`请优化这段动作描述，并在缺失细节时自动补全：${trimmed}`, {
      forceOptimize: true,
    });
  }, [sendChatMessage, startNewChatSession]);

  const deleteChatHistorySession = useCallback((id: string) => {
    setChatHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
  }, []);

  const confirmPromptSuggestion = useCallback((mode: PromptFillMode = "replace") => {
    const text = pendingSuggestion.trim();
    if (!text) return;
    const id = createId();
    const command: PromptFillCommand = { id, text, mode };
    setPromptCommand(command);
    setPendingPromptFill({ ...command, createdAt: Date.now() });
    setPendingSuggestion("");
    archiveCurrentChat();
    setChatOpen(false);
    setScript("提示词已准备好，正在同步到创作页。");
    setController((prev) => ({ ...prev, mood: "happy" }));
    scheduleMoodReset("happy", HAPPY_RETURN_MS);
  }, [archiveCurrentChat, pendingSuggestion, scheduleMoodReset]);

  const clearPromptSuggestion = useCallback(() => {
    setPendingSuggestion("");
  }, []);

  const consumePromptCommand = useCallback((id: string) => {
    setPromptCommand((prev) => (prev?.id === id ? null : prev));
  }, []);

  const consumePendingPromptFill = useCallback((id: string) => {
    setPendingPromptFill((prev) => (prev?.id === id ? null : prev));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const openChat = useCallback((value: boolean) => {
    if (value) {
      setBubbleOpen(true);
      if (!chatOpenRef.current) {
        startNewChatSession();
      }
      setChatOpen(true);
    } else {
      archiveCurrentChat();
      setChatOpen(false);
    }
  }, [archiveCurrentChat, startNewChatSession]);

  const value = useMemo<PetContextValue>(
    () => ({
      mood: controller.mood,
      overlayMood,
      demoAction,
      autoAnim,
      thinkingProgress,
      chatAnim,
      script,
      collapsed,
      bubbleOpen,
      chatOpen,
      messages,
      chatHistory,
      asking,
      pendingSuggestion,
      emitPetEvent,
      updateCreateContext,
      onPetClick,
      toggleCollapsed,
      setBubbleOpen,
      openChat,
      startNewChatSession,
      deleteChatHistorySession,
      clearChatHistory,
      sendChatMessage,
      optimizeDraftPrompt,
      confirmPromptSuggestion,
      clearPromptSuggestion,
      promptCommand,
      consumePromptCommand,
      pendingPromptFill,
      consumePendingPromptFill,
      createContext: controller.createContext,
    }),
    [
      controller.mood,
      controller.createContext,
      overlayMood,
      demoAction,
      autoAnim,
      thinkingProgress,
      chatAnim,
      script,
      collapsed,
      bubbleOpen,
      chatOpen,
      messages,
      chatHistory,
      asking,
      pendingSuggestion,
      emitPetEvent,
      updateCreateContext,
      onPetClick,
      toggleCollapsed,
      openChat,
      startNewChatSession,
      deleteChatHistorySession,
      clearChatHistory,
      sendChatMessage,
      optimizeDraftPrompt,
      confirmPromptSuggestion,
      clearPromptSuggestion,
      promptCommand,
      consumePromptCommand,
      pendingPromptFill,
      consumePendingPromptFill,
    ],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

function usePetContext(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error("usePetContext must be used inside PetProvider");
  }
  return ctx;
}

export function usePetEvent() {
  return usePetContext();
}
