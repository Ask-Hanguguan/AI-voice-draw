// 指令解析器 — Phase 1 正则匹配
// 将语音识别文本转换为结构化绘图指令

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
  | "draw_line"
  | "draw_circle"
  | "draw_rectangle"
  | "draw_triangle"
  | "brush_color"
  | "brush_width"
  | "fill_mode"
  | "delete_shape"
  | "save_image"
  | "canvas_resize"
  | "canvas_pan"
  | "draw_star"
  | "draw_polygon"
  | "line_style"
  | "select_shape"
  | "move_shape"
  | "scale_shape"
  | "rotate_shape"
  | "copy_shape"
  | "paste_shape"
  | "flip_shape"
  | "unrecognized";

export interface Command {
  type: CommandType;
  params: Record<string, unknown>;
  raw: string;
}

import spec from "@shared/instructions-spec.json";
// ========== 画布尺寸配置 ==========
// 从 JSON 指令规范构建画布尺寸映射
const CANVAS_SIZES: Record<string, { width: number; height: number }> = {};
for (const cs of spec.canvasSizes) {
  CANVAS_SIZES[cs.keyword] = { width: cs.width, height: cs.height };
  for (const alias of cs.aliases) {
    CANVAS_SIZES[alias] = { width: cs.width, height: cs.height };
  }
}

// ========== F006~F009: 位置映射 ==========
// 从 JSON 指令规范构建位置映射
const POSITION_AREAS: Record<string, { x: number; y: number }> = {};
for (const pos of spec.positions) {
  POSITION_AREAS[pos.keyword] = { x: pos.x, y: pos.y };
  for (const alias of pos.aliases) {
    POSITION_AREAS[alias] = { x: pos.x, y: pos.y };
  }
}

// 大小映射 (半径)
// 从 JSON 指令规范构建大小映射
const SIZE_MAP: Record<string, number> = {};
for (const sz of spec.sizes) {
  SIZE_MAP[sz.keyword] = sz.radius;
  for (const alias of sz.aliases) {
    SIZE_MAP[alias] = sz.radius;
  }
}

// 辅助：提取位置参数
function extractPosition(text: string): { x: number; y: number } | null {
  for (const [key, area] of Object.entries(POSITION_AREAS)) {
    if (text.includes(key)) return { ...area };
  }
  return null;
}

// 辅助：提取大小参数
function extractSize(text: string): number | null {
  for (const [key, size] of Object.entries(SIZE_MAP)) {
    if (text.includes(key)) return size;
  }
  return null;
}

