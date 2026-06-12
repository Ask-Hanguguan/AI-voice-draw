// 画布管理器 — 封装 Fabric.js Canvas 生命周期
// 负责创建、销毁、清空画布，以及撤销/恢复操作历史栈

import { Canvas as FabricCanvas } from "fabric";

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

  /** 画布是否存在（运行时判断，比 store 更可靠） */
  exists(): boolean {
    return this.canvas !== null;
  }

  /** 创建画布 */
  create(el: HTMLCanvasElement | string, config?: Partial<CanvasConfig>): FabricCanvas {
    if (this.canvas) {
      this.destroy();
    }

    const { width = 800, height = 600, backgroundColor = "#ffffff" } = config ?? {};

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

    this.saveSnapshot();
    console.log(`[Canvas] 已创建 ${width}x${height}, canvas=${!!this.canvas}`);
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
    console.log("[Canvas] 已销毁");
  }

  // ========== 操作历史栈 ==========

  /** 保存当前画布 JSON 快照 */
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

  /** 撤销 */
  undo(): boolean {
    if (!this.canvas || this.undoStack.length <= 1) return false;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.loadFromSnapshot(this.undoStack[this.undoStack.length - 1]);
    return true;
  }

  /** 恢复 */
  redo(): boolean {
    if (!this.canvas || this.redoStack.length === 0) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.loadFromSnapshot(next);
    return true;
  }

  /** 从 JSON 快照恢复画布 */
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

  /** 清空画布（不检查是否有对象，强制清除） */
  clear(): void {
    if (!this.canvas) return;
    this.canvas.clear();
    this.canvas.backgroundColor = "#ffffff";
    this.canvas.renderAll();
    this.saveSnapshot();
    console.log("[Canvas] 已清空");
  }

  /** 画布是否有图形对象 */
  hasObjects(): boolean {
    if (!this.canvas) return false;
    return this.canvas.getObjects().length > 0;
  }

  /** 获取当前画布尺寸 */
  getSize(): { width: number; height: number } | null {
    if (!this.canvas) return null;
    return {
      width: this.canvas.width || 0,
      height: this.canvas.height || 0,
    };
  }
}

export const canvasManager = new CanvasManager();
