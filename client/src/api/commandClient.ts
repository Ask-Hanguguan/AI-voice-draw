// LLM 指令解析客户端 — Tool Calling 模式
// 封装后端调用，支持 HTTP（REST）通道，离线自动降级

import type { ToolCallResponse } from "@shared/types.ts";

const API_BASE = "/api";

/**
 * 通过 HTTP POST 调用后端 LLM，返回工具调用列表
 * 4s 超时，失败返回空 calls
 */
export async function parseWithLLM(text: string): Promise<ToolCallResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE}/command/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 503) {
        console.warn("[CommandClient] LLM API Key not configured");
        return { type: "tool_calls", calls: [], raw: text, error: "API Key not configured" };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ToolCallResponse;
  } catch (err: unknown) {
    const message =
      (err as Error)?.name === "AbortError"
        ? "Request timeout"
        : (err as Error)?.message || "Network error";
    console.warn(`[CommandClient] LLM parse failed:`, message);
    return { type: "tool_calls", calls: [], raw: text, error: message };
  }
}

/**
 * 检查后端 LLM 是否可用（链路有 API Key）
 */
export async function isLLMAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.llm === "available";
  } catch {
    return false;
  }
}