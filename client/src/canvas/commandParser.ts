// 指令解析器 — Phase 1 正则匹配
// 将语音识别文本转换为结构化绘图指令

export type CommandType =
  | "new_canvas"
  | "clear_canvas"
  | "undo"
  | "redo"
  | "exit"
  | "unrecognized";

export interface Command {
  type: CommandType;
  params: Record<string, unknown>;
  raw: string;
}

// ========== 画布尺寸配置 ==========
const CANVAS_SIZES: Record<string, { width: number; height: number }> = {
  default: { width: 800, height: 600 },
  a4: { width: 794, height: 1123 },      // A4 ≈ 794×1123 (72dpi)
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
    patterns: [
      /^(退出|休眠|睡觉|休息)$/,
    ],
  },

  // ---- 新建画布 ----
  {
    type: "new_canvas",
    patterns: [
      /新建.*A4.*画/,
      /A4.*画[布板]/,
      /新建.*A4/,
    ],
    extractParams: () => ({ ...CANVAS_SIZES.a4 }),
  },
  {
    type: "new_canvas",
    patterns: [
      /新建.*正方.*画/,
      /正方.*画[布板]/,
      /正方形.*画[布板]/,
    ],
    extractParams: () => ({ ...CANVAS_SIZES.square }),
  },
  {
    type: "new_canvas",
    patterns: [
      /新建.*画[布板面]/,
      /创建.*画[布板面]/,
      /开一.*新.*[图画面]/,
      /打开.*画[布板面]/,
      /新.*画[布板面]/,
      /建.*画[布板面]/,
      /新建/,
    ],
    extractParams: () => ({ ...CANVAS_SIZES.default }),
  },

  // ---- 清空画布 ----
  {
    type: "clear_canvas",
    patterns: [
      /清空.*画[布板面]/,
      /擦掉.*/,
      /清除.*画[布板面]/,
    ],
  },

  // ---- 撤销 ----
  {
    type: "undo",
    patterns: [
      /撤销/,
      /撤[消退]/,
      /回[退撤]/,
      /上一步/,
      /还[原回]/,
    ],
  },

  // ---- 恢复 ----
  {
    type: "redo",
    patterns: [
      /恢复/,
      /重[做建]/,
      /下一步/,
      /前[进移]/,
      /还[原回]撤/,
    ],
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
