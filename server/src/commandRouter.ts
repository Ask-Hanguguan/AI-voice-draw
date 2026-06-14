// 阿里云百炼 (DashScope) 指令解析路由
// 将用户自然语言文本通过通义千问 LLM 转为结构化绘图指令
// 兼容 OpenAI SDK，预留多模态扩展（qwen-vl 系列）

import { Router } from "express";
import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandType, ParseResponse } from "../../shared/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();

// ========== 加载指令规范 JSON ==========
const specPath = resolve(__dirname, "../../shared/instructions-spec.json");
const spec = JSON.parse(readFileSync(specPath, "utf-8"));

// ========== 动态构建 System Prompt ==========
function buildSystemPrompt(): string {
  const shapes = spec.shapes
    .map((s: { keywords: string[]; type: string }) => `  - ${s.keywords.join("/")} → ${s.type}`)
    .join("\n");

  const colors = spec.colors
    .map((c: { keyword: string; hex: string }) => `  - ${c.keyword} (${c.hex})`)
    .join("\n");

  const sizes = spec.sizes
    .map((s: { keyword: string; radius: number }) => `  - ${s.keyword} (半径≈${s.radius}px)`)
    .join("\n");

  const positions = spec.positions
    .map((p: { keyword: string; x: number; y: number }) => `  - ${p.keyword} (x=${p.x}, y=${p.y})`)
    .join("\n");

  const directions = spec.directions
    .map((d: { keyword: string; axis: string; delta: number }) => `  - ${d.keyword} (${d.axis}轴 ${d.delta}px)`)
    .join("\n");

  const lineStyles = spec.lineStyles
    .map((l: { keyword: string }) => `  - ${l.keyword}`)
    .join("\n");

  const fillModes = spec.fillModes
    .map((f: { keyword: string; mode: string }) => `  - ${f.keyword} → mode: "${f.mode}"`)
    .join("\n");

  return `你是一个语音绘图指令解析器。用户通过语音说出绘图指令，你需要将自然语言转换为结构化 JSON 指令。

## 支持的指令类型

### 画布操作
- new_canvas: 新建画布。params: { width?: number, height?: number }
  默认 800×600，A4 794×1123，正方形 800×800
- clear_canvas: 清空画布。params: {}
- exit: 退出/休眠。params: {}

### 视图操作
- canvas_zoom_in: 放大画布。params: {}
- canvas_zoom_out: 缩小画布。params: {}
- canvas_zoom_reset: 恢复原始大小。params: {}
- canvas_zoom_fit: 适应屏幕/全屏显示。params: {}
- canvas_pan: 平移画布。params: { direction?: string, amount?: number }

### 历史操作
- undo: 撤销上一步。params: {}
- redo: 恢复撤销。params: {}

### 基础图形
- draw_line: 绘制直线。params: { x1?, y1?, x2?, y2? }
- draw_circle: 绘制圆形。params: { x?, y?, radius? }
- draw_rectangle: 绘制矩形。params: { x?, y?, width?, height? }
- draw_triangle: 绘制三角形。params: { x?, y?, size? }
- draw_star: 绘制五角星。params: { x?, y?, radius? }
- draw_polygon: 绘制多边形。params: { x?, y?, radius?, sides? }

### 样式设置
- brush_color: 设置画笔颜色。params: { color: string, colorName?: string }
  支持颜色：${spec.colors.map((c: { keyword: string }) => c.keyword).join("、")}
- brush_width: 设置画笔粗细。params: { mode: string, value?: number, delta?: number }
- fill_mode: 设置填充模式。params: { mode: "fill_color" | "outline" | "default", color?: string }
- line_style: 线条风格。params: { mode: "dashed" | "dotted" | "solid" }

### 图形编辑
- delete_shape: 删除图形。params: {}
- select_shape: 选中图形。params: { type?: string }
- move_shape: 移动图形。params: { direction?: string, distance?: number }
- scale_shape: 缩放图形。params: { scale?: number }
- rotate_shape: 旋转图形。params: { angle?: number }
- copy_shape: 复制图形。params: { count?: number }

### 文件操作
- save_image: 保存图片。params: {}

### 兜底
- unrecognized: 无法识别或非绘图指令。params: {}

## 指令知识库（从 JSON 配置自动生成）

### 位置映射（坐标值为相对比例 0~1）
${positions}

### 方向
${directions}

### 图形类型
${shapes}

### 颜色
${colors}

### 大小
${sizes}

### 线条风格
${lineStyles}

### 填充模式
${fillModes}

## 解析规则
1. 只输出一个 JSON 对象，包含 type 和 params 字段
2. 如果是闲聊或与绘图无关的内容，返回 type: "unrecognized"
3. 数字参数使用 number 类型，不要用字符串
4. 必须包含 raw 字段，值为原始用户输入文本
5. 位置参数优先使用相对坐标（x: 0~1, y: 0~1），其次用像素值
6. 输出格式严格为：{ "type": "xxx", "params": { ... }, "raw": "..." }
7. 复杂多步骤指令应拆解为多个独立指令依次返回
8. 模糊指令尽量推断合理默认值，不确定时使用默认参数`;
}

// ========== 创建 OpenAI 客户端（百炼兼容） ==========
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

// ========== POST /api/command/parse ==========
router.post("/command/parse", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    res.status(400).json({
      type: "unrecognized",
      params: {},
      raw: "",
      error: "Missing text field",
    } satisfies ParseResponse);
    return;
  }

  const client = getClient();
  if (!client) {
    res.status(503).json({
      type: "unrecognized",
      params: {},
      raw: text,
      error: "DASHSCOPE_API_KEY not configured",
    } satisfies ParseResponse);
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const completion = await client.chat.completions.create(
      {
        model: getModel(),
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from LLM");

    const parsed = JSON.parse(content);
    const result: ParseResponse = {
      type: (parsed.type || "unrecognized") as CommandType,
      params: parsed.params || {},
      raw: text,
    };

    console.log(`[CommandRouter] "${text}" → ${result.type}`);
    res.json(result);
  } catch (err: unknown) {
    const message = (err as Error)?.name === "AbortError"
      ? "Request timeout"
      : (err as Error)?.message || String(err);
    console.warn(`[CommandRouter] Error parsing "${text}":`, message);
    res.json({
      type: "unrecognized",
      params: {},
      raw: text,
      error: message,
    } satisfies ParseResponse);
  }
});

export default router;