// 辅助：提取数值参数 (如 半径50, 宽100, 高200, 边长80)
function extractNumeric(text: string, keywords: string[]): number | null {
  for (const kw of keywords) {
    const m = text.match(new RegExp(kw + "(\\d+)"));
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// 辅助：提取宽高 (如 宽800 高600, 1024x768)
function extractDimensions(text: string): { width: number; height: number } | null {
  // 格式: 宽800 高600
  const w1 = extractNumeric(text, ["宽度", "宽"]);
  const h1 = extractNumeric(text, ["高度", "高"]);
  if (w1 && h1) return { width: w1, height: h1 };
  // 格式: 1024x768, 1024乘768, 1024*768
  const m = text.match(/(\d{3,4})\s*[x×乘\*]\s*(\d{3,4})/);
  if (m) return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
  return null;
}

// 辅助：提取中文数字表示的边数 (如 五边形→5, 六边形→6)
// 中文数字→阿拉伯数字映射
const CN_SIDES: Record<string, number> = {
  "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
};
function extractSides(text: string): number | null {
  // "正?N边形" / "正?N角形" 如 "五边形", "正六边形", "正五角形"
  const m = text.match(/(三|四|五|六|七|八|九|十)边/);
  if (m && m[1]) return CN_SIDES[m[1]] ?? null;
  const m2 = text.match(/(三|四|五|六|七|八|九|十)角形/);
  if (m2 && m2[1]) return CN_SIDES[m2[1]] ?? null;
  // 阿拉伯数字: "3边形", "6边形"
  const m3 = text.match(/(\d+)\s*边/);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

// ========== 指令规则表 ==========

interface Rule {
  type: CommandType;
  patterns: RegExp[];
  extractParams?: (match: RegExpMatchArray, text: string) => Record<string, unknown>;
}

const rules: Rule[] = [
  // ---- 退出/休眠 ----
  {
    type: "exit",
    patterns: [/^(退出|休眠|睡觉|休息)$/],
  },

  // ---- 新建画布 ----
  {
    type: "new_canvas",
    patterns: [/新建.*A4.*画/, /A4.*画[布板]/, /新建.*A4/],
    extractParams: () => ({ ...CANVAS_SIZES.a4 }),
  },
  {
    type: "new_canvas",
    patterns: [/新建.*正方.*画/, /正方.*画[布板]/, /正方形.*画[布板]/],
    extractParams: () => ({ ...CANVAS_SIZES.square }),
  },
  {
    type: "new_canvas",
    patterns: [
      /新建.*画[布板面]/, /创建.*画[布板面]/, /开一.*新.*[图画面]/,
      /打开.*画[布板面]/, /新.*画[布板面]/, /建.*画[布板面]/, /新建/,
    ],
    extractParams: () => ({ ...CANVAS_SIZES.default }),
  },

  // ---- F015: 删除最近绘制的图形 ----
  {
    type: "delete_shape",
    patterns: [
      /删除.*(?:图形|这个|那个|最后|上一[个些]|对象)/,
      /(?:删掉|去掉).*(?:图形|这个|那个|最后|上一[个些]|对象)/,
      /擦掉.*(?:这个|那个|最后|图形|对象)/,
      /^删[除掉]$/,
      /^去掉$/,
    ],
  },

  // ---- 清空画布 ----
  {
    type: "clear_canvas",
    patterns: [/清空.*画[布板面]/, /擦掉.*/, /清除.*画[布板面]/],
  },

  // ---- F025: 缩放图形（必须在 F005 画布缩放之前，避免 /放大/ /缩小/ 误匹配）----
  {
    type: "scale_shape",
    patterns: [
      /图形.*放大/,
      /放大.*图形/,
      /图形.*变大/,
    ],
    extractParams: () => ({ factor: 1.2 }),
  },
  {
    type: "scale_shape",
    patterns: [
      /图形.*缩小/,
      /缩小.*图形/,
      /图形.*变小/,
    ],
    extractParams: () => ({ factor: 0.8 }),
  },

  // ---- F005: 画布缩放 ----
  {
    type: "canvas_zoom_fit",
    patterns: [
      /全屏.*显[示视]/, /全屏/,
      /适应.*屏[幕]/, /适合.*屏[幕]/, /自适[应合]/,
      /充满.*屏[幕]/, /铺满.*屏[幕]/,
    ],
  },
  {
    type: "canvas_zoom_reset",
    patterns: [
      /原始.*大[小]/, /恢复.*大[小]/, /重置.*缩[放]/,
      /原[大样]/, /百分[之]?百/,
    ],
  },
  {
    type: "canvas_zoom_in",
    patterns: [
      /放大.*画[布板]/, /画[布板].*放大/,
      /放大.*一[点些]/, /再放大/, /继续放大/,
      /放大/,
    ],
  },
  {
    type: "canvas_zoom_out",
    patterns: [
      /缩小.*画[布板]/, /画[布板].*缩小/,
      /缩小.*一[点些]/, /再缩小/, /继续缩小/,
      /缩小/,
    ],
  },

  // ---- 撤销 ----
  {
    type: "undo",
    patterns: [/撤销/, /撤[消退]/, /回[退撤]/, /上一步/, /还[原回]/],
  },

  // ---- 恢复 ----
  {
    type: "redo",
    patterns: [/恢复/, /重[做建]/, /下一步/, /前[进移]/, /还[原回]撤/],
  },

  // ---- F016: 保存图片 ----
  {
    type: "save_image",
    patterns: [
      /保存.*(?:图片|图像|画[布板面]|为)/,
      /导出.*(?:图片|图像|画[布板面]|PNG)/,
      /存一[下个]/,
      /下载.*(?:图片|图像|画[布板面])/,
      /^保存$/,
      /^导出$/,
    ],
  },

  // ---- F017: 自定义画布尺寸 ----
  {
    type: "canvas_resize",
    patterns: [
      /画布.*(?:大小|尺寸|宽).*/,
      /(?:设置|调整|修改|改).*画布.*(?:大小|尺寸)/,
      /画布.*改为?/,
      /调整.*画布/,
    ],
    extractParams: (_match, text) => {
      const dims = extractDimensions(text);
      return dims ? { width: dims.width, height: dims.height } : {};
    },
  },

  // ---- F018: 画布平移（必须含"画布"，避免与 F024 图形移动混淆）----
  {
    type: "canvas_pan",
    patterns: [
      /画布.*(?:向上|往上|向?上).*移/,
      /(?:向上|往上).*移.*画布/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "up", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /画布.*(?:向下|往下|向?下).*移/,
      /(?:向下|往下).*移.*画布/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "down", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /画布.*(?:向左|往左|向?左).*移/,
      /(?:向左|往左).*移.*画布/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "left", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /画布.*(?:向右|往右|向?右).*移/,
      /(?:向右|往右).*移.*画布/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "right", amount: amount || 100 };
    },
  },

  // ---- F023: 选中图形 ----
  {
    type: "select_shape",
    patterns: [
      /选中.*(?:最近|最后|上一[个些]).*/,
      /选择.*(?:最近|最后|上一[个些]).*/,
    ],
    extractParams: () => ({ mode: "last" }),
  },
  {
    type: "select_shape",
    patterns: [
      /选中.*(?:圆|矩形|三角|直线|五角星|多边)/,
      /选择.*(?:圆|矩形|三角|直线|五角星|多边)/,
      /选中.*(?:长方形|正方形|星|线)/,
      /选择.*(?:长方形|正方形|星|线)/,
    ],
    extractParams: (_match, text) => {
      const types = ["圆形", "圆", "矩形", "长方形", "正方形", "三角形", "三角", "直线", "线", "五角星", "星形", "星星", "多边形"];
      for (const t of types) {
        if (text.includes(t)) return { mode: "type", shapeType: t };
      }
      return { mode: "type", shapeType: "圆形" };
    },
  },
  {
    type: "select_shape",
    patterns: [
      /全选/,
      /选中.*所有/,
      /选择.*所有/,
      /选中.*全部/,
    ],
    extractParams: () => ({ mode: "all" }),
  },
  {
    type: "select_shape",
    patterns: [
      /取消.*(?:选中|选择)/,
      /取消选中/,
      /清除.*(?:选中|选择)/,
    ],
    extractParams: () => ({ mode: "deselect" }),
  },

  // ---- F024: 移动图形（含"图形"关键词，区别于 F018 画布平移）----
  {
    type: "move_shape",
    patterns: [
      /图形.*(?:向上|往上|向?上).*移/,
      /(?:向上|往上).*移.*图形/,
      /上移.*图形/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "up", amount: amount || 50 };
    },
  },
  {
    type: "move_shape",
    patterns: [
      /图形.*(?:向下|往下|向?下).*移/,
      /(?:向下|往下).*移.*图形/,
      /下移.*图形/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "down", amount: amount || 50 };
    },
  },
  {
    type: "move_shape",
    patterns: [
      /图形.*(?:向左|往左|向?左).*移/,
      /(?:向左|往左).*移.*图形/,
      /左移.*图形/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "left", amount: amount || 50 };
    },
  },
  {
    type: "move_shape",
    patterns: [
      /图形.*(?:向右|往右|向?右).*移/,
      /(?:向右|往右).*移.*图形/,
      /右移.*图形/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["移"]);
      return { direction: "right", amount: amount || 50 };
    },
  },

  // ---- F026: 旋转图形 ----
  {
    type: "rotate_shape",
    patterns: [
      /图形.*(?:顺时针|向右).*旋[转]/,
      /(?:顺时针|向右).*旋[转].*图形/,
      /旋[转].*图形/,
      /图形.*旋[转]/,
    ],
    extractParams: (_match, text) => {
      const angle = extractNumeric(text, ["旋转", "旋", "转"]);
      return { angle: angle || 45 };
    },
  },
  {
    type: "rotate_shape",
    patterns: [
      /图形.*(?:逆时针|向左).*旋[转]/,
      /(?:逆时针|向左).*旋[转].*图形/,
    ],
    extractParams: (_match, text) => {
      const angle = extractNumeric(text, ["旋转", "旋", "转"]);
      return { angle: -(angle || 45) };
    },
  },

  // ---- F027: 复制粘贴 ----
  {
    type: "copy_shape",
    patterns: [
      /复制.*图形/,
      /图形.*复制/,
    ],
  },
  {
    type: "paste_shape",
    patterns: [
      /粘贴.*图形/,
      /图形.*粘贴/,
    ],
  },

  // ---- F028: 翻转图形 ----
  {
    type: "flip_shape",
    patterns: [
      /(?:水平|左右).*翻[转]/,
      /翻[转].*(?:水平|左右)/,
      /图形.*(?:水平|左右).*翻/,
      /(?:水平|左右).*翻.*图形/,
    ],
    extractParams: () => ({ direction: "horizontal" }),
  },
  {
    type: "flip_shape",
    patterns: [
      /(?:垂直|上下).*翻[转]/,
      /翻[转].*(?:垂直|上下)/,
      /图形.*(?:垂直|上下).*翻/,
      /(?:垂直|上下).*翻.*图形/,
    ],
    extractParams: () => ({ direction: "vertical" }),
  },
];

