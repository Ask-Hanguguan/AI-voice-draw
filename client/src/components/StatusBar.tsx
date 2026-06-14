import { useAppStore } from "../stores/appStore";

interface StatusBarProps {
  llmOnline: boolean;
}

export default function StatusBar({ llmOnline }: StatusBarProps) {
  const lastRecognizedText = useAppStore((s) => s.lastRecognizedText);
  const status = useAppStore((s) => s.status);
  const lastFeedbackType = useAppStore((s) => s.lastFeedbackType);
  const lastFeedbackMessage = useAppStore((s) => s.lastFeedbackMessage);
  const speechPaused = useAppStore((s) => s.speechPaused);
  const zoomLevel = useAppStore((s) => s.zoomLevel);
  const canvasConfig = useAppStore((s) => s.canvasConfig);

  const feedbackColor =
    lastFeedbackType === "success"
      ? "text-green-300 bg-green-500/10 border-green-500/30"
      : lastFeedbackType === "error"
        ? "text-red-300 bg-red-500/10 border-red-500/30"
        : lastFeedbackType === "confirm"
          ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/30"
          : lastFeedbackType === "guidance"
            ? "text-orange-300 bg-orange-500/10 border-orange-500/30"
            : "text-blue-300 bg-blue-500/10 border-blue-500/30";

  const feedbackIcon =
    lastFeedbackType === "success"
      ? "✅"
      : lastFeedbackType === "error"
        ? "❌"
        : lastFeedbackType === "confirm"
          ? "❓"
          : lastFeedbackType === "guidance"
            ? "💡"
            : "🔊";

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 backdrop-blur border-b border-gray-700 text-sm select-none">
      {/* 左侧：状态指示 */}
      <div className="flex items-center gap-3">
        {status === "active" ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <span className="text-green-400 font-medium">语音已激活</span>
            {speechPaused && (
              <span className="text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded text-xs ml-1">⏸ 已暂停</span>
            )}
          </>
        ) : (
          <>
            <span className="relative flex h-3 w-3">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-600" />
            </span>
            <span className="text-gray-500 font-medium">等待唤醒</span>
          </>
        )}
      </div>

      {/* 中间：识别反馈 + F002 语音反馈 */}
      <div className="flex-1 mx-8 text-center flex flex-col items-center gap-0.5">
        {lastRecognizedText ? (
          <span className="text-gray-300 truncate block max-w-md mx-auto">
            "{lastRecognizedText}"
          </span>
        ) : (
          <span className="text-gray-600">等待指令...</span>
        )}
        {lastFeedbackMessage && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${feedbackColor} max-w-sm truncate`}
          >
            {feedbackIcon} {lastFeedbackMessage}
          </span>
        )}
      </div>

      {/* 右侧：AI 状态 + 缩放 + 退出提示 */}
      <div className="flex items-center gap-3 text-xs">
        <span
          className="px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            background: llmOnline ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: llmOnline ? "#86efac" : "#fca5a5",
          }}
        >
          <span className={"h-1.5 w-1.5 rounded-full " + (llmOnline ? "bg-green-400" : "bg-red-400")} />
          <span>AI</span>
        </span>
        {canvasConfig && status === "active" && (
          <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
            🔍 {Math.round(zoomLevel * 100)}%
          </span>
        )}
        <span className="text-gray-500">说"退出" 休眠</span>
      </div>
    </div>
  );
}
