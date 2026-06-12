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
];

// ========== 解析入口 ==========

export function parseCommand(text: string): Command {
  const cleaned = text.replace(/[，。！？,!? ]/g, "");

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