// ========== F010: 画笔颜色映射 ==========
const COLOR_MAP: Record<string, { name: string; hex: string }> = {
  "红": { name: "红色", hex: "#FF0000" },
  "红色": { name: "红色", hex: "#FF0000" },
  "橙": { name: "橙色", hex: "#FF8800" },
  "橙色": { name: "橙色", hex: "#FF8800" },
  "橘": { name: "橙色", hex: "#FF8800" },
  "橘色": { name: "橙色", hex: "#FF8800" },
  "黄": { name: "黄色", hex: "#FFDD00" },
  "黄色": { name: "黄色", hex: "#FFDD00" },
  "绿": { name: "绿色", hex: "#00CC00" },
  "绿色": { name: "绿色", hex: "#00CC00" },
  "蓝": { name: "蓝色", hex: "#0066FF" },
  "蓝色": { name: "蓝色", hex: "#0066FF" },
  "紫": { name: "紫色", hex: "#8800CC" },
  "紫色": { name: "紫色", hex: "#8800CC" },
  "黑": { name: "黑色", hex: "#000000" },
  "黑色": { name: "黑色", hex: "#000000" },
  "白": { name: "白色", hex: "#FFFFFF" },
  "白色": { name: "白色", hex: "#FFFFFF" },
};

function extractColor(text: string): { name: string; hex: string } | null {
  // 按 key 长度降序排列，优先匹配更长的 key（如"橙色"优先于"橙"）
  const keys = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (text.includes(key)) return COLOR_MAP[key];
  }
  return null;
}

