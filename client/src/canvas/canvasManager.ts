// 画布管理器 — 封装 Fabric.js Canvas 生命周期
// 负责创建、销毁、清空画布，撤销/恢复操作历史栈，以及视图缩放

import { Canvas as FabricCanvas, Line } from "fabric";

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor?: string;
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

  // 记录画布逻辑尺寸，供 clear 后重建网格
  private logicalWidth = 800;
  private logicalHeight = 600;

  exists(): boolean {
    return this.canvas !== null;
  }

  /** 创建画布 */
  create(el: HTMLCanvasElement | string, config?: Partial<CanvasConfig>): FabricCanvas {
    if (this.canvas) this.destroy();

    const { width = 800, height = 600, backgroundColor = "#ffffff" } = config ?? {};
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.canvas = new FabricCanvas(el, {
      width,
      height,
      backgroundColor,
      selection: false,
      preserveObjectStacking: true,
    });

    this.undoStack = [];
    this.redoStack = [];
    this.contentChanged = false;

    // F005: 添加参考网格（缩放时肉眼可辨）
    this.addGrid();

    this.saveSnapshot();
    console.log(`[Canvas] 已创建 ${width}x${height}`);
    return this.canvas;
  }

  /** 销毁画布 */
  destroy(): void {
    if (this.canvas) {
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
    const strokeColor = "rgba(0,0,0,0.06)";

    // 竖线
    for (let x = 0; x <= w; x += gridSize) {
      this.canvas.add(
        new Line([x, 0, x, h], {
          stroke: strokeColor,
          selectable: false,
          evented: false,
          excludeFromExport: true,
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
          excludeFromExport: true,
        })
      );
    }
    this.canvas.renderAll();
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
    // 只移除用户绘制的图形，保留网格
    const objs = this.canvas.getObjects();
    for (const obj of objs) {
      // 网格线没有 isGrid 标记（未存 JSON），通过 selectable 间接判断
      if (obj.selectable === false && obj.evented === false) continue;
      this.canvas.remove(obj);
    }
    this.canvas.renderAll();
    this.saveSnapshot();
  }

  hasObjects(): boolean {
    if (!this.canvas) return false;
    // 排除网格线（不可选、不可交互）
    return this.canvas.getObjects().some(
      (o) => o.selectable !== false || o.evented !== false
    );
  }

  getSize(): { width: number; height: number } | null {
    if (!this.canvas) return null;
    return { width: this.logicalWidth, height: this.logicalHeight };
  }
}

export const canvasManager = new CanvasManager();
