// 语音合成服务 — 封装 SpeechSynthesis API
class TTSService {
  private queue: string[] = [];
  private speaking = false;

  /** 播报文本，自动排队避免重叠 */
  speak(text: string): void {
    if (!window.speechSynthesis) {
      console.warn("[TTS] 浏览器不支持语音合成");
      return;
    }
    this.queue.push(text);
    if (!this.speaking) {
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.speaking = false;
      return;
    }
    this.speaking = true;
    const text = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => this.playNext();
    utterance.onerror = () => this.playNext();

    window.speechSynthesis.speak(utterance);
  }

  /** 立即播报（清空队列） */
  speakImmediate(text: string): void {
    window.speechSynthesis?.cancel();
    this.queue = [];
    this.speaking = false;
    this.speak(text);
  }

  /** 停止所有语音 */
  stop(): void {
    window.speechSynthesis?.cancel();
    this.queue = [];
    this.speaking = false;
  }
}

export const ttsService = new TTSService();