// ========== F006~F009: 绘图规则 ==========
const drawRules: Rule[] = [
  // ---- F006: 绘制直线 ----
  {
    type: "draw_line",
    patterns: [
      /画.*直?线/, /绘.*直?线/, /画.*一[条根串].*线/,
      /添加.*直?线/, /加.*直?线/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const size = extractSize(text);
      const length = extractNumeric(text, ["长度", "长"]);
      return { position: pos, size, length };
    },
  },
  // ---- F007: 绘制圆形 ----
  {
    type: "draw_circle",
    patterns: [
      /画.*(?:椭?圆|正圆)/, /绘.*(?:椭?圆|正圆)/,
      /画.*一[个].*(?:圆|圈)/, /添加.*(?:圆|圈)/,
      /加.*(?:圆|圈)/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const sizeKey = extractSize(text);
      const radius = extractNumeric(text, ["半径"]);
      const isEllipse = text.includes("椭");
      return {
        position: pos,
        size: sizeKey,
        radius,
        isEllipse,
      };
    },
  },
  // ---- F008: 绘制矩形 ----
  {
    type: "draw_rectangle",
    patterns: [
      /画.*(?:矩形|长方形|正方形|方框|方块)/, /绘.*(?:矩形|长方形|正方形|方框|方块)/,
      /画.*一[个].*(?:矩形|长方形|正方形|方框)/,
      /添加.*(?:矩形|长方形|正方形|方框)/, /加.*(?:矩形|长方形|正方形|方框)/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const sizeKey = extractSize(text);
      const width = extractNumeric(text, ["宽度", "宽"]);
      const height = extractNumeric(text, ["高度", "高"]);
      const isSquare = text.includes("正方") || text.includes("方框") || text.includes("方块");
      return {
        position: pos,
        size: sizeKey,
        width,
        height,
        isSquare,
      };
    },
  },
  // ---- F009: 绘制三角形 ----
  {
    type: "draw_triangle",
    patterns: [
      /画.*三角[形]?/, /绘.*三角[形]?/,
      /画.*一[个].*三角[形]?/,
      /添加.*三角[形]?/, /加.*三角[形]?/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const sizeKey = extractSize(text);
      const side = extractNumeric(text, ["边长"]);
      const isEquilateral = text.includes("等边") || text.includes("正三角");
      return {
        position: pos,
        size: sizeKey,
        side,
        isEquilateral,
      };
    },
  },
  // ---- F010: 画笔颜色 ----
  {
    type: "brush_color",
    patterns: [
      /画笔.*(?:换|改|变|设|选|用).*/,
      /(?:换|改|变|设|选|用).*颜色/,
      /颜色.*(?:换|改|变|设|选)/,
      /画笔.*颜色/,
    ],
    extractParams: (_match, text) => {
      const color = extractColor(text);
      return color ? { color: color.hex, colorName: color.name } : {};
    },
  },
  {
    type: "brush_color",
    patterns: [
      /(?:红|橙|黄|绿|蓝|紫|黑|白)色.*画/,
      /(?:红|橙|黄|绿|蓝|紫|黑|白)色.*笔/,
      /画.*(?:红|橙|黄|绿|蓝|紫|黑|白)色/,
      /用(?:红|橙|黄|绿|蓝|紫|黑|白)色/,
      /改成(?:红|橙|黄|绿|蓝|紫|黑|白)/,
    ],
    extractParams: (_match, text) => {
      const color = extractColor(text);
      return color ? { color: color.hex, colorName: color.name } : {};
    },
  },
  // ---- F011: 画笔粗细 ----
  {
    type: "brush_width",
    patterns: [
      /粗细.*(\d+)/,
      /画笔.*粗细.*(\d+)/,
      /线条.*粗细.*(\d+)/,
      /粗细.*改为?.*(\d+)/,
    ],
    extractParams: (match, _text) => {
      const value = parseInt(match[1], 10);
      return { mode: "absolute", value: Math.min(20, Math.max(1, value)) };
    },
  },
  {
    type: "brush_width",
    patterns: [
      /粗一[点些]/,
      /加粗/,
      /变粗/,
      /更粗/,
      /粗线/,
    ],
    extractParams: () => ({ mode: "relative", delta: 2 }),
  },
  {
    type: "brush_width",
    patterns: [
      /细一[点些]/,
      /变细/,
      /更细/,
      /细线/,
    ],
    extractParams: () => ({ mode: "relative", delta: -2 }),
  },
  {
    type: "brush_width",
    patterns: [
      /最粗/,
    ],
    extractParams: () => ({ mode: "preset", value: 20, label: "最粗" }),
  },
  {
    type: "brush_width",
    patterns: [
      /很粗/,
      /非常粗/,
    ],
    extractParams: () => ({ mode: "preset", value: 12, label: "很粗" }),
  },
  {
    type: "brush_width",
    patterns: [
      /很细/,
      /非常细/,
    ],
    extractParams: () => ({ mode: "preset", value: 1, label: "很细" }),
  },
  {
    type: "brush_width",
    patterns: [
      /粗/,
      /加宽/,
      /宽/,
    ],
    extractParams: () => ({ mode: "preset", value: 8, label: "粗" }),
  },
  {
    type: "brush_width",
    patterns: [
      /细/,
      /窄/,
    ],
    extractParams: () => ({ mode: "preset", value: 2, label: "细" }),
  },
  {
    type: "brush_width",
    patterns: [
      /中等/,
      /普通/,
    ],
    extractParams: () => ({ mode: "preset", value: 4, label: "中等" }),
  },
  // ---- F012: 填充与描边 ----
  {
    type: "fill_mode",
    patterns: [
      /填充.*(?:红|橙|黄|绿|蓝|紫|黑|白)/,
      /填充颜[色料]/,
      /用.*填充/,
      /填充.*颜色/,
    ],
    extractParams: (_match, text) => {
      const color = extractColor(text);
      return color
        ? { mode: "fill_color", color: color.hex, colorName: color.name }
        : { mode: "fill_color", color: null };
    },
  },
  {
    type: "fill_mode",
    patterns: [
      /只.*(?:显示|画|留|要).*轮廓/,
      /轮廓模[式色]/,
      /(?:不要|取消|去掉|关闭).*填充/,
      /不.*填充/,
      /空心/,
    ],
    extractParams: () => ({ mode: "outline" }),
  },
  {
    type: "fill_mode",
    patterns: [
      /(?:恢复|开启|打开).*填充/,
      /填充.*(?:恢复|开启|打开)/,
      /需要填充/,
    ],
    extractParams: () => ({ mode: "default" }),
  },
  // ---- F019: 绘制五角星 ----
  {
    type: "draw_star",
    patterns: [
      /画.*(?:五角星|星星|星形)/, /绘.*(?:五角星|星星|星形)/,
      /画.*一[个].*(?:五角星|星星|星形)/,
      /添加.*(?:五角星|星星|星形)/, /加.*(?:五角星|星星|星形)/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const sizeKey = extractSize(text);
      const radius = extractNumeric(text, ["半径", "大小"]);
      return { position: pos, size: sizeKey, radius };
    },
  },
  // ---- F020: 绘制多边形 ----
  {
    type: "draw_polygon",
    patterns: [
      /画.*(?:正?多边[形]?|正?[三五六七八九十]边[形]?)/,
      /绘.*(?:正?多边[形]?|正?[三五六七八九十]边[形]?)/,
      /画.*一[个].*(?:多边[形]?|正?[三五六七八九十]边[形]?)/,
      /添加.*(?:多边[形]?|正?[三五六七八九十]边[形]?)/,
    ],
    extractParams: (_match, text) => {
      const pos = extractPosition(text);
      const sizeKey = extractSize(text);
      const radius = extractNumeric(text, ["半径", "大小"]);
      const sides = extractSides(text);
      return { position: pos, size: sizeKey, radius, sides };
    },
  },
  // ---- F022: 虚线/点划线 ----
  {
    type: "line_style",
    patterns: [
      /虚线/,
      /画虚/,
    ],
    extractParams: () => ({ mode: "dashed" }),
  },
  {
    type: "line_style",
    patterns: [
      /点划/,
      /点[虚断]/,
      /点线/,
    ],
    extractParams: () => ({ mode: "dotted" }),
  },
  {
    type: "line_style",
    patterns: [
      /实线/,
      /恢复.*实线/,
      /取消.*虚线/,
      /取消.*点划/,
      /取消.*点线/,
      /^直线$/,
      /直线模式/,
    ],
    extractParams: () => ({ mode: "solid" }),
  },
];

