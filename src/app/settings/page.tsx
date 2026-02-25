"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  GRSAI_APIKEY_URL,
  DOUBAO_ARK_APIKEY_URL,
  DOUBAO_ARK_DEFAULT_HOST,
  DOUBAO_ARK_DEFAULT_MODEL,
  DOUBAO_ARK_DOC_URL,
  TOAST_DURATION_MS,
} from "@/lib/constants";
import { clearGifCache } from "@/lib/gif-cache";
import { validateApiKey } from "@/lib/grsai";
import { validateLlmApiKey } from "@/lib/pet/pet-llm";
import { clearAllLocalData, saveSettings } from "@/lib/storage";
import { useSettings } from "@/hooks/use-settings";
import type { LocalSettings } from "@/lib/types";

export default function SettingsPage() {
  const { settings, setSettings, isClient } = useSettings();
  const [saved, setSaved] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState("");
  const [checkingLlm, setCheckingLlm] = useState(false);
  const [checkLlmResult, setCheckLlmResult] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const keyMasked = useMemo(() => {
    if (!settings.apiKey) return "";
    if (settings.apiKey.length < 8) return "****";
    return `${settings.apiKey.slice(0, 4)}********${settings.apiKey.slice(-4)}`;
  }, [settings.apiKey]);

  function updateField<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function applyDoubaoDefaults() {
    setSettings((prev) => {
      const trusted = new Set(prev.trustedLlmHosts);
      trusted.add("ark.cn-beijing.volces.com");
      return {
        ...prev,
        llmProvider: "doubao_ark",
        llmApiHost: DOUBAO_ARK_DEFAULT_HOST,
        llmModel: DOUBAO_ARK_DEFAULT_MODEL,
        trustedLlmHosts: [...trusted],
      };
    });
    setCheckLlmResult("已填充豆包默认配置，请粘贴 API Key 后验证。");
  }

  function handleSave() {
    const normalized: LocalSettings = {
      ...settings,
      apiKey: settings.apiKey.trim(),
      defaultModel: settings.defaultModel.trim() || DEFAULT_SETTINGS.defaultModel,
      llmApiKey: settings.llmApiKey.trim(),
      llmApiHost: settings.llmApiHost.trim(),
      llmModel: settings.llmModel.trim(),
      trustedLlmHosts: settings.trustedLlmHosts.map((item) => item.trim()).filter(Boolean),
    };
    saveSettings(normalized);
    setSettings(normalized);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved("已保存到浏览器本地。清理浏览器缓存后会丢失。");
    savedTimerRef.current = setTimeout(() => setSaved(""), TOAST_DURATION_MS);
  }

  async function handleValidate() {
    setChecking(true);
    setCheckResult("");
    try {
      const ok = await validateApiKey(settings);
      setCheckResult(ok ? "API Key 可用（鉴权通过）" : "API Key 无效或鉴权失败，请检查");
    } catch (error) {
      setCheckResult(error instanceof Error ? error.message : "验证失败");
    } finally {
      setChecking(false);
    }
  }

  async function handleValidateLlm() {
    setCheckingLlm(true);
    setCheckLlmResult("");
    try {
      const ok = await validateLlmApiKey(settings);
      setCheckLlmResult(ok ? "LLM Key 可用（鉴权通过）" : "LLM Key 无效或鉴权失败，请检查");
    } catch (error) {
      setCheckLlmResult(error instanceof Error ? error.message : "LLM 验证失败");
    } finally {
      setCheckingLlm(false);
    }
  }

  async function handleClearAll() {
    const confirmed = window.confirm("确认清空本地 API Key、历史记录和缓存资源吗？此操作不可恢复。");
    if (!confirmed) return;
    try {
      await clearGifCache();
      clearAllLocalData();
      setSettings(DEFAULT_SETTINGS);
      setSaved("已清空本地 API Key 和历史记录");
    } catch (error) {
      setSaved(error instanceof Error ? `清空失败：${error.message}` : "清空失败，请稍后重试。");
    }
  }

  return (
    <section className="max-w-4xl mx-auto space-y-5 fade-in-up">
      <div className="cyber-panel">
        <p className="pixel-title text-sm md:text-base">系统设置</p>
        <p className="mt-2 text-lg text-text-muted">
          API Key 仅保存在浏览器本地，不上传到你的服务端数据库。
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <label>
            <span className="pixel-label">API 接口地址</span>
            <select
              className="terminal-input"
              value={settings.apiHost}
              onChange={(event) =>
                updateField(
                  "apiHost",
                  event.target.value as "https://grsai.dakka.com.cn" | "https://grsaiapi.com",
                )
              }
            >
              <option value="https://grsai.dakka.com.cn">国内（dakka.com.cn）</option>
              <option value="https://grsaiapi.com">海外（grsaiapi.com）</option>
            </select>
          </label>

          <label>
            <span className="pixel-label">模型</span>
            <input
              className="terminal-input"
              value={settings.defaultModel}
              placeholder="例如: nano-banana-pro"
              onChange={(event) => updateField("defaultModel", event.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="pixel-label">API Key</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              className="terminal-input text-lg"
              placeholder="请粘贴 API Key..."
              value={settings.apiKey}
              onChange={(event) => updateField("apiKey", event.target.value)}
            />
            <button
              type="button"
              className="arcade-button secondary px-3"
              onClick={() => setShowApiKey((prev) => !prev)}
            >
              {showApiKey ? "隐藏" : "显示"}
            </button>
          </div>
        </label>

        <p className="mt-2 text-base text-text-muted">当前: {isClient ? (keyMasked || "(未设置)") : "..."}</p>

        <div className="mt-6 settings-action-row">
          <a
            className="arcade-button secondary px-3 py-2 text-xs"
            href={GRSAI_APIKEY_URL}
            target="_blank"
            rel="noreferrer"
          >
            获取 API KEY
          </a>
          <button className="arcade-button lime" onClick={handleSave}>
            保存基础设置
          </button>
          <button className="arcade-button secondary" onClick={handleValidate} disabled={checking}>
            {checking ? "验证中..." : "验证 API Key"}
          </button>
        </div>
      </div>

      <div className="cyber-panel">
        <p className="pixel-title text-xs">桌宠对话设置（LLM）</p>
        <p className="mt-2 text-base text-text-muted">
          桌宠会使用这里的 LLM 配置来优化动作描述，数据仅保存在浏览器本地。
        </p>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <label>
            <span className="pixel-label">LLM 服务商</span>
            <select
              className="terminal-input"
              value={settings.llmProvider}
              onChange={(event) =>
                updateField(
                  "llmProvider",
                  event.target.value as "doubao_ark" | "openai_compatible" | "custom_compatible",
                )
              }
            >
              <option value="doubao_ark">豆包 Ark（推荐）</option>
              <option value="openai_compatible">OpenAI 兼容</option>
              <option value="custom_compatible">自定义兼容</option>
            </select>
          </label>

          <label>
            <span className="pixel-label">LLM 模型</span>
            <input
              className="terminal-input"
              value={settings.llmModel}
              onChange={(event) => updateField("llmModel", event.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="pixel-label">LLM 接口地址</span>
          <input
            className="terminal-input"
            placeholder="https://ark.cn-beijing.volces.com/api/v3"
            value={settings.llmApiHost}
            onChange={(event) => updateField("llmApiHost", event.target.value)}
          />
        </label>

        <label className="mt-4 block">
          <span className="pixel-label">LLM API Key</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type={showLlmApiKey ? "text" : "password"}
              className="terminal-input text-lg"
              placeholder="请粘贴 LLM API Key..."
              value={settings.llmApiKey}
              onChange={(event) => updateField("llmApiKey", event.target.value)}
            />
            <button
              type="button"
              className="arcade-button secondary px-3"
              onClick={() => setShowLlmApiKey((prev) => !prev)}
            >
              {showLlmApiKey ? "隐藏" : "显示"}
            </button>
          </div>
        </label>

        <div className="mt-3 settings-action-row">
          <a
            className="arcade-button secondary px-3 py-2 text-xs"
            href={DOUBAO_ARK_APIKEY_URL}
            target="_blank"
            rel="noreferrer"
          >
            获取豆包 API Key
          </a>
          <a
            className="arcade-button secondary px-3 py-2 text-xs"
            href={DOUBAO_ARK_DOC_URL}
            target="_blank"
            rel="noreferrer"
          >
            查看接入文档
          </a>
        </div>

        <label className="mt-4 block">
          <span className="pixel-label">LLM 受信任域名（逗号分隔）</span>
          <textarea
            className="terminal-input min-h-[88px]"
            placeholder="ark.cn-beijing.volces.com, api.openai.com"
            value={settings.trustedLlmHosts.join(", ")}
            onChange={(event) =>
              updateField(
                "trustedLlmHosts",
                event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>

        <div className="mt-6 settings-action-row">
          <button className="arcade-button secondary" onClick={applyDoubaoDefaults}>
            一键使用豆包默认
          </button>
          <button className="arcade-button lime" onClick={handleSave}>
            保存 LLM 设置
          </button>
          <button
            className="arcade-button secondary"
            onClick={() => void handleValidateLlm()}
            disabled={checkingLlm}
          >
            {checkingLlm ? "验证中..." : "验证 LLM Key"}
          </button>
        </div>
      </div>

      <div className="cute-panel border-[#e05577] bg-[#fff4f7]">
        <p className="pixel-title text-xs text-danger">危险操作区</p>
        <p className="mt-2 text-base text-text-muted">
          清空后将删除本地 API Key、历史记录和缓存资源，且不可恢复。
        </p>
        <div className="mt-4">
          <button className="arcade-button danger" onClick={() => void handleClearAll()}>
            清空全部数据
          </button>
        </div>
      </div>

      {saved && <p className="status-line ok">{saved}</p>}
      {checkResult && <p className="status-line muted">{checkResult}</p>}
      {checkLlmResult && <p className="status-line muted">{checkLlmResult}</p>}
    </section>
  );
}
