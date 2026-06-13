// 画布管理器 — 封装 Fabric.js Canvas 生命周期
// 负责创建、销毁、清空画布，撤销/恢复操作历史栈，视图缩放，以及基础绘图

import { Canvas as FabricCanvas, Line, Circle, Ellipse, Rect, Triangle } from "fabric";
import { useAppStore } from "../stores/appStore";

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface BrushStyle {
  color: string;
  strokeWidth: number;
  fill: string;
}

class CanvasManager {
  canvas: FabricCanvas | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxHistory = 10;
  contentChanged = false;

  private minZoom = 0.1;
  private maxZoom = 5.0;
  private zoomStep = 1.2;

  private logicalWidth = 800;
  private logicalHeight = 600;

  exists(): boolean {
    return this.canvas !== null;
  }

  /** 检查已有画布是否绑定在指定的 DOM 元素上（用于判断是否需要重新初始化） */
  isBoundTo(el: HTMLCanvasElement): boolean {
    if (!this.canvas) return false;
    try {
      const bound = (this.canvas as any).lowerCanvasEl ?? (this.canvas as any).getElement?.();
      return bound === el;
    } catch {
      return false;
    }
  }

  /** 清理 canvas 元素上残留的旧 Fabric DOM 结构（HMR 后常见） */
  private _cleanOrphanedFabricDOM(canvasEl: HTMLCanvasElement): void {
    // 移除旧 Fabric 标记
    canvasEl.removeAttribute("data-fabric");
    canvasEl.classList.remove("lower-canvas", "upper-canvas");

    // 如果 canvas 被包在旧 Fabric 容器里，把它移回原位置
    const parent = canvasEl.parentElement;
    if (parent?.hasAttribute?.("data-fabric")) {
      const grandParent = parent.parentElement;
      if (grandParent) {
        grandParent.replaceChild(canvasEl, parent);
      }
    }

    // 清理页面上所有孤儿 Fabric 容器（没有 canvas 子元素的旧容器）
    document.querySelectorAll('[data-fabric="wrapper"]').forEach((w) => {
      if (!(w as HTMLElement).querySelector?.("canvas")) {
        w.remove();
      }
    });
  }

  /** 创建画布 — 幂等：同一元素不重复创建 */
  create(el: HTMLCanvasElement | string, config?: Partial<CanvasConfig>): FabricCanvas {
    if (this.canvas) this.destroy();

    // 清理可能残留的旧 Fabric DOM 结构（如 HMR 后残留的容器 div）
    const canvasEl = typeof el === "string" ? document.getElementById(el) as HTMLCanvasElement : el;
    if (canvasEl) {
      this._cleanOrphanedFabricDOM(canvasEl);
    }

    const { width = 800, height = 600, backgroundColor = "#ffffff" } = config ?? {};
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.canvas = new FabricCanvas(el, {
      width,
      height,
      backgroundColor,
      selection: false,
      preserveObjectStacking: true,
      enableRetinaScaling: false,
    });

    this.undoStack = [];
    this.redoStack = [];
    this.contentChanged = false;

    // F005: 添加参考网格
    this.addGrid();

    this.saveSnapshot();

    this.zoomReset(); // 强制缩放1倍
    this.canvas.requestRenderAll();

    console.log("[Canvas] 已创建", width, "x", height,
      "对象数:", this.canvas.getObjects().length);
    return this.canvas;

  }

  /** 销毁画布 */
  destroy(): void {
    if (this.canvas) {
      console.log("[Canvas] 销毁画布");
      this.canvas.dispose();
      this.canvas = null;
    }
    this.undoStack = [];
    this.redoStack = [];
    this.contentChanged = false;
  }

  // ========== F005: 网格背景 ==========

  private addGrid(): void {
    if (!this.canvas) return;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const gridSize = 40;
    const strokeColor = "rgba(0, 0, 0, 0.1)";

    // 竖线
    for (let x = 0; x <= w; x += gridSize) {
      this.canvas.add(
        new Line([x, 0, x, h], {
          stroke: strokeColor,
          selectable: false,
          evented: false,
        })
      );
    }
    // 横线
    for (let y = 0; y <= h; y += gridSize) {
      this.canvas.add(
        new Line([0, y, w, y], {
          stroke: strokeColor,
          selectable: false,
          evented: false,
        })
      );
    }
    this.canvas.renderAll();
    console.log("[Canvas] 网格已添加，总对象数:", this.canvas.getObjects().length);
  }

  // ========== F005: 视图缩放 ==========

  zoomIn(): number {
    if (!this.canvas) return 1;
    const current = this.canvas.getZoom();
    const next = Math.min(current * this.zoomStep, this.maxZoom);
    this.applyZoom(next);
    return next;
  }

  zoomOut(): number {
    if (!this.canvas) return 1;
    const current = this.canvas.getZoom();
    const next = Math.max(current / this.zoomStep, this.minZoom);
    this.applyZoom(next);
    return next;
  }

  zoomReset(): number {
    if (!this.canvas) return 1;
    this.applyZoom(1);
    return 1;
  }

