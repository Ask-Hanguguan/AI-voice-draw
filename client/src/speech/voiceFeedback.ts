// 语音状态反馈服务 — F002
// 所有操作的语音提示统一出口，按语义分类：成功、失败、确认、引导、信息

import { ttsService } from "./tts";
import { useAppStore } from "../stores/appStore";

export type FeedbackType = "success" | "error" | "confirm" | "guidance" | "info";

export interface FeedbackEntry {
  type: FeedbackType;
  message: string;
}

class VoiceFeedbackService {
  /** 反馈回调：外部可监听用于 UI 更新 */
  private listeners: Array<(entry: FeedbackEntry) => void> = [];

  private emit(entry: FeedbackEntry): void {
    // 更新 Zustand store
    const store = useAppStore.getState();
    store.setFeedback(entry.type, entry.message);
    // 通知监听器
    for (const fn of this.listeners) fn(entry);
  }

  /** 注册反馈监听器 */
  onFeedback(fn: (entry: FeedbackEntry) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  // ==================== 语义化反馈方法 ====================

  /** 操作成功 */
  success(what: string): void {
    const msg = `已${what}`;
    this.emit({ type: "success", message: msg });
    ttsService.speak(msg);
  }

  /** 操作失败（原因 + 引导建议） */
  error(reason: string, guidance?: string): void {
    const msg = guidance ? `${reason}，${guidance}` : reason;
    this.emit({ type: "error", message: msg });
    ttsService.speakImmediate(msg);
  }

  /** 需要确认的问题 */
  confirm(question: string): void {
    this.emit({ type: "confirm", message: question });
    ttsService.speakImmediate(question);
  }

  /** 错误引导（如指令无法识别时） */
  guidance(hint: string): void {
    this.emit({ type: "guidance", message: hint });
    ttsService.speak(hint);
  }

  /** 通用信息播报 */
  info(message: string): void {
    this.emit({ type: "info", message });
    ttsService.speak(message);
  }

  // ==================== 预设常用反馈 ====================

  /** 唤醒确认 */
  wake(): void {
    const msg = "我在，请说";
    this.emit({ type: "info", message: msg });
    ttsService.speakImmediate(msg);
  }

  /** 进入休眠 */
  sleep(): void {
    const msg = "已休眠，说小笔小笔唤醒我";
    this.emit({ type: "info", message: msg });
    ttsService.speak(msg);
  }

  /** 撤销操作 */
  undo(): void {
    this.success("撤销");
  }

  /** 恢复操作 */
  redo(): void {
    this.success("恢复");
  }

  /** 无法识别的指令 */
  unrecognized(): void {
    this.guidance("无法识别指令，请再说一遍");
  }

  /** 无操作可撤销 */
  nothingToUndo(): void {
    this.guidance("没有可以撤销的操作");
  }

  /** 无操作可恢复 */
  nothingToRedo(): void {
    this.guidance("没有可以恢复的操作");
  }

  /** 语音识别不可用 */
  speechUnavailable(): void {
    this.error("语音识别不可用", "请使用 Chrome 浏览器并允许麦克风权限");
  }

  /** 停止所有语音 */
  stop(): void {
    ttsService.stop();
  }
}

export const voiceFeedback = new VoiceFeedbackService();