// ========== 意图预过滤器 ==========
// 快速判断文本是否包含绘图意图，无意图直接丢弃，避免无效 LLM 调用

// 从 JSON 规范提取所有动作动词 + 别名
const DRAWING_VERBS = new Set<string>();
for (const verb of spec.actionVerbs) {
  DRAWING_VERBS.add(verb.keyword);
  for (const alias of verb.aliases) {
    DRAWING_VERBS.add(alias);
  }
}

// 额外添加一些明确的绘图相关触发词
const DRAWING_TRIGGERS = new Set([
  ...DRAWING_VERBS,
  "圆", "矩形", "三角形", "五角星", "多边形", "直线",
  "颜色", "红色", "蓝色", "绿色", "画笔", "画布",
  "填充", "轮廓", "虚线", "实线", "撤销", "保存",
]);

/**
 * 判断文本是否包含绘图意图
 * 策略：包含任一触发词 → 可能是绘图指令
 * 准确率 ~85-90%，边界 case 由 LLM 兜底
 */

// ========== 形状关键词分组（歧义检测用） ==========


// ========== 复杂参数检测 ==========
// 正则解析器无法处理的场景：中文数字、复合量词、复杂空间描述
const CN_NUMBERS = /[零一二两三四五六七八九十百千万亿]/;
const CN_UNITS = /[个条根道片块只张把根]/;
const COMPLEX_DIRECTIONS = /[东南西北].*[东南西北]|斜|偏|往|朝|向/;

