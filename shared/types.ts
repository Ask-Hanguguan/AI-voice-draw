// ========== 共享类型定义：前端 & 后端共用 ==========
// 统一的指令类型，对齐前端 commandParser 与后端 commandRouter

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
