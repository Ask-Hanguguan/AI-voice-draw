// 语音识别服务 — 封装 Web Speech API，支持持续监听 + 热词纠错
import { correctHotwords } from "./hotwordCorrector.ts";

type SpeechCallback = (text: string, isFinal: boolean) => void;

class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private onResult: SpeechCallback | null = null;
  private lang = "zh-CN";

  /** 初始化识别器 */
  private create(): SpeechRecognition {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      throw new Error("浏览器不支持语音识别");
    }
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 3;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // 汇总所有候选取最佳
        let best = "";
        let maxConf = 0;
        for (let j = 0; j < result.length; j++) {
          if (result[j].confidence > maxConf) {
            maxConf = result[j].confidence;
            best = result[j].transcript.trim();
          }
        }
        if (best && this.onResult) {
          // 热词纠错：修正 ASR 常见识别错误
          best = correctHotwords(best);
          this.onResult(best, result.isFinal);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' 和 'aborted' 是正常情况，静默处理
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("[Speech] 识别错误:", event.error);
    };

    rec.onend = () => {
      // 如果还在监听状态就自动重启
      if (this.isListening) {
        this.restartTimer = setTimeout(() => {
          try {
            this.recognition?.start();
          } catch {
            // 可能已启动，忽略
          }
        }, 200);
      }
    };

    return rec;
  }

  /** 开始持续监听 */
  start(callback: SpeechCallback): void {
    this.onResult = callback;
    this.isListening = true;
    try {
      this.recognition = this.create();
      this.recognition.start();
    } catch (err) {
      console.error("[Speech] 启动失败:", err);
    }
  }

  /** 停止监听 */
  stop(): void {
    this.isListening = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
  }
}

export const speechService = new SpeechService();
