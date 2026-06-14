// 热词后识别纠错器 — 仅精确映射，移除激进的单字差异匹配
import hotwords from "@shared/hotwords.json";

interface HotwordCategory {
  words: string[];
  fuzzyFixes: Record<string, string>;
}

type HotwordsConfig = Record<string, HotwordCategory>;

const config = hotwords as HotwordsConfig;

/**
 * 对 ASR 识别文本进行热词纠错
 * 策略：仅使用精确的已知错误映射，不再使用单字差异模糊匹配
 */
export function correctHotwords(text: string): string {
  let corrected = text;

  // 仅精确模糊修正（已知常见错误映射）
  for (const category of Object.values(config)) {
    if (!category.fuzzyFixes) continue;
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
  for (const category of Object.values(config)) {
    if (category.words) all.push(...category.words);
  }
  return [...new Set(all)];
}
