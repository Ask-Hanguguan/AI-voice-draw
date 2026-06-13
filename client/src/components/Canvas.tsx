import { useEffect, useRef } from "react";
import { canvasManager } from "../canvas/canvasManager";

interface Props {
  width: number;
  height: number;
  canvasKey: number;
}

export default function Canvas({ width, height, canvasKey }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    // 如果 canvasManager 已有画布且绑定在同一个 DOM 元素上 → 只更新尺寸
    if (canvasManager.canvas && canvasManager.isBoundTo(el)) {
      canvasManager.canvas.setDimensions(
        { width, height },
        { cssOnly: false }
      );
      canvasManager.canvas.renderAll();
      return;
    }

    // 需要创建新画布
    console.log("[Canvas] 创建 Fabric 画布", width, "x", height);
    canvasManager.create(el, { width, height });

    return () => {
      canvasManager.destroy();
    };
  }, [width, height, canvasKey]);

  return (
    <div
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
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}