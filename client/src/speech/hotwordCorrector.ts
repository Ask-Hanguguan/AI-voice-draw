// 热词后识别纠错器 — 仅精确映射，移除激进的单字差异匹配
import hotwords from "@shared/hotwords.json";

interface HotwordCategory {
  words: string[];
  fuzzyFixes: Record<string, string>;
}

interface HotwordsConfig {
  version?: string;
  description?: string;
  [category: string]: HotwordCategory | string | undefined;
}

const config = hotwords as HotwordsConfig;

function isCategory(v: unknown): v is HotwordCategory {
  return typeof v === "object" && v !== null && "fuzzyFixes" in v;
}

/**
 * 对 ASR 识别文本进行热词纠错
 * 策略：仅使用精确的已知错误映射，不再使用单字差异模糊匹配
 */
export function correctHotwords(text: string): string {
  let corrected = text;

  for (const category of Object.values(config).filter(isCategory)) {
    for (const [wrong, correct] of Object.entries(category.fuzzyFixes)) {
      if (corrected.includes(wrong)) {
        corrected = corrected.replace(new RegExp(wrong, "g"), correct);
      }
    }
  }

  return corrected;
}

/**
 * 导出热词列表（可用于 Web Speech API 的提示）
 */
export function getHotwordList(): string[] {
  const all: string[] = [];
  for (const category of Object.values(config).filter(isCategory)) {
    if (category.words) all.push(...category.words);
  }
  return [...new Set(all)];
}