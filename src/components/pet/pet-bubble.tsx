"use client";

import { useMemo, useState } from "react";
import type { PetChatHistoryItem, PetChatMessage } from "@/lib/types";

interface PetBubbleProps {
  script: string;
  chatOpen: boolean;
  messages: PetChatMessage[];
  chatHistory: PetChatHistoryItem[];
  asking: boolean;
  pendingSuggestion: string;
  onToggleChat: (value: boolean) => void;
  onStartNewChat: () => void;
  onDeleteHistorySession: (id: string) => void;
  onClearHistory: () => void;
  onCloseBubble: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onApplySuggestion: (mode: "replace" | "append") => void;
  onClearSuggestion: () => void;
}

export function PetBubble({
  script,
  chatOpen,
  messages,
  chatHistory,
  asking,
  pendingSuggestion,
  onToggleChat,
  onStartNewChat,
  onDeleteHistorySession,
  onClearHistory,
  onCloseBubble,
  onSendMessage,
  onApplySuggestion,
  onClearSuggestion,
}: PetBubbleProps) {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const recentMessages = useMemo(() => messages.slice(-3), [messages]);
  const selectedHistory = useMemo(
    () => chatHistory.find((item) => item.id === selectedHistoryId) ?? null,
    [chatHistory, selectedHistoryId],
  );

  function roleLabel(role: PetChatMessage["role"]): string {
    if (role === "user") return "我";
    if (role === "assistant") return "小灵";
    return "系统";
  }

  function formatTime(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleString();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;
    const current = input;
    setInput("");
    await onSendMessage(current);
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const text = input.trim();
    if (!text || asking) return;
    setInput("");
    void onSendMessage(text);
  }

  return (
    <div className="pet-panel-lite w-full max-w-[94vw] rounded-t-2xl p-3.5 md:w-[448px] md:rounded-2xl md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="pixel-title text-[11px]">小灵</p>
        <div className="flex items-center gap-1.5">
          <button
            className="pet-chip-btn"
            onClick={() => {
              if (chatOpen) {
                onToggleChat(false);
                setActiveTab("chat");
              } else {
                setActiveTab("chat");
                setSelectedHistoryId(null);
                onToggleChat(true);
              }
            }}
            aria-label={chatOpen ? "收起聊天" : "打开聊天"}
          >
            {chatOpen ? "收起对话" : "打开对话"}
          </button>
          <button className="pet-chip-btn" onClick={onCloseBubble} aria-label="关闭桌宠面板">
            关闭
          </button>
        </div>
      </div>

      <div className="pet-status mt-2">
        <p className="text-base leading-relaxed text-text-primary">{script}</p>
      </div>

      {!chatOpen && (
        <div className="mt-2">
          <p className="text-sm leading-relaxed text-text-muted">
            默认每次打开都是新会话；历史会话可在历史页签查看。
          </p>
        </div>
      )}

      {chatOpen && (
        <div className="pet-chat-shell mt-3 space-y-3">
          <div className="pet-tab-row">
            <button
              className={`pet-tab-btn ${activeTab === "chat" ? "is-active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              聊天
            </button>
            <button
              className={`pet-tab-btn ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              历史 ({chatHistory.length})
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              <div className="pet-preview-thread">
                {recentMessages.length === 0 ? (
                  <p className="pet-inline-hint">可以先闲聊，也可以直接说动作想法，我会在需要时帮你整理成可生成描述。</p>
                ) : (
                  recentMessages.map((item) => (
                    <div key={item.id} className={`pet-msg pet-msg-${item.role}`}>
                      <p className="pet-msg-role">{roleLabel(item.role)}</p>
                      <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form className="pet-composer" onSubmit={(event) => void handleSubmit(event)}>
                <textarea
                  className="pet-input-compact"
                  placeholder="和小灵聊聊，或直接输入动作细节..."
                  value={input}
                  maxLength={300}
                  rows={3}
                  onKeyDown={handleTextareaKeyDown}
                  onChange={(event) => setInput(event.target.value)}
                />
                <button className="pet-send-btn" type="submit" disabled={asking || !input.trim()}>
                  {asking ? "整理中" : "发送"}
                </button>
              </form>

              <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
                <p>{input.length}/300</p>
                {pendingSuggestion ? (
                  <p className="leading-relaxed text-right">有新建议，可直接覆盖或追加</p>
                ) : (
                  <p className="leading-relaxed text-right">填入后会自动跳转到创作页并切到自定义动作</p>
                )}
              </div>

              {pendingSuggestion && (
                <div className="pet-suggestion">
                  <div className="flex items-center justify-between gap-2">
                    <p className="pixel-title text-[10px]">建议描述</p>
                    <button className="pet-chip-btn" onClick={onClearSuggestion}>
                      清空
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-text-primary">
                    {pendingSuggestion}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button className="arcade-button lime px-3 py-2 text-xs" onClick={() => onApplySuggestion("replace")}>
                      覆盖填入
                    </button>
                    <button className="arcade-button secondary px-3 py-2 text-xs" onClick={() => onApplySuggestion("append")}>
                      追加填入
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="pet-history-list max-h-44 overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-text-muted">暂无历史会话</p>
                ) : (
                  chatHistory.map((item) => (
                    <div key={item.id} className={`pet-history-item ${selectedHistoryId === item.id ? "is-active" : ""}`}>
                      <button
                        className="pet-history-main"
                        onClick={() => setSelectedHistoryId(item.id)}
                      >
                        <p className="pet-history-title">{item.title}</p>
                        <p className="pet-history-meta">{formatTime(item.updatedAt)} · {item.messages.length} 条</p>
                      </button>
                      <button
                        className="pet-history-delete"
                        onClick={() => {
                          if (selectedHistoryId === item.id) {
                            setSelectedHistoryId(null);
                          }
                          onDeleteHistorySession(item.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button className="pet-chip-btn" onClick={onClearHistory} disabled={chatHistory.length === 0}>
                  清空历史
                </button>
                <button
                  className="pet-chip-btn"
                  onClick={() => {
                    onStartNewChat();
                    setActiveTab("chat");
                    setSelectedHistoryId(null);
                  }}
                >
                  新建聊天
                </button>
              </div>

              <div className="pet-history max-h-48 space-y-2 overflow-y-auto">
                {selectedHistory ? (
                  selectedHistory.messages.map((item) => (
                    <div key={item.id} className={`pet-msg pet-msg-${item.role}`}>
                      <p className="pet-msg-role">{roleLabel(item.role)}</p>
                      <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">点击上方历史会话可查看详情</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