/**
 * 检测文本是否包含正则解析器无法充分处理的复杂参数
 * 例如："两百像素"（中文数字）、"粗细适中"（模糊描述）
 */
function hasComplexParams(text: string): boolean {
  // 所有形状关键词（用于排除"五角星""六边形"等形状名）
  const allShapeKWs = Object.values(SHAPE_KEYWORD_GROUPS).flat();
  
  // 中文数字 + 非形状名、非冠词 → 参数复杂度高
  if (CN_NUMBERS.test(text)) {
    const numMatch = text.match(/[零一二两三四五六七八九十百千万亿]+/g);
    if (numMatch) {
      for (const m of numMatch) {
        // 排除"一个"中的"一"（冠词，非参数）
        if (m === "一" && /一个/.test(text)) continue;
        // 排除形状名中的数字（五角星、六边形等）
        if (allShapeKWs.some(kw => kw.includes(m))) continue;
        // 确实是参数数字 → 复杂
        return true;
      }
    }
  }
  // 复合方向描述（如"左上方偏右"）
  if (COMPLEX_DIRECTIONS.test(text)) return true;
  // 模糊量词（如"稍微大一点"、"差不多"）
  if (/稍微|差不多|大概|左右|上下|适中|中等偏/.test(text)) return true;
  return false;
}

