// 阿里云百炼(DashScope) 指令解析路由 — Tool Calling 模式
// LLM 直接调用工具，返回 tool_calls 给前端执行
// 兼容 OpenAI SDK，预留多模态扩展（qwen-vl 系列）

import { Router } from "express";
import OpenAI from "openai";
import { buildTools, buildSystemPrompt } from "./toolRegistry.ts";
import type { ToolCallResponse } from "../../shared/types.ts";

const router = Router();

// ========== 创建 OpenAI 客户端（百炼兼容）==========
function getClient(): OpenAI | null {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || apiKey === "sk-xxx") return null;
  return new OpenAI({
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey,
  });
}

function getModel(): string {
  return process.env.LLM_MODEL || "qwen-turbo";
}

// ========== POST /api/command/parse — Tool Calling 模式 ==========
router.post("/command/parse", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    res.json({
      type: "tool_calls",
      calls: [],
      raw: "",
      error: "Missing text field",
    } satisfies ToolCallResponse);
    return;
  }

  const client = getClient();
  if (!client) {
    res.status(503).json({
      type: "tool_calls",
      calls: [],
      raw: text,
      error: "DASHSCOPE_API_KEY not configured",
    } satisfies ToolCallResponse);
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const tools = buildTools();

    const completion = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: text },
        ],
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 800,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const choice = completion.choices[0];
    if (!choice) throw new Error("Empty response from LLM");

    // 提取 tool_calls
    const toolCalls = choice.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // 没有工具调用 → 非绘图指令或闲聊
      console.log(`[CommandRouter] "${text}" → 无工具调用（非绘图指令）`);
      res.json({
        type: "tool_calls",
        calls: [],
        raw: text,
      } satisfies ToolCallResponse);
      return;
    }

    const calls = toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    }));

    console.log(`[CommandRouter] "${text}" → ${calls.map(c => c.name).join(", ")}`);
    res.json({
      type: "tool_calls",
      calls,
      raw: text,
    } satisfies ToolCallResponse);
  } catch (err: unknown) {
    const message =
      (err as Error)?.name === "AbortError"
        ? "Request timeout"
        : (err as Error)?.message || String(err);
    console.warn(`[CommandRouter] Error parsing "${text}":`, message);
    res.json({
      type: "tool_calls",
      calls: [],
      raw: text,
      error: message,
    } satisfies ToolCallResponse);
  }
});

// ========== GET /api/health ==========
router.get("/health", (_req, res) => {
  const client = getClient();
  res.json({
    status: "ok",
    llm: client ? "available" : "unavailable",
    model: getModel(),
  });
});

export default router;