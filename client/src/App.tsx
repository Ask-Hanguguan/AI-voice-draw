import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "./stores/appStore";
import { voiceFeedback } from "./speech/voiceFeedback";
import StatusBar from "./components/StatusBar";

export default function App() {
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);
  const setSpeechReady = useAppStore((s) => s.setSpeechReady);
  const setLastRecognizedText = useAppStore((s) => s.setLastRecognizedText);
  const lastFeedbackType = useAppStore((s) => s.lastFeedbackType);
  const lastFeedbackMessage = useAppStore((s) => s.lastFeedbackMessage);

  const [logs, setLogs] = useState<string[]>([]);
  const [lastText, setLastText] = useState("");
  const listeningRef = useRef(false);
  const statusRef = useRef(status);
  const restartCountRef = useRef(0);

  // 始终同步最新 status 到 ref
  statusRef.current = status;

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[Voice] ${msg}`);
    setLogs((prev) => [...prev.slice(-19), `${time} ${msg}`]);
  }, []);

  /** 宽松匹配唤醒词：处理 ASR 同音字/漏字问题 */
  function matchWakeWord(text: string): boolean {
    const cleaned = text.replace(/[\s，。！？,!?、"]/g, "");
    // 精确匹配
    if (cleaned.includes("小笔小笔")) return true;
    // 常见 ASR 同音/形近错误
    const fuzzyPatterns = [
      /小[笔比毕必壁逼鼻彼].*小[笔比毕必壁逼鼻彼]/,
      /小[笔比毕必壁逼鼻彼]{2}/,
      /[晓小].*[笔比毕].*[晓小].*[笔比毕]/,
      /小笔/,
    ];
    for (const pattern of fuzzyPatterns) {
      if (pattern.test(cleaned)) {
        addLog(`模糊匹配唤醒词: "${cleaned}" -> ${pattern}`);
        return true;
      }
    }
    return false;
  }

  /** 单次识别 */
  const startOnce = useCallback(() => {
    if (!listeningRef.current) return;

    const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!API) {
      addLog("语音识别不可用");
      voiceFeedback.speechUnavailable();
      return;
    }

    const rec = new API();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "zh-CN";

    rec.onstart = () => {
      restartCountRef.current = 0;
    };

    rec.onresult = (event: any) => {
      let text = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) isFinal = true;
      }
      if (!text) return;

      setLastText(text);
      setLastRecognizedText(text);

      if (isFinal) {
        addLog(`识别: "${text}"`);
      }

      if (isFinal) {
        const currentStatus = statusRef.current;

        if (currentStatus === "sleeping" && matchWakeWord(text)) {
          addLog("唤醒！");
          setStatus("active");
          voiceFeedback.wake();
        }
        if (currentStatus === "active") {
          const cleaned = text.replace(/[，。！？,!? ]/g, "");
          if (["退出", "休眠", "睡觉", "休息"].includes(cleaned)) {
            addLog("休眠");
            setStatus("sleeping");
            setLastText("");
            setLastRecognizedText("");
            voiceFeedback.sleep();
          }
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      const errMsg = `识别错误: ${event.error}`;
      addLog(errMsg);
      if (event.error === "not-allowed") {
        voiceFeedback.error("麦克风权限被拒绝", "请在浏览器设置中允许麦克风访问");
      } else if (event.error === "network") {
        voiceFeedback.error("语音识别网络错误", "请检查网络连接后刷新页面");
      }
    };

    rec.onend = () => {
      if (listeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 50) {
          addLog("重试超限，已停止。请刷新。");
          voiceFeedback.error("语音服务异常", "请刷新页面后重试");
          listeningRef.current = false;
          return;
        }
        setTimeout(() => {
          if (listeningRef.current) startOnce();
        }, 300);
      }
    };

    try {
      rec.start();
    } catch (e: any) {
      addLog(`启动失败: ${e.message}`);
      setTimeout(() => {
        if (listeningRef.current) startOnce();
      }, 1000);
    }
  }, [addLog, setLastRecognizedText, setStatus]);

  const handleStart = useCallback(() => {
    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
      addLog("请使用 Chrome 浏览器");
      voiceFeedback.speechUnavailable();
      return;
    }
    addLog("请求麦克风...");
    setSpeechReady(true);
    listeningRef.current = true;
    startOnce();
    if (status === "idle") {
      setStatus("sleeping");
    }
  }, [addLog, startOnce, setSpeechReady, setStatus, status]);

  useEffect(() => {
    // 什么都不做，等用户点击
  }, []);

  return (
    <div className="w-full h-full bg-gray-950 text-white flex flex-col select-none">
      {/* F002: 顶部状态栏 — 显示识别文本 + 语音反馈 */}
      {status !== "idle" && <StatusBar />}

      <div
        className="flex-1 flex flex-col items-center justify-center cursor-pointer"
        onClick={status === "idle" ? handleStart : undefined}
      >
        {status === "idle" && (
          <>
            <p className="text-6xl mb-4">🎤</p>
            <p className="text-2xl font-bold mb-2">点击任意位置启用语音</p>
            <p className="text-gray-500">请使用 Chrome 浏览器，允许麦克风权限</p>
          </>
        )}
        {status === "sleeping" && (
          <>
            <div className="w-24 h-24 rounded-full bg-blue-500/20 animate-ping mb-4" />
            <p className="text-xl">说"小笔小笔"唤醒</p>
            {lastText && (
              <p className="text-blue-300 mt-2 text-lg animate-pulse">"{lastText}"</p>
            )}
          </>
        )}
        {status === "active" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400">语音已激活</span>
            </div>
            <p className="text-xl">画布就绪</p>
            {lastText && (
              <p className="text-gray-300 mt-2 text-lg">"{lastText}"</p>
            )}
            <p className="text-gray-600 text-sm mt-4">说"退出"休眠</p>
          </>
        )}
      </div>

      {/* 语音反馈指示器 — F002 */}
      {lastFeedbackMessage && (
        <div
          className={`mx-auto mb-1 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${
            lastFeedbackType === "success"
              ? "bg-green-500/20 text-green-300"
              : lastFeedbackType === "error"
                ? "bg-red-500/20 text-red-300"
                : lastFeedbackType === "confirm"
                  ? "bg-yellow-500/20 text-yellow-300"
                  : lastFeedbackType === "guidance"
                    ? "bg-orange-500/20 text-orange-300"
                    : "bg-blue-500/20 text-blue-300"
          }`}
        >
          <span className="text-base">
            {lastFeedbackType === "success"
              ? "✅"
              : lastFeedbackType === "error"
                ? "❌"
                : lastFeedbackType === "confirm"
                  ? "❓"
                  : lastFeedbackType === "guidance"
                    ? "💡"
                    : "🔊"}
          </span>
          <span>{lastFeedbackMessage}</span>
        </div>
      )}

      {/* 日志面板 */}
      <div className="h-48 border-t border-gray-800 bg-gray-900/80 font-mono text-xs p-3 overflow-y-auto">
        <p className="text-gray-500 mb-1">
          日志
          {listeningRef.current && <span className="text-green-500 ml-1">● 监听中</span>}
          {status === "active" && <span className="text-yellow-400 ml-1">⚡ 已唤醒</span>}
        </p>
        {logs.length === 0 && <p className="text-gray-600">点击页面开始...</p>}
        {logs.map((log, i) => (
          <p
            key={i}
            className={`py-0.5 ${
              log.includes("❌") || log.includes("不可用")
                ? "text-red-400"
                : log.includes("唤醒")
                  ? "text-yellow-300 font-bold text-base"
                  : log.includes("模糊")
                    ? "text-purple-400"
                    : log.includes("休眠")
                      ? "text-blue-300"
                      : log.includes("请求")
                        ? "text-green-400"
                        : log.includes("识别错误")
                          ? "text-orange-400"
                          : "text-gray-500"
            }`}
          >
            {log}
          </p>
        ))}
      </div>
    </div>
  );
}