const SHAPE_KEYWORD_GROUPS: Record<string, string[]> = {
  draw_circle: ["圆", "圆形", "圆圈", "椭圆"],
  draw_rectangle: ["矩形", "长方形", "方块", "方框", "正方形"],
  draw_triangle: ["三角形", "三角"],
  draw_star: ["五角星", "星星", "星形"],
  draw_polygon: ["多边形", "六边形", "五边形", "八边形", "七边形"],
  draw_line: ["直线", "线段", "线条"],
};

/**
 * 检测形状歧义：文本是否同时匹配多种形状类型的特征词
 * 如 "圆角矩形" 同时含 "圆"(circle) 和 "矩形"(rectangle)
 * 返回 true 表示存在歧义，应交给 LLM 解析
 */
function hasShapeAmbiguity(text: string, matchedType: string): boolean {
  // 复杂参数：正则无法充分解析 → 交给 LLM
  if (hasComplexParams(text)) return true;
  const matchedKeywords = SHAPE_KEYWORD_GROUPS[matchedType];
  if (!matchedKeywords) return false;

  for (const [type, keywords] of Object.entries(SHAPE_KEYWORD_GROUPS)) {
    if (type === matchedType) continue;
    // 检查文本是否包含其他形状的关键词
    for (const kw of keywords) {
      if (text.includes(kw)) {
        // 但如果文本中的关键词是 matchedType 的超集则不歧义
        // 例: "矩形" 匹配 draw_rectangle 且包含 "矩形" → 正常
        const isMatchedKeyword = matchedKeywords.some(mk => text.includes(mk) && mk === kw);
        if (!isMatchedKeyword) {
          return true; // 歧义！
        }
      }
    }
  }
  return false;
}


export function hasDrawingIntent(text: string): boolean {
  for (const trigger of DRAWING_TRIGGERS) {
    if (text.includes(trigger)) return true;
  }
  return false;
}
// ========== 解析入口 ==========

export function parseCommand(text: string): Command {
  // 意图预过滤：无绘图意图直接返回 unrecognized
  if (!hasDrawingIntent(text)) {
    return { type: "unrecognized", params: {}, raw: text };
  }

  const cleaned = text.replace(/[，。！？,!? ]/g, "");

  // 先匹配绘图指令
  for (const rule of drawRules) {
    for (const pattern of rule.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const params = rule.extractParams ? rule.extractParams(match, text) : {};
        // 歧义检测：文本匹配多种形状特征词时交给 LLM
        if (hasShapeAmbiguity(text, rule.type)) {
          return { type: "unrecognized", params: {}, raw: text };
        }
        return { type: rule.type, params, raw: text };
      }
    }
  }

  // 再匹配其他指令
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const params = rule.extractParams ? rule.extractParams(match, cleaned) : {};
        // 歧义检测：文本匹配多种形状特征词时交给 LLM
        if (hasShapeAmbiguity(text, rule.type)) {
          return { type: "unrecognized", params: {}, raw: text };
        }
        return {
          type: rule.type,
          params,
          raw: text,
        };
      }
    }
  }

  return { type: "unrecognized", params: {}, raw: text };
}