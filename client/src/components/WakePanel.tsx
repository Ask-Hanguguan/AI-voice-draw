import { useAppStore } from "../stores/appStore";

interface Props {
  onStart: () => void;
  debugText?: string;
}

export default function WakePanel({ onStart, debugText }: Props) {
  const speechReady = useAppStore((s) => s.speechReady);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white select-none">
      {!speechReady ? (
        /* ---- 未激活：显示启动按钮 ---- */
        <>
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 animate-pulse flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-300"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>

          <p className="text-xl font-medium text-gray-200 mb-2">
            AI 语音绘图工具
          </p>
          <p className="text-sm text-gray-500 mb-6">纯语音控制，无需鼠标键盘</p>

          <button
            onClick={onStart}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 
                       text-white rounded-full text-lg font-medium transition-all 
                       shadow-lg shadow-blue-600/25"
          >
            点击启用语音
          </button>

          <p className="text-xs text-gray-600 mt-4">启用后说「小笔小笔」唤醒</p>
        </>
      ) : (
        /* ---- 已激活：等待唤醒词 ---- */
        <>
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-blue-500/20 animate-ping absolute inset-0 m-auto" />
            <div className="w-24 h-24 rounded-full bg-blue-500/30 animate-pulse relative flex items-center justify-center">
              <svg
                className="w-12 h-12 text-blue-300"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>

          <p className="text-xl font-medium text-gray-200 mb-2">
            说"小笔小笔"唤醒我
          </p>
          <p className="text-sm text-gray-500 mb-4">正在倾听中...</p>

          {/* 调试面板：显示 ASR 实时识别结果 */}
          {debugText && (
            <p className="text-xs text-gray-600 bg-gray-800/50 rounded px-3 py-1">
              识别到: 「{debugText}」
            </p>
          )}
        </>
      )}
    </div>
  );
}