import { useEffect, useRef } from "react";
import { canvasManager } from "../canvas/canvasManager";

interface Props {
  width: number;
  height: number;
}

export default function Canvas({ width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasElRef.current) return;
    // 幂等创建：如果 canvasManager 已有画布且对应同一 DOM 元素，跳过
    if (!canvasManager.canvas) {
      canvasManager.create(canvasElRef.current, { width, height });
    }
    // 不返回 cleanup — StrictMode 的 cleanup→remount 会破坏 Fabric.js
    // canvasManager 的 dispose 由 usesDestroyed 信号量控制
  }, [width, height]);

  // 真正的卸载清理
  useEffect(() => {
    let disposed = false;
    return () => {
      if (!disposed) {
        disposed = true;
        canvasManager.destroy();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      className="flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto"
    >
      <div
        className="animate-fadeIn rounded-lg"
        style={{
          boxShadow: "0 0 30px rgba(255,255,255,0.15), 0 4px 24px rgba(0,0,0,0.6)",
          border: "3px solid rgba(255,255,255,0.25)",
          borderRadius: "8px",
          overflow: "hidden",
          lineHeight: 0,
        }}
      >
        <canvas
          ref={canvasElRef}
          id="drawing-canvas"
          width={width}
          height={height}
          style={{ display: "block", background: "#ffffff" }}
        />
      </div>
    </div>
  );
}