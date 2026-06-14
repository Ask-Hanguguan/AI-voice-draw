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
  | "unrecognized";

export interface Command {
  type: CommandType;
  params: Record<string, unknown>;
  raw: string;
}

// ========== 画布尺寸配置 ==========
const CANVAS_SIZES: Record<string, { width: number; height: number }> = {
  default: { width: 800, height: 600 },
  a4: { width: 794, height: 1123 },
  square: { width: 800, height: 800 },
};

// ========== F006~F009: 位置映射 ==========
const POSITION_AREAS: Record<string, { x: number; y: number }> = {
  "左上角": { x: 0.2, y: 0.2 },
  "右上角": { x: 0.8, y: 0.2 },
  "左下角": { x: 0.2, y: 0.8 },
  "右下角": { x: 0.8, y: 0.8 },
  "中间": { x: 0.5, y: 0.5 },
  "中心": { x: 0.5, y: 0.5 },
  "上方": { x: 0.5, y: 0.15 },
  "上面": { x: 0.5, y: 0.15 },
  "下方": { x: 0.5, y: 0.85 },
  "下面": { x: 0.5, y: 0.85 },
  "左方": { x: 0.15, y: 0.5 },
  "左边": { x: 0.15, y: 0.5 },
  "左面": { x: 0.15, y: 0.5 },
  "右方": { x: 0.85, y: 0.5 },
  "右边": { x: 0.85, y: 0.5 },
  "右面": { x: 0.85, y: 0.5 },
};

// 大小映射 (半径)
const SIZE_MAP: Record<string, number> = {
  "大": 100,
  "大的": 100,
  "中": 50,
  "中等": 50,
  "小": 25,
  "小的": 25,
};

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

  // ---- F018: 画布平移 ----
  {
    type: "canvas_pan",
    patterns: [
      /(?:向上|往上).*平?移/,
      /上移/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["平移"]) || extractNumeric(text, ["移"]);
      return { direction: "up", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /(?:向下|往下).*平?移/,
      /下移/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["平移"]) || extractNumeric(text, ["移"]);
      return { direction: "down", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /(?:向左|往左).*平?移/,
      /左移/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["平移"]) || extractNumeric(text, ["移"]);
      return { direction: "left", amount: amount || 100 };
    },
  },
  {
    type: "canvas_pan",
    patterns: [
      /(?:向右|往右).*平?移/,
      /右移/,
    ],
    extractParams: (_match, text) => {
      const amount = extractNumeric(text, ["平移"]) || extractNumeric(text, ["移"]);
      return { direction: "right", amount: amount || 100 };
    },
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
    ],
    extractParams: () => ({ mode: "solid" }),
  },
];

// ========== 解析入口 ==========

export function parseCommand(text: string): Command {
  const cleaned = text.replace(/[，。！？,!? ]/g, "");

  // 先匹配绘图指令
  for (const rule of drawRules) {
    for (const pattern of rule.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const params = rule.extractParams ? rule.extractParams(match, text) : {};
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