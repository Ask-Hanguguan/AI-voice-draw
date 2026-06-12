import { useState, useRef, useCallback } from "react";

export default function App() {
  const [status, setStatus] = useState<"idle" | "listening" | "active">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [lastText, setLastText] = useState("");
  const listeningRef = useRef(false);
  const statusRef = useRef(status);
  const restartCountRef = useRef(0);
  // 实时记录所有识别文本，防止识别结果被状态更新覆盖
  const bufferRef = useRef("");

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
      /小笔/,  // 只说一次也触发，提高容错
    ];
    for (const pattern of fuzzyPatterns) {
      if (pattern.test(cleaned)) {
        addLog(`🔍 模糊匹配唤醒词: "${cleaned}" -> ${pattern}`);
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
      addLog("❌ 浏览器不支持");
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
      bufferRef.current = text;

      // 显示所有 interim 和 final 结果
      if (isFinal) {
        addLog(`📝 "${text}"`);
      } else {
        // interim 结果太多太吵，用简短前缀
        addLog(`💬 "${text}"`);
      }

      if (isFinal) {
        // 始终用 ref 读最新状态，避免闭包过期
        const currentStatus = statusRef.current;
        addLog(`   当前状态: ${currentStatus}, 匹配唤醒词: ${matchWakeWord(text)}`);

        if (currentStatus === "listening" && matchWakeWord(text)) {
          addLog('🔔 唤醒！');
          setStatus("active");
          speak("我在，请说");
        }
        if (currentStatus === "active") {
          const cleaned = text.replace(/[，。！？,!? ]/g, "");
          if (["退出", "休眠", "睡觉", "休息"].includes(cleaned)) {
            addLog('💤 休眠');
            setStatus("listening");
            setLastText("");
            speak("已休眠，说小笔小笔唤醒我");
          }
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      addLog(`⚠️ ${event.error}: ${event.message || ""}`);
    };

    rec.onend = () => {
      if (listeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 50) {
          addLog("❌ 重试超限，已停止。请刷新。");
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
      addLog(`❌ ${e.message}`);
      setTimeout(() => {
        if (listeningRef.current) startOnce();
      }, 1000);
    }
  }, [addLog]);

  const handleStart = useCallback(() => {
    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
      addLog("❌ 请使用 Chrome 浏览器");
      return;
    }
    addLog("🔊 请求麦克风...");
    listeningRef.current = true;
    startOnce();
    setStatus("listening");
  }, [addLog, startOnce]);

  function speak(text: string) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="w-full h-full bg-gray-950 text-white flex flex-col select-none">
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
        {status === "listening" && (
          <>
            <div className="w-24 h-24 rounded-full bg-blue-500/20 animate-ping mb-4" />
            <p className="text-xl">说「小笔小笔」唤醒</p>
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
            <p className="text-gray-600 text-sm mt-4">说「退出」休眠</p>
          </>
        )}
      </div>

      {/* 日志面板 */}
      <div className="h-48 border-t border-gray-800 bg-gray-900/80 font-mono text-xs p-3 overflow-y-auto">
        <p className="text-gray-500 mb-1">
          📋 日志
          {listeningRef.current && <span className="text-green-500 ml-1">● 监听中</span>}
          {status === "active" && <span className="text-yellow-400 ml-1">⚡ 已唤醒</span>}
        </p>
        {logs.length === 0 && <p className="text-gray-600">点击页面开始...</p>}
        {logs.map((log, i) => (
          <p
            key={i}
            className={`py-0.5 ${
              log.includes("❌") ? "text-red-400" :
              log.includes("🔔") ? "text-yellow-300 font-bold text-base" :
              log.includes("🔍") ? "text-purple-400" :
              log.includes("💤") ? "text-blue-300" :
              log.includes("🔊") ? "text-green-400" :
              log.includes("⚠️") ? "text-orange-400" :
              log.includes("当前状态") ? "text-gray-400" :
              "text-gray-500"
            }`}
          >
            {log}
          </p>
        ))}
      </div>
    </div>
  );
}