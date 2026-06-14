# AI 语音绘图工具 (ai-voice-draw)

一个基于 **React + TypeScript + Fabric.js** 的语音交互绘图应用。用户通过自然语言 / 中文语音描述绘图意图，系统将其解析为结构化的绘图指令，并在画布上实时绘制。后端通过 **阿里云百炼 DashScope（兼容 OpenAI API）** 的 LLM 进行指令语义理解，采用 **Tool Calling** 模式返回可执行的工具调用列表。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目架构](#项目架构)
- [目录结构](#目录结构)
- [关键模块说明](#关键模块说明)
  - [共享层 shared](#共享层-shared)
  - [前端 client](#前端-client)
  - [后端 server](#后端-server)
- [指令集（工具列表）](#指令集工具列表)
- [运行方式](#运行方式)
- [环境变量](#环境变量)
- [开发与调试](#开发与调试)

---

## 功能特性

- 🎙️ **语音识别（Web Speech API）**：浏览器端中文 ASR，实时将语音转为文本
- 🧠 **LLM 指令解析**：基于阿里云百炼 qwen-turbo 进行语义理解，Tool Calling 返回绘图指令
- 🎨 **自由画笔路径**：对无固定模板的图形，由 `qwen3.5-omni-plus` 直接生成 SVG Path 数据绘制
- 🧰 **基础图形绘制**：直线 / 圆 / 椭圆 / 矩形 / 三角形 / 五角星 / 多边形
- 🔀 **图形编辑**：选择 / 移动 / 缩放 / 旋转 / 复制 / 粘贴 / 翻转 / 删除 / 层次排列
- 🖌️ **画笔样式**：颜色 / 粗细 / 填充 / 轮廓 / 虚线 · 点划线 · 实线
- 🔍 **画布视图**：放大 / 缩小 / 还原 / 自适应 / 平移 / 调整尺寸
- ↩️ **撤销重做**：基于 JSON 快照栈，最多保留 10 步
- 💾 **导出 PNG**：2x 清晰度下载
- 🛡️ **前端本地解析 + LLM 回退**：简单指令前端本地解析优先，复杂指令回退到 LLM

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript 5.7 |
| **构建工具** | Vite 6 |
| **样式** | Tailwind CSS 3 + PostCSS |
| **画布渲染** | Fabric.js 6.5 |
| **状态管理** | Zustand 5 |
| **语音** | Web Speech API（`SpeechRecognition`） |
| **TTS 反馈** | Web Speech API（`speechSynthesis`） |
| **后端** | Node.js + Express 4 + TypeScript |
| **LLM** | 阿里云百炼 DashScope（OpenAI 兼容 API） |
| **通信** | HTTP JSON + Socket.IO（预留） |

---

## 项目架构

```
 ┌──────────────────────────────────────────────────────────────┐
 │                        浏览器 (Browser)                        │
 │                                                               │
 │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
 │  │  语音识别   │───▶│  App 指令   │───▶│  Canvas Manager │  │
 │  │ (Web Speech)│    │  分发器     │    │  (Fabric.js)    │  │
 │  └─────────────┘    └─────────────┘    └─────────────────┘  │
 │         │                   │                                  │
 │         ▼                   ▼                                  │
 │  ┌─────────────┐    ┌─────────────┐                            │
 │  │ Hotword     │    │ Zustand     │                            │
 │  │ 纠错器      │    │ Store       │                            │
 │  └─────────────┘    └─────────────┘                            │
 │                             │                                   │
 │                             ▼  HTTP /api/command/parse         │
 └─────────────────────────────┼───────────────────────────────────┘
                               │
 ┌─────────────────────────────▼───────────────────────────────────┐
 │                        Node.js 服务端                            │
 │                                                                  │
 │  ┌──────────────────┐    ┌───────────────────────────┐         │
 │  │  commandRouter   │◀──▶│  ToolRegistry (工具定义)  │         │
 │  │  (Express 路由)  │    │  + LLM 系统 Prompt         │         │
 │  └──────────────────┘    └─────────────┬─────────────┘         │
 │                                         │                         │
 │                                         ▼                         │
 │                        ┌───────────────────────┐                │
 │                        │  阿里云百炼 DashScope  │                │
 │                        │  (OpenAI 兼容)         │                │
 │                        │  qwen-turbo / omni+    │                │
 │                        └───────────────────────┘                │
 └──────────────────────────────────────────────────────────────────┘
```

### 核心流程

1. **语音 → 文本**：`speech.ts` 基于 Web Speech API 监听语音输入，识别文本经 `hotwordCorrector.ts` 做形近词纠错（如"园→圆""话→画"）
2. **文本 → 指令**：
   - 优先走前端本地 `commandParser.ts` 的规则解析；
   - 本地失败 → 发送到后端 `/api/command/parse`，由 LLM Tool Calling 返回 `{ calls: [...] }`
3. **指令 → 绘制**：`App.tsx` 作为指令分发器，调用 `canvasManager.ts`（基础图形）或 `shapeGenerator.ts`（复杂图形，如云、爱心、箭头、皇冠、建筑物等）
4. **LLM 画笔路径**：若用户描述的图形无预定义工具，交由 `qwen3.5-omni-plus-2026-03-15` 直接生成多段 SVG path 数据，`canvasManager.drawBrushPath()` 逐笔绘制

---

## 目录结构

```
ai-voice-draw/
├── client/                          # 前端 (Vite + React + TS)
│   ├── src/
│   │   ├── api/
│   │   │   └── commandClient.ts     # 调用后端 LLM 解析的 HTTP 客户端
│   │   ├── canvas/
│   │   │   ├── canvasManager.ts     # Fabric.js 画布封装（核心）
│   │   │   ├── commandParser.ts     # 前端本地规则解析器
│   │   │   └── shapeGenerator.ts    # 复杂图形渲染器（云、心、猫等）
│   │   ├── components/
│   │   │   ├── Canvas.tsx           # 画布 React 组件
│   │   │   ├── StatusBar.tsx        # 底部状态栏 / 日志
│   │   │   └── WakePanel.tsx        # 唤醒词/状态面板
│   │   ├── speech/
│   │   │   ├── hotwordCorrector.ts  # 形近音近词纠错
│   │   │   ├── speech.ts            # Web Speech 识别封装
│   │   │   ├── tts.ts               # TTS 播报封装
│   │   │   └── voiceFeedback.ts     # 语音反馈调度器
│   │   ├── stores/
│   │   │   └── appStore.ts          # Zustand 全局状态
│   │   ├── App.tsx                  # 主组件 + 指令分发 switch
│   │   ├── main.tsx                 # React 入口
│   │   └── index.css                # Tailwind + 全局样式
│   ├── index.html
│   ├── vite.config.ts               # 代理 /api → 后端 3001
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                          # 后端 (Express + TS)
│   ├── src/
│   │   ├── index.ts                 # HTTP/Socket.IO 服务入口
│   │   ├── commandRouter.ts         # /api/command/parse 路由 + 双层 LLM
│   │   └── toolRegistry.ts          # 工具 Schema + System Prompt 生成
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                          # 前后端共享代码（通过 tsconfig paths 引用）
│   ├── types.ts                     # Command / Tool 等核心类型
│   ├── hotwords.json                # ASR 纠错词表
│   └── instructions-spec.json       # 位置 / 颜色 / 图形 / 渲染器规范
│
├── package.json                     # 根 npm workspaces，concurrently 启动
└── README.md
```

---

## 关键模块说明

### 共享层 `shared/`

- **[types.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/shared/types.ts)**：前后端统一契约
  - `CommandType`：40+ 指令枚举（新建画布、绘图、编辑、样式、导出等）
  - `ToolDefinition` / `ToolCall` / `ToolCallResponse`：LLM Tool Calling 的请求与响应结构体
  - `RendererParams` / `BrushStroke`：复杂图形参数与自由画笔参数
- **[hotwords.json](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/shared/hotwords.json)**：ASR 纠错词典（形状、动作、颜色、位置、修饰符、样式六大类）
- **[instructions-spec.json](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/shared/instructions-spec.json)**：指令规范单一事实来源（SSOT），涵盖位置映射、方向向量、角度表、基础图形、颜色表、尺寸表、动作动词、画布尺寸、线条风格、填充模式、以及 25+ 复杂图形（云、心、星、箭头、月亮、水滴、猫、狗、鸟、鱼、房子、车、山、闪电、音符、皇冠等）

### 前端 `client/`

- **[stores/appStore.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/stores/appStore.ts)**：Zustand store
  - `status` / `lastRecognizedText` — 语音状态
  - `canvasConfig`（`{ width, height }`）
  - `zoomLevel`（0.1 ~ 5.0）
  - `brushColor` / `brushStrokeWidth` / `brushFill` / `brushDashArray` — 画笔样式
  - `pendingConfirm` — 需用户二次确认的操作钩子
- **[canvas/canvasManager.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/canvas/canvasManager.ts)**：**核心类 `CanvasManager`**
  - 封装 `FabricCanvas` 生命周期（`create / destroy / resize`）
  - 视图：`zoomIn / zoomOut / zoomReset / zoomToFit / pan`
  - 历史栈：`saveSnapshot / undo / redo`（JSON 序列化，最多 10 步）
  - 基础图形：`drawLine / drawCircle / drawRect / drawTriangle / drawStar / drawPolygon`
  - 图形编辑：`selectLast / selectByType / selectAll / moveSelected / scaleSelected / rotateSelected / copySelected / pasteSelected / flipSelected / deleteLast`
  - 画笔路径：`drawBrushPath(strokes)` — 每笔一条 SVG `Path`
  - 网格背景：`addGrid()` 自动添加 40px 间距参考线
- **[canvas/commandParser.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/canvas/commandParser.ts)**：前端规则解析器，基于关键字 + 正则匹配快速返回 `{ type, params }`
- **[canvas/shapeGenerator.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/canvas/shapeGenerator.ts)**：`drawShape(renderer, canvas, params)` — 复杂图形工厂（云、爱心、星星、箭头、圆角矩形、对话气泡、月亮、水滴、十字、雪花、太阳、花、树、斑点、猫、狗、鸟、鱼、蝴蝶、房子、车、船、山、闪电、音符、蘑菇、叶子、眼睛、皇冠等 25+ 种）
- **[api/commandClient.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/api/commandClient.ts)**：
  - `parseWithLLM(text)`：`POST /api/command/parse`，5 秒超时，失败返回空 `calls`
  - `isLLMAvailable()`：`GET /api/health` 探测
- **[speech/hotwordCorrector.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/speech/hotwordCorrector.ts)**：加载 `hotwords.json`，对 ASR 文本做形近词替换
- **[speech/speech.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/speech/speech.ts)**：`SpeechRecognition` 封装，提供 `start/stop/onresult` 钩子
- **[speech/tts.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/speech/tts.ts)**：`speechSynthesis` 封装
- **[speech/voiceFeedback.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/speech/voiceFeedback.ts)**：反馈调度，根据事件类型选择提示语 + TTS 播报
- **[App.tsx](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/client/src/App.tsx)**：**主指令分发器**
  - 维护 `canvasKey` / `pendingConfirm` / `isProcessing`
  - `executeCommand(text)`：先本地解析，命中则执行；未命中则调 `parseWithLLM()`
  - `executeParsedDirect(cmd, raw)`：基于 `cmd.type` 的大型 `switch`，对应调用 `canvasManager.*`、`shapeGenerator.drawShape()`、store 更新等
  - 含"小笔小笔"唤醒词检测、暂停/恢复、确认/取消对话

### 后端 `server/`

- **[index.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/server/src/index.ts)**：
  - 创建 Express 应用 + Socket.IO（CORS 限制 `http://localhost:5173`）
  - 挂载 `/api` 路由
  - `GET /api/health` 返回 LLM 可用性、模型名
  - WS 事件 `parse:command` → 同样调用 `/api/command/parse` 回传
- **[commandRouter.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/server/src/commandRouter.ts)**：
  - **双层路由模式**：
    1. **第一层**（`qwen-turbo`，快速、便宜）：匹配预定义工具（不含 `brush_path`）
    2. **第二层**（`qwen3.5-omni-plus-2026-03-15`，空间推理强）：仅允许 `brush_path`，生成 SVG 路径序列
  - 均 4s 超时；任一命中即返回 `{ type: "tool_calls", calls, raw }`；两层均空则返回 `calls: []`
- **[toolRegistry.ts](file:///d:/Desktop/AI语言绘图工具/ai-voice-draw/server/src/toolRegistry.ts)**：
  - `buildTools()`：输出 30+ 条 Tool schema，供 OpenAI `chat.completions.create({ tools })` 使用
  - `buildSystemPrompt()`：组合颜色表、位置表、复杂图形表，形成约 800 字的中文 System Prompt，指导 LLM 选择合适工具与参数
  - `draw_shape` 工具的 `renderer` 字段枚举直接读取 `instructions-spec.json` 的 complexShapes

---

## 指令集（工具列表）

| 分类 | 工具名 / CommandType | 主要参数 |
|------|----------------------|---------|
| 画布 | `new_canvas`, `clear_canvas`, `canvas_resize`, `exit` | `width`, `height` |
| 视图 | `canvas_zoom_in`, `canvas_zoom_out`, `canvas_zoom_reset`, `canvas_zoom_fit`, `canvas_pan` | `direction`, `amount` |
| 历史 | `undo`, `redo` | - |
| 基础图形 | `draw_line`, `draw_circle`, `draw_rectangle`, `draw_triangle`, `draw_star`, `draw_polygon` | `x,y,size,radius,sides,width,height,fill,stroke,strokeWidth,opacity` |
| 复杂图形 | `draw_shape` | `renderer`（云、心、猫、房子…） + 通用参数 |
| 画笔样式 | `brush_color`, `brush_width`, `fill_mode`, `line_style` | `color`, `mode`, `value`, `delta` |
| 选择与编辑 | `select_shape`, `delete_shape`, `move_shape`, `scale_shape`, `rotate_shape`, `copy_shape`, `paste_shape`, `flip_shape`, `modify_shape`, `arrange_shapes` | `direction`, `factor`, `angle`, `operation` 等 |
| 画笔自由绘制 | `brush_path` | `strokes: [{ pathData, fill, stroke, strokeWidth, opacity }]` |
| 导出 | `save_image` | - |
| 未识别 | `unrecognized` | （触发 LLM 回退） |

---

## 运行方式

### 前置要求

- **Node.js ≥ 18**
- **现代浏览器**（Chrome / Edge 最佳，Web Speech API 对中文支持最好）
- **阿里云百炼 API Key**（免费申请：https://dashscope.console.aliyun.com/）

### 步骤

```bash
# 1. 安装依赖（根目录 workspaces 会同时安装 client & server）
cd ai-voice-draw
npm install

# 2. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，填入：
#   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxx

# 3. 启动（前端 + 后端同时启动）
npm run dev

# 或单独启动
npm run dev:client      # http://localhost:5173
npm run dev:server      # http://localhost:3001
```

浏览器打开 **http://localhost:5173**，首次访问会请求麦克风权限。

> 🔊 提示：需要在有麦克风的环境下使用；若浏览器不支持语音识别，也可直接在浏览器控制台调用 `window.__store.getState()` 检查状态，或直接使用 `parseWithLLM("画一个红色圆形")` 测试 LLM 解析。

### 构建

```bash
npm run build          # 同时构建 client + server
# 产物：
#   client/dist/       # Vite 静态资源
#   server/dist/       # ts 编译的 node 模块
```

---

## 环境变量

`server/.env`：

```dotenv
# 阿里云百炼 API Key（必填，否则 LLM 链路不可用）
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 文本解析模型（第一层）
LLM_MODEL=qwen-turbo

# 画笔路径绘制模型（第二层，空间推理强）
BRUSH_MODEL=qwen3.5-omni-plus-2026-03-15

# 后端 HTTP / WebSocket 端口
PORT=3001
```

---

## 开发与调试

- **日志**：前端在 DevTools Console 有 `[Voice]` / `[Canvas]` / `[CommandClient]` 前缀的日志；后端在终端打印 `[CommandRouter]` 与 `[WS]` 日志
- **全局挂载**：
  - `window.__store` → Zustand store 快照
  - `window.canvasManager` → 单例 `CanvasManager`，可在控制台直接调用方法调试
- **前端代理**：`vite.config.ts` 把 `/api` / `/socket.io` 代理到 `http://localhost:3001`
- **类型检查**：
  ```bash
  npm run typecheck      # 前后端同时 tsc --noEmit
  ```
- **无 API Key 降级**：未配置 `DASHSCOPE_API_KEY` 时，前端本地规则解析仍可用，支持基本图形、撤销、缩放、颜色、样式、复杂图形等；LLM 回退链路会返回空工具调用列表，并在状态栏提示

---

## 常用语音指令示例

| 意图 | 可用说法 |
|------|---------|
| 新建画布 | "新建画布" / "开始绘画" / "800x600 画布" |
| 画圆 | "画一个红色的圆" / "画一个大圆" / "在左上角画一个椭圆" |
| 基础图形 | "画一个矩形" / "画一个三角形" / "画一个五角星" / "画一个六边形" |
| 复杂图形 | "画一朵云" / "画一个爱心" / "画一只小猫" / "画一座房子" / "画一道闪电" / "画一个皇冠" |
| 画笔样式 | "换成蓝色" / "加粗" / "细一点" / "虚线" / "只画轮廓" / "填充" |
| 编辑 | "选中圆形" / "全选" / "向右移动" / "放大一点" / "旋转 90 度" / "复制" / "粘贴" / "删除" |
| 视图 | "放大" / "缩小" / "恢复原始大小" / "适应屏幕" / "画布向左移" |
| 撤销重做 | "撤销" / "回退" / "重做" / "恢复" |
| 保存 | "保存图片" / "下载" / "导出为 PNG" |
| 自由描述 | "画一座冒烟的小房子" / "画一只微笑的小猫"（交由 omni 生成画笔路径） |

祝你绘图愉快 🎨
