import { useAppStore } from "../stores/appStore";

export default function StatusBar() {
  const lastRecognizedText = useAppStore((s) => s.lastRecognizedText);

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 backdrop-blur border-b border-gray-700 text-sm select-none">
      {/* 左侧：状态指示 */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-green-400 font-medium">语音已激活</span>
      </div>

      {/* 中间：识别反馈 */}
      <div className="flex-1 mx-8 text-center">
        {lastRecognizedText ? (
          <span className="text-gray-300 truncate block max-w-md mx-auto">
            {'"'}
            {lastRecognizedText}
            {'"'}
          </span>
        ) : (
          <span className="text-gray-600">等待指令...</span>
        )}
      </div>

      {/* 右侧：退出提示 */}
      <div className="text-gray-500 text-xs">说"退出" 休眠</div>
    </div>
  );
}