  zoomToFit(containerWidth: number, containerHeight: number): number {
    if (!this.canvas) return 1;
    const cw = this.logicalWidth;
    const ch = this.logicalHeight;
    const padding = 0.9;
    const scaleX = (containerWidth * padding) / cw;
    const scaleY = (containerHeight * padding) / ch;
    const zoom = Math.min(scaleX, scaleY, 1);
    this.applyZoom(zoom);
    return zoom;
  }

  private applyZoom(zoom: number): void {
    if (!this.canvas) return;
    const center = this.canvas.getCenterPoint();
    this.canvas.zoomToPoint(center, zoom);
    this.canvas.renderAll();
  }

  getZoom(): number {
    if (!this.canvas) return 1;
    return this.canvas.getZoom();
  }

  // ========== 操作历史栈 ==========

  saveSnapshot(): void {
    if (!this.canvas) return;
    const json = JSON.stringify(this.canvas.toJSON());
    this.undoStack.push(json);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.contentChanged = true;
  }

  undo(): boolean {
    if (!this.canvas || this.undoStack.length <= 1) return false;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.loadFromSnapshot(this.undoStack[this.undoStack.length - 1]);
    return true;
  }

  redo(): boolean {
    if (!this.canvas || this.redoStack.length === 0) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.loadFromSnapshot(next);
    return true;
  }

  private async loadFromSnapshot(json: string): Promise<void> {
    if (!this.canvas) return;
    try {
      const parsed = JSON.parse(json);
      await this.canvas.loadFromJSON(parsed);
      this.canvas.renderAll();
    } catch (err) {
      console.error("[Canvas] 快照恢复失败:", err);
    }
  }

  // ========== 工具方法 ==========

  clear(): void {
    if (!this.canvas) return;
    const objs = this.canvas.getObjects();
    for (const obj of objs) {
      if (obj.selectable === false && obj.evented === false) continue;
      this.canvas.remove(obj);
    }
    this.canvas.renderAll();
    this.saveSnapshot();
  }

  hasObjects(): boolean {
    if (!this.canvas) return false;
    return this.canvas.getObjects().some(
      (o) => o.selectable !== false || o.evented !== false
    );
  }

  getSize(): { width: number; height: number } | null {
    if (!this.canvas) return null;
    return { width: this.logicalWidth, height: this.logicalHeight };
  }

  // ========== 画笔样式 ==========

  getBrushStyle(): BrushStyle {
    const store = useAppStore.getState();
    return {
      color: store.brushColor,
      strokeWidth: store.brushStrokeWidth,
      fill: store.brushFill,
    };
  }

  private shapeOpts(): Record<string, unknown> {
    const s = this.getBrushStyle();
    const opts: Record<string, unknown> = {
      stroke: s.color || "#000000",
      strokeWidth: s.strokeWidth || 3,
      selectable: false,
      evented: true,
    };
    opts.fill = s.fill && s.fill !== "" ? s.fill : "rgba(255,0,0,0.15)";
    return opts;
  }

  private renderCanvas(): void {
    if (!this.canvas) return;
    this.canvas.renderAll();
  }

  // ========== F006: 绘制直线 ==========

  drawLine(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.canvas) return;
    const line = new Line([x1, y1, x2, y2], {
      stroke: this.getBrushStyle().color || "#000000",
      strokeWidth: this.getBrushStyle().strokeWidth || 3,
      selectable: false,
      evented: true,
      strokeLineCap: "round",
    });
    this.canvas.add(line);
    this.renderCanvas();
    console.log("[Canvas] 直线已添加，对象数:", this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  // ========== F007: 绘制圆形 ==========

  drawCircle(cx: number, cy: number, radius: number, isEllipse = false): void {
    if (!this.canvas) return;
    const opts = this.shapeOpts();
    if (isEllipse) {
      const rx = radius;
      const ry = Math.round(radius * 0.6);
      this.canvas.add(new Ellipse({
        left: cx - rx, top: cy - ry, rx, ry, ...opts,
      }));
    } else {
      this.canvas.add(new Circle({
        left: cx - radius, top: cy - radius, radius, ...opts,
      }));
    }
    this.renderCanvas();
    console.log("[Canvas] 圆已添加，对象数:", this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  // ========== F008: 绘制矩形 ==========

  drawRect(left: number, top: number, width: number, height: number): void {
    if (!this.canvas) return;
    const opts = this.shapeOpts();
    const rect = new Rect({
      left,
      top,
      width,
      height,
      originX: "left",
      originY: "top",
      ...opts,
    });
    this.canvas.add(rect);
    rect.setCoords();
    this.renderCanvas();
    console.log("[Canvas] 矩形已添加，对象数:", this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  // ========== F009: 绘制三角形 ==========

  drawTriangle(cx: number, cy: number, size: number, isEquilateral = true): void {
    if (!this.canvas) return;
    const opts = this.shapeOpts();
    const height = isEquilateral ? (Math.sqrt(3) / 2) * size : size;
    const triangle = new Triangle({
      left: cx,
      top: cy,
      originX: "center",
      originY: "center",
      width: size,
      height,
      ...opts,
    });
    this.canvas.add(triangle);
    this.renderCanvas();
    console.log("[Canvas] 三角形已添加，对象数:", this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  
}

export const canvasManager = new CanvasManager();
(window as any).canvasManager = canvasManager;