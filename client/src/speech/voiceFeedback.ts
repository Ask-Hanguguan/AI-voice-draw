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
  private listeners: Array<(entry: FeedbackEntry) => void> = [];

  private emit(entry: FeedbackEntry): void {
    const store = useAppStore.getState();
    store.setFeedback(entry.type, entry.message);
    for (const fn of this.listeners) fn(entry);
  }

  onFeedback(fn: (entry: FeedbackEntry) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  // ==================== 语义化反馈 ====================

  success(what: string): void {
    const msg = `已${what}`;
    this.emit({ type: "success", message: msg });
    ttsService.speak(msg);
  }

  error(reason: string, guidance?: string): void {
    const msg = guidance ? `${reason}，${guidance}` : reason;
    this.emit({ type: "error", message: msg });
    ttsService.speakImmediate(msg);
  }

  confirm(question: string): void {
    this.emit({ type: "confirm", message: question });
    ttsService.speakImmediate(question);
  }

  guidance(hint: string): void {
    this.emit({ type: "guidance", message: hint });
    ttsService.speak(hint);
  }

  info(message: string): void {
    this.emit({ type: "info", message });
    ttsService.speak(message);
  }

  // ==================== 预设反馈 ====================

  wake(): void {
    this.emit({ type: "info", message: "我在，请说" });
    ttsService.speakImmediate("我在，请说");
  }

  sleep(): void {
    this.emit({ type: "info", message: "已休眠，说小笔小笔唤醒我" });
    ttsService.speak("已休眠，说小笔小笔唤醒我");
  }

  undo(): void { this.success("撤销"); }
  redo(): void { this.success("恢复"); }
  unrecognized(): void { this.guidance("无法识别指令，请再说一遍"); }
  nothingToUndo(): void { this.guidance("没有可以撤销的操作"); }
  nothingToRedo(): void { this.guidance("没有可以恢复的操作"); }
  speechUnavailable(): void { this.error("语音识别不可用", "请使用 Chrome 浏览器并允许麦克风权限"); }

  // F005: 缩放反馈
  zoomIn(pct: number): void {
    this.success(`放大到 ${pct}%`);
  }
  zoomOut(pct: number): void {
    this.success(`缩小到 ${pct}%`);
  }
  zoomReset(): void {
    this.success("恢复原始大小");
  }
  zoomFit(pct: number): void {
    this.success(`适应屏幕，${pct}%`);
  }

  // F006~F009: 绘图反馈
  needCanvas(): void {
    this.guidance("请先新建画布");
  }
  drawLine(): void {
    this.success("绘制直线");
  }
  drawCircle(): void {
    this.success("绘制圆形");
  }
  drawRectangle(): void {
    this.success("绘制矩形");
  }
  drawTriangle(): void {
    this.success("绘制三角形");
  }

  // F010: 画笔颜色
  brushColor(colorName: string): void {
    this.success(`画笔已换成${colorName}`);
  }

  stop(): void { ttsService.stop(); }
}

export const voiceFeedback = new VoiceFeedbackService();