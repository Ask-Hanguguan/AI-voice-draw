// LLM 指令解析客户端
// 封装后端调用，支持 HTTP（REST）和 WebSocket 双通道，离线自动降级
import type { ParseRequest, ParseResponse } from "@shared/types.ts";

const API_BASE = "/api";

/**
 * 通过 HTTP POST 调用后端 LLM 解析指令
 * 3s 超时，失败返回 unrecognized
 */
export async function parseWithLLM(text: string): Promise<ParseResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE}/command/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text } satisfies ParseRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 503 = API Key 未配置
      if (response.status === 503) {
        console.warn("[CommandClient] LLM API Key not configured");
        return {
          type: "unrecognized",
          params: {},
          raw: text,
          error: "API Key not configured",
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ParseResponse;
  } catch (err: unknown) {
    const message = (err as Error)?.name === "AbortError"
      ? "Request timeout"
      : (err as Error)?.message || "Network error";
    console.warn(`[CommandClient] LLM parse failed:`, message);
    return {
      type: "unrecognized",
      params: {},
      raw: text,
      error: message,
    };
  }
}

/**
 * 检查后端 LLM 是否可用（链路上有 API Key）
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
