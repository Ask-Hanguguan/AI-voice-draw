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

function getBrushModel(): string {
  return process.env.BRUSH_MODEL || "qwen3.5-omni-plus-2026-03-15";
}

// ========== LLM 调用辅助 ==========

async function callLLM(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  text: string,
  tools: ReturnType<typeof buildTools>,
  timeoutMs = 4000,
): Promise<ToolCallResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
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
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const choice = completion.choices[0];
    if (!choice) throw new Error("Empty response from LLM");

    const toolCalls = choice.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { type: "tool_calls", calls: [], raw: text };
    }

    const calls = toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    }));

    return { type: "tool_calls", calls, raw: text };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ========== POST /api/command/parse — 双层路由模式 ==========
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
    const allTools = buildTools();
    // 拆分为预定义工具（不含 brush_path）和画笔工具（仅 brush_path）
    const predefinedTools = allTools.filter((t) => t.name !== "brush_path");
    const brushTool = allTools.filter((t) => t.name === "brush_path");

    // 第一层：qwen-turbo 匹配预定义工具（快速、便宜）
    console.log(`[CommandRouter] 第一层(turbo): "${text}"`);
    const result1 = await callLLM(client, getModel(), buildSystemPrompt(), text, predefinedTools, 4000);

    if (result1.calls.length > 0) {
      // turbo 成功匹配 → 直接返回
      console.log(`[CommandRouter] turbo → ${result1.calls.map((c) => c.name).join(", ")}`);
      res.json(result1);
      return;
    }

    // 第二层：omni 画笔自由绘制（空间感更强）
    console.log(`[CommandRouter] 第二层(omni): "${text}"`);
    const brushSystemPrompt = `你是画笔画家。用户描述什么你就用 SVG 路径画什么。画布 800x600，中心(400,300)。必须调用 brush_path。SVG 命令：M=移动到 L=画线 Q=二次贝塞尔 C=三次贝塞尔 A=圆弧 Z=闭合。笔触越少越好。`;
    const result2 = await callLLM(client, getBrushModel(), brushSystemPrompt, text, brushTool, 8000);

    if (result2.calls.length > 0) {
      console.log(`[CommandRouter] omni → ${result2.calls.map((c) => c.name).join(", ")}`);
      res.json(result2);
      return;
    }

    // 两层都没结果 → 非绘图指令
    console.log(`[CommandRouter] "${text}" → 无工具调用（非绘图指令）`);
    res.json({ type: "tool_calls", calls: [], raw: text } satisfies ToolCallResponse);
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