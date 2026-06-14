// ========== 共享类型定义：前端 & 后端共用 ==========
// 统一指令类型，对齐前端 commandParser 与后端 commandRouter

export type CommandType =
  | "new_canvas"
  | "clear_canvas"
  | "undo"
  | "redo"
  | "exit"
  | "canvas_zoom_in"
  | "canvas_zoom_out"
  | "canvas_zoom_reset"
  | "canvas_zoom_fit"
  | "canvas_pan"
  | "canvas_resize"
  | "draw_line"
  | "draw_circle"
  | "draw_rectangle"
  | "draw_triangle"
  | "draw_star"
  | "draw_polygon"
  | "draw_shape"
  | "brush_color"
  | "brush_width"
  | "fill_mode"
  | "line_style"
  | "delete_shape"
  | "select_shape"
  | "move_shape"
  | "scale_shape"
  | "rotate_shape"
  | "copy_shape"
  | "paste_shape"
  | "flip_shape"
  | "modify_shape"
  | "arrange_shapes"
  | "brush_path"
  | "save_image"
  | "unrecognized";

export interface Command {
  type: CommandType;
  params: Record<string, unknown>;
  raw: string;
}

export interface ParseRequest {
  text: string;
}

export interface ParseResponse {
  type: CommandType;
  params: Record<string, unknown>;
  raw: string;
  error?: string;
}

// ========== 工具调用（Tool Calling）类型 ==========

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  /** 数组类型的子元素 schema */
  items?: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResponse {
  type: "tool_calls";
  calls: ToolCall[];
  raw: string;
  error?: string;
}

// ========== 指令规范 JSON 的类型定义 ==========

export interface PositionEntry {
  keyword: string;
  aliases: string[];
  x: number;
  y: number;
}

export interface DirectionEntry {
  keyword: string;
  aliases: string[];
  axis: "x" | "y";
  delta: number;
}

export interface ShapeEntry {
  type: CommandType;
  keywords: string[];
  defaultParams: Record<string, unknown>;
}

export interface ComplexShapeEntry {
  renderer: string;
  aliases: string[];
  defaultParams: Record<string, unknown>;
}

export interface ColorEntry {
  keyword: string;
  aliases: string[];
  hex: string;
}

export interface SizeEntry {
  keyword: string;
  aliases: string[];
  radius: number;
}

// ========== 渲染器参数 ==========

export interface RendererParams {
  x: number;
  y: number;
  size: number;
  aspect?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  extras?: Record<string, number>;
}

// ========== LLM 画笔路径（Brush Path Drawing） ==========

/** 单笔笔触命令 */
export interface BrushStroke {
  /** SVG 路径数据，如 "M 400 300 L 420 280 Q 440 260 460 280" */
  pathData: string;
  /** 填充色 (hex) */
  fill?: string;
  /** 描边色 (hex) */
  stroke?: string;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 透明度 0~1 */
  opacity?: number;
}

/** 画笔路径绘制参数 */
export interface BrushPathParams {
  /** 画笔笔触数组，按顺序执行 */
  strokes: BrushStroke[];
}