import { useState, useRef, useCallback } from "react";
import { useAppStore } from "./stores/appStore";
import { voiceFeedback } from "./speech/voiceFeedback";
import { parseCommand } from "./canvas/commandParser";
import { canvasManager } from "./canvas/canvasManager";
import StatusBar from "./components/StatusBar";
import Canvas from "./components/Canvas";

// ========== 确认应答匹配 ==========
function matchConfirm(text: string): boolean {
  const cleaned = text.replace(/[，。！？,!? ]/g, "");
  return /^(确定|好的|是的|可以|行|对|嗯|好)$/.test(cleaned);
}

function matchCancel(text: string): boolean {
  const cleaned = text.replace(/[，。！？,!? ]/g, "");
  return /^(取消|算了|不要|不用|不)$/.test(cleaned);
}

export default function App() {
  const status = useAppStore((s) => s.status);
  const lastFeedbackType = useAppStore((s) => s.lastFeedbackType);
  const lastFeedbackMessage = useAppStore((s) => s.lastFeedbackMessage);
  const canvasConfig = useAppStore((s) => s.canvasConfig);
  const pendingConfirm = useAppStore((s) => s.pendingConfirm);

  const setStatus = useAppStore((s) => s.setStatus);
  const setSpeechReady = useAppStore((s) => s.setSpeechReady);
  const setLastRecognizedText = useAppStore((s) => s.setLastRecognizedText);

  const [logs, setLogs] = useState<string[]>([]);
  const [lastText, setLastText] = useState("");
  const [canvasKey, setCanvasKey] = useState(0);

  const listeningRef = useRef(false);
  const statusRef = useRef(status);
  const restartCountRef = useRef(0);

  statusRef.current = status;

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[Voice] ${msg}`);
    setLogs((prev) => [...prev.slice(-19), `${time} ${msg}`]);
  }, []);

  function matchWakeWord(text: string): boolean {
    const cleaned = text.replace(/[\s，。！？,!?、"]/g, "");
    if (cleaned.includes("小笔小笔")) return true;
    const fuzzyPatterns = [
      /小[笔比毕必壁逼鼻彼].*小[笔比毕必壁逼鼻彼]/,
      /小[笔比毕必壁逼鼻彼]{2}/,
      /[晓小].*[笔比毕].*[晓小].*[笔比毕]/,
      /小笔/,
    ];
    for (const pattern of fuzzyPatterns) {
      if (pattern.test(cleaned)) return true;
    }
    return false;
  }

  function executeCommand(text: string) {
    const store = useAppStore.getState();
    const pending = store.pendingConfirm;

    // 1. 待确认对话
    if (pending) {
      if (matchConfirm(text)) {
        addLog(`确认: "${text}"`);
        store.setPendingConfirm(null);
        pending.action();
        return;
      }
      if (matchCancel(text)) {
        addLog(`取消: "${text}"`);
        store.setPendingConfirm(null);
        voiceFeedback.info("已取消");
        return;
      }
      voiceFeedback.guidance("请说确定或取消");
      return;
    }

    // 2. 解析指令
    const cmd = parseCommand(text);
    addLog(`指令: ${cmd.type} ${JSON.stringify(cmd.params)}`);

    switch (cmd.type) {
      // ---- 退出 ----
      case "exit": {
        addLog("休眠");
        setStatus("sleeping");
        setLastText("");
        setLastRecognizedText("");
        voiceFeedback.sleep();
        break;
      }

      // ---- 新建画布 ----
      case "new_canvas": {
        const w = cmd.params.width as number;
        const h = cmd.params.height as number;
        if (store.hasUnsavedContent) {
          voiceFeedback.info("未保存内容将丢失");
        }
        store.setCanvasConfig({ width: w, height: h });
        store.setZoomLevel(1);
        setCanvasKey((k) => k + 1);
        voiceFeedback.success("新建画布");
        addLog(`新建画布 ${w}x${h}`);
        break;
      }

      // ---- 清空画布 ----
      case "clear_canvas": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        if (!canvasManager.hasObjects()) {
          voiceFeedback.info("画布已经是空的");
          return;
        }
        store.setPendingConfirm({
          question: "确定要清空画布吗？",
          action: () => {
            canvasManager.clear();
            store.setHasUnsavedContent(false);
            voiceFeedback.success("清空画布");
            addLog("画布已清空");
          },
        });
        voiceFeedback.confirm("确定要清空画布吗？");
        break;
      }

      // ---- F005: 画布缩放 ----
      case "canvas_zoom_in": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        const zoom = canvasManager.zoomIn();
        const pct = Math.round(zoom * 100);
        store.setZoomLevel(zoom);
        voiceFeedback.zoomIn(pct);
        addLog(`放大 ${pct}%`);
        break;
      }

      case "canvas_zoom_out": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        const zoom = canvasManager.zoomOut();
        const pct = Math.round(zoom * 100);
        store.setZoomLevel(zoom);
        voiceFeedback.zoomOut(pct);
        addLog(`缩小 ${pct}%`);
        break;
      }

      case "canvas_zoom_reset": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        canvasManager.zoomReset();
        store.setZoomLevel(1);
        voiceFeedback.zoomReset();
        addLog("恢复原始大小");
        break;
      }

      case "canvas_zoom_fit": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        const container = document.getElementById("canvas-container");
        if (!container) {
          voiceFeedback.error("无法获取画布容器");
          return;
        }
        const rect = container.getBoundingClientRect();
        const zoom = canvasManager.zoomToFit(rect.width, rect.height);
        const pct = Math.round(zoom * 100);
        store.setZoomLevel(zoom);
        voiceFeedback.zoomFit(pct);
        addLog(`适应屏幕 ${pct}%`);
        break;
      }

      // ---- 撤销 ----
      case "undo": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        if (canvasManager.undo()) {
          voiceFeedback.undo();
        } else {
          voiceFeedback.nothingToUndo();
        }
        break;
      }

      // ---- 恢复 ----
      case "redo": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        if (canvasManager.redo()) {
          voiceFeedback.redo();
        } else {
          voiceFeedback.nothingToRedo();
        }
        break;
      }


      // ---- F006: 绘制直线 ----
      case "draw_line": {
        if (!canvasManager.exists()) {
          voiceFeedback.needCanvas();
          return;
        }
        const size = canvasManager.getSize()!;
        const pos = cmd.params.position as { x: number; y: number } | null;
        const lineSize = (cmd.params.size as number) || (cmd.params.length as number) || 100;
        const cx = pos ? pos.x * size.width : size.width / 2;
        const cy = pos ? pos.y * size.height : size.height / 2;
        const angle = pos ? 0 : -45;
        const rad = (angle * Math.PI) / 180;
        const halfLen = lineSize / 2;
        const x1 = cx - halfLen * Math.cos(rad);
        const y1 = cy - halfLen * Math.sin(rad);
        const x2 = cx + halfLen * Math.cos(rad);
        const y2 = cy + halfLen * Math.sin(rad);
        canvasManager.drawLine(x1, y1, x2, y2);
        voiceFeedback.drawLine();
        addLog("绘制直线");
        break;
      }

      // ---- F007: 绘制圆形 ----
      case "draw_circle": {
        if (!canvasManager.exists()) {
          voiceFeedback.needCanvas();
          return;
        }
        const cSize = canvasManager.getSize()!;
        const cPos = cmd.params.position as { x: number; y: number } | null;
        const cRadius = (cmd.params.radius as number) || (cmd.params.size as number) || 50;
        const cIsEllipse = (cmd.params.isEllipse as boolean) || false;
        const ccx = cPos ? cPos.x * cSize.width : cSize.width / 2;
        const ccy = cPos ? cPos.y * cSize.height : cSize.height / 2;
        canvasManager.drawCircle(ccx, ccy, cRadius, cIsEllipse);
        voiceFeedback.drawCircle();
        addLog(`绘制${cIsEllipse ? "椭圆" : "圆形"} r=${cRadius}`);
        break;
      }

      // ---- F008: 绘制矩形 ----
      case "draw_rectangle": {
        if (!canvasManager.exists()) {
          voiceFeedback.needCanvas();
          return;
        }
        const rSize = canvasManager.getSize()!;
        const rPos = cmd.params.position as { x: number; y: number } | null;
        const rIsSquare = (cmd.params.isSquare as boolean) || false;
        const rWidth = rIsSquare
          ? ((cmd.params.width as number) || (cmd.params.size as number) || 100)
          : ((cmd.params.width as number) || (cmd.params.size as number) || 150);
        const rHeight = rIsSquare
          ? rWidth
          : ((cmd.params.height as number) || (cmd.params.size as number) || 100);
        const rLeft = rPos ? rPos.x * rSize.width - rWidth / 2 : (rSize.width - rWidth) / 2;
        const rTop = rPos ? rPos.y * rSize.height - rHeight / 2 : (rSize.height - rHeight) / 2;
        canvasManager.drawRect(rLeft, rTop, rWidth, rHeight);
        voiceFeedback.drawRectangle();
        addLog(`绘制${rIsSquare ? "正方形" : "矩形"} ${rWidth}x${rHeight}`);
        break;
      }

      // ---- F009: 绘制三角形 ----
      case "draw_triangle": {
        if (!canvasManager.exists()) {
          voiceFeedback.needCanvas();
          return;
        }
        const tSize = canvasManager.getSize()!;
        const tPos = cmd.params.position as { x: number; y: number } | null;
        const tIsEquilateral = (cmd.params.isEquilateral as boolean) !== false;
        const tSide = (cmd.params.side as number) || (cmd.params.size as number) || 80;
        const tCx = tPos ? tPos.x * tSize.width : tSize.width / 2;
        const tCy = tPos ? tPos.y * tSize.height : tSize.height / 2;
        canvasManager.drawTriangle(tCx, tCy, tSide, tIsEquilateral);
        voiceFeedback.drawTriangle();
        addLog(`绘制${tIsEquilateral ? "等边" : ""}三角形 side=${tSide}`);
        break;
      }

      // ---- F010: 画笔颜色 ----
      case "brush_color": {
        const hex = cmd.params.color as string | undefined;
        const name = cmd.params.colorName as string | undefined;
        if (!hex) {
          voiceFeedback.guidance("请指定画笔颜色，比如红色、蓝色、绿色");
          return;
        }
        store.setBrushColor(hex);
        voiceFeedback.brushColor(name || hex);
        addLog(`画笔颜色 → ${name || hex}`);
        break;
      }

      // ---- F011: 画笔粗细 ----
      case "brush_width": {
        const mode = cmd.params.mode as string;
        const currentWidth = store.brushStrokeWidth;

        if (mode === "absolute") {
          const value = cmd.params.value as number;
          store.setBrushStrokeWidth(value);
          voiceFeedback.brushWidth(`粗细改为 ${value} 像素`);
          addLog(`画笔粗细 → ${value}px`);
        } else if (mode === "relative") {
          const delta = cmd.params.delta as number;
          const newWidth = Math.min(20, Math.max(1, currentWidth + delta));
          store.setBrushStrokeWidth(newWidth);
          const desc = delta > 0 ? "加粗" : "变细";
          voiceFeedback.brushWidth(`${desc}到 ${newWidth} 像素`);
          addLog(`画笔粗细 → ${newWidth}px`);
        } else if (mode === "preset") {
          const value = cmd.params.value as number;
          const label = cmd.params.label as string;
          store.setBrushStrokeWidth(value);
          voiceFeedback.brushWidth(`画笔已换成${label}，${value} 像素`);
          addLog(`画笔粗细 → ${label} (${value}px)`);
        }
        break;
      }

      // ---- F012: 填充与描边 ----
      case "fill_mode": {
        const mode = cmd.params.mode as string;

        if (mode === "fill_color") {
          const color = cmd.params.color as string | undefined;
          const colorName = cmd.params.colorName as string | undefined;
          if (!color) {
            voiceFeedback.guidance("请指定填充颜色，比如填充红色、填充蓝色");
            return;
          }
          store.setBrushFill(color);
          voiceFeedback.fillMode(`填充已换成${colorName || color}`);
          addLog(`填充颜色 → ${colorName || color}`);
        } else if (mode === "outline") {
          store.setBrushFill("none");
          voiceFeedback.fillMode("已切换为轮廓模式，只显示描边");
          addLog("填充模式 → 仅轮廓");
        } else if (mode === "default") {
          store.setBrushFill("");
          voiceFeedback.fillMode("已恢复默认填充");
          addLog("填充模式 → 默认填充");
        }
        break;
      }

      // ---- F015: 删除最近绘制的图形 ----
      case "delete_shape": {
        if (!canvasManager.exists()) {
          voiceFeedback.guidance("请先新建画布");
          return;
        }
        if (canvasManager.deleteLast()) {
          voiceFeedback.deleteShape();
          addLog("已删除最近图形");
        } else {
          voiceFeedback.info("画布上没有可删除的图形");
        }
        break;
      }

      case "unrecognized":
        voiceFeedback.unrecognized();
        break;
    }
  }

  // ========== 语音识别 ==========
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

    rec.onstart = () => { restartCountRef.current = 0; };

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

      if (!isFinal) return;

      addLog(`识别: "${text}"`);
      const currentStatus = statusRef.current;

      if (currentStatus === "sleeping") {
        if (matchWakeWord(text)) {
          addLog("唤醒！");
          setStatus("active");
          voiceFeedback.wake();
        }
        return;
      }

      if (currentStatus === "active") {
        executeCommand(text);
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      addLog(`识别错误: ${event.error}`);
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
      voiceFeedback.speechUnavailable();
      return;
    }
    setSpeechReady(true);
    listeningRef.current = true;
    startOnce();
    if (status === "idle") {
      setStatus("sleeping");
    }
  }, [startOnce, setSpeechReady, setStatus, status]);

  // ========== 渲染 ==========
  const showCanvas = status === "active" && canvasConfig !== null;

  return (
    <div className="w-full h-full bg-gray-950 text-white flex flex-col select-none">
      {status !== "idle" && <StatusBar />}

      {showCanvas ? (
        <Canvas width={canvasConfig!.width} height={canvasConfig!.height} canvasKey={canvasKey} />
      ) : (
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
          {status === "active" && !canvasConfig && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400">语音已激活</span>
              </div>
              <p className="text-xl">画布就绪</p>
              <p className="text-gray-400 mt-2 text-sm">
                说"新建画布""新建A4画布"或"新建正方形画布"
              </p>
              {lastText && (
                <p className="text-gray-300 mt-2 text-lg">"{lastText}"</p>
              )}
              <p className="text-gray-600 text-sm mt-4">说"退出"休眠</p>
            </>
          )}
        </div>
      )}

      {/* 待确认横幅 */}
      {pendingConfirm && (
        <div className="mx-auto mb-1 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 bg-yellow-500/20 text-yellow-300 transition-all">
          <span className="text-base">❓</span>
          <span>{pendingConfirm.question}</span>
          <span className="text-gray-500 ml-2">说"确定"或"取消"</span>
        </div>
      )}

      {/* F002 反馈指示器 */}
      {lastFeedbackMessage && !pendingConfirm && (
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
              log.includes("不可用")
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
                          : log.includes("指令:")
                            ? "text-cyan-400"
                            : log.includes("确认")
                              ? "text-green-400"
                              : log.includes("取消")
                                ? "text-yellow-400"
                                : log.includes("放大") || log.includes("缩小") || log.includes("适应") || log.includes("原始") || log.includes("绘制")
                                  ? "text-purple-400"
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
