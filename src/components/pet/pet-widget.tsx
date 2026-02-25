"use client";

import { usePathname } from "next/navigation";
import { AssetImage } from "@/components/asset-image";
import { PetBubble } from "@/components/pet/pet-bubble";
import { usePetEvent } from "@/lib/pet/pet-events";

const PET_ASSETS = {
  idle: "/assets/pet/pet_idle.gif",
  fall: "/assets/pet/pet_fall.gif",
  walk_left: "/assets/pet/pet_walk_left.gif",
  walk_right: "/assets/pet/pet_walk_right.gif",
  run: "/assets/pet/pet_run.gif",
  jump: "/assets/pet/pet_jump.gif",
  attack: "/assets/pet/pet_attack.gif",
} as const;

import type { ActionType, AutoAnim } from "@/lib/types";

const ACTION_DEMO_GIF: Partial<Record<ActionType, string>> = {
  walk: PET_ASSETS.walk_left,
  run: PET_ASSETS.run,
  idle: PET_ASSETS.idle,
  jump: PET_ASSETS.jump,
  attack: PET_ASSETS.attack,
  fall: PET_ASSETS.fall,
};

function resolvePetAsset(
  mood: string,
  demoAction: ActionType | null,
  thinkingProgress: number,
  chatAnim: "asking" | "responding" | null,
  autoAnim: AutoAnim,
): string {
  // 1. demoAction: action preview & brief animations (grade=good jump, cancelled fall)
  if (demoAction) return ACTION_DEMO_GIF[demoAction] ?? PET_ASSETS.idle;
  // 2. Chat LLM animation
  if (chatAnim === "asking") return PET_ASSETS.walk_left;
  if (chatAnim === "responding") return PET_ASSETS.walk_right;
  // 3. Overlay moods from clicking
  if (mood === "attack") return PET_ASSETS.attack;
  if (mood === "angry") return PET_ASSETS.fall;
  // 4. Main moods
  if (mood === "happy" || mood === "celebrate") return PET_ASSETS.jump;
  if (mood === "error") return PET_ASSETS.fall;
  if (mood === "thinking") {
    if (thinkingProgress >= 82) return PET_ASSETS.jump;
    if (thinkingProgress >= 28) return PET_ASSETS.run;
    return PET_ASSETS.walk_left;
  }
  // 5. Autonomous idle behavior (lowest priority, only active during idle/guide)
  if (autoAnim === "patrol_left") return PET_ASSETS.walk_left;
  if (autoAnim === "patrol_right") return PET_ASSETS.walk_right;
  if (autoAnim === "auto_jump") return PET_ASSETS.jump;
  return PET_ASSETS.idle;
}

export function PetWidget() {
  const pathname = usePathname();
  const {
    mood,
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
    onPetClick,
    toggleCollapsed,
    setBubbleOpen,
    openChat,
    startNewChatSession,
    deleteChatHistorySession,
    clearChatHistory,
    sendChatMessage,
    confirmPromptSuggestion,
    clearPromptSuggestion,
  } = usePetEvent();

  const displayMood = overlayMood ?? mood;
  const petAsset = resolvePetAsset(displayMood, demoAction, thinkingProgress, chatAnim, autoAnim);
  const densePage =
    pathname === "/create" || pathname?.startsWith("/result/") || pathname === "/history";
  const compact = densePage && !bubbleOpen && !chatOpen;

  return (
    <div
      className={`pointer-events-none fixed z-[90] flex max-w-[92vw] flex-col-reverse items-end gap-3 ${
        densePage
          ? "bottom-20 right-2 lg:bottom-3 lg:right-3 lg:left-auto"
          : "bottom-20 right-2 lg:bottom-6 lg:right-6 lg:left-auto"
      }`}
    >
      {!collapsed && bubbleOpen && (
        <div className="pointer-events-auto">
          <PetBubble
            script={script}
            chatOpen={chatOpen}
            messages={messages}
            chatHistory={chatHistory}
            asking={asking}
            pendingSuggestion={pendingSuggestion}
            onToggleChat={openChat}
            onStartNewChat={startNewChatSession}
            onDeleteHistorySession={deleteChatHistorySession}
            onClearHistory={clearChatHistory}
            onCloseBubble={() => {
              openChat(false);
              setBubbleOpen(false);
            }}
            onSendMessage={sendChatMessage}
            onApplySuggestion={confirmPromptSuggestion}
            onClearSuggestion={clearPromptSuggestion}
          />
        </div>
      )}

      <div className={`pet-dock ${compact ? "compact" : ""}`}>
        <button
          type="button"
          aria-label="桌宠互动"
          className="pointer-events-auto bg-transparent p-0"
          onClick={() => {
            if (!bubbleOpen) setBubbleOpen(true);
            if (collapsed) toggleCollapsed();
            onPetClick();
          }}
        >
          <AssetImage
            src={petAsset}
            alt={`Pet ${displayMood}`}
            className={`object-contain pixelated !border-0 !bg-transparent shadow-none ${
              densePage
                ? "h-14 w-14 md:h-24 md:w-24 lg:h-28 lg:w-28"
                : "h-14 w-14 md:h-28 md:w-28"
            }`}
            fallbackClassName="asset-fallback-md"
          />
        </button>
      </div>
    </div>
  );
}
