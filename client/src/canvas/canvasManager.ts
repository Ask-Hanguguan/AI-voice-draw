// 画布管理器 — 封装 Fabric.js Canvas 生命周期
// 负责创建、销毁、清空画布，撤销/恢复操作历史栈，视图缩放，以及基础绘图

import { Canvas as FabricCanvas, Line, Circle, Ellipse, Rect, Triangle, Point, Polygon, ActiveSelection, FabricObject } from "fabric";
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
  dashArray: number[];
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

  // ========== F015: 删除最近绘制的图形 ==========

  deleteLast(): boolean {
    if (!this.canvas) return false;
    const objs = this.canvas.getObjects();
    // 倒序遍历，跳过网格线（selectable=false 且 evented=false）
    for (let i = objs.length - 1; i >= 0; i--) {
      const obj = objs[i];
      if (obj.selectable !== false || obj.evented !== false) {
        this.canvas.remove(obj);
        this.renderCanvas();
        this.saveSnapshot();
        console.log("[Canvas] 已删除最近图形，剩余对象数:", this.canvas.getObjects().length);
        return true;
      }
    }
    return false;
  }

  getSize(): { width: number; height: number } | null {
    if (!this.canvas) return null;
    return { width: this.logicalWidth, height: this.logicalHeight };
  }

  // ========== F016: 保存为PNG ==========

  saveToPNG(filename = "drawing.png"): boolean {
    if (!this.canvas) return false;
    const dataURL = this.canvas.toDataURL({ format: "png", multiplier: 2 });
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("[Canvas] 图片已保存:", filename);
    return true;
  }

  // ========== F017: 自定义画布尺寸 ==========

  resize(width: number, height: number): boolean {
    if (!this.canvas) return false;
    // 移除旧网格线（selectable=false 且 evented=false）
    const objs = this.canvas.getObjects();
    for (const obj of objs) {
      if (obj.selectable === false && obj.evented === false) {
        this.canvas.remove(obj);
      }
    }
    // 更新尺寸
    this.logicalWidth = width;
    this.logicalHeight = height;
    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    // 重建网格
    this.addGrid();
    this.canvas.renderAll();
    this.saveSnapshot();
    console.log("[Canvas] 画布已调整为", width, "x", height);
    return true;
  }

  // ========== F018: 画布平移 ==========

  pan(direction: string, amount = 100): boolean {
    if (!this.canvas) return false;
    let dx = 0, dy = 0;
    switch (direction) {
      case "up":    dy = -amount; break;
      case "down":  dy =  amount; break;
      case "left":  dx = -amount; break;
      case "right": dx =  amount; break;
    }
    this.canvas.relativePan(new Point(dx, dy));
    this.canvas.renderAll();
    console.log("[Canvas] 画布平移:", direction, amount, "px");
    return true;
  }

  // ========== 画笔样式 ==========

  getBrushStyle(): BrushStyle {
    const store = useAppStore.getState();
    return {
      color: store.brushColor,
      strokeWidth: store.brushStrokeWidth,
      fill: store.brushFill,
      dashArray: store.brushDashArray,
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
    opts.fill = s.fill === "none" ? "" : (s.fill && s.fill !== "" ? s.fill : "rgba(255,0,0,0.15)");
    // F022: 虚线/点划线
    if (s.dashArray && s.dashArray.length > 0) {
      opts.strokeDashArray = s.dashArray;
    }
    return opts;
  }

  private renderCanvas(): void {
    if (!this.canvas) return;
    this.canvas.renderAll();
  }

  // ========== F006: 绘制直线 ==========

  drawLine(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.canvas) return;
    const style = this.getBrushStyle();
    const lineOpts: Record<string, unknown> = {
      stroke: style.color || "#000000",
      strokeWidth: style.strokeWidth || 3,
      selectable: false,
      evented: true,
      strokeLineCap: "round",
    };
    // F022: 虚线/点划线
    if (style.dashArray && style.dashArray.length > 0) {
      lineOpts.strokeDashArray = style.dashArray;
    }
    const line = new Line([x1, y1, x2, y2], lineOpts);
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

  // ========== F019: 绘制五角星 ==========

  drawStar(cx: number, cy: number, outerR: number, innerR?: number, numPoints = 5): void {
    if (!this.canvas) return;
    const opts = this.shapeOpts();
    const r2 = innerR ?? Math.round(outerR * 0.382);
    const vertices: { x: number; y: number }[] = [];
    // 从顶部开始，交替外顶点和内顶点
    for (let i = 0; i < numPoints * 2; i++) {
      const angle = (Math.PI / 2) * -1 + (Math.PI / numPoints) * i;
      const r = i % 2 === 0 ? outerR : r2;
      vertices.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    const star = new Polygon(vertices, { ...opts, originX: "center", originY: "center" });
    this.canvas.add(star);
    this.renderCanvas();
    console.log("[Canvas] 五角星已添加，对象数:", this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  // ========== F020: 绘制多边形 ==========

  drawPolygon(cx: number, cy: number, radius: number, sides: number): void {
    if (!this.canvas) return;
    const opts = this.shapeOpts();
    const vertices: { x: number; y: number }[] = [];
    // 从顶部开始
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI / 2) * -1 + (2 * Math.PI / sides) * i;
      vertices.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    const polygon = new Polygon(vertices, { ...opts, originX: "center", originY: "center" });
    this.canvas.add(polygon);
    this.renderCanvas();
    console.log(`[Canvas] ${sides}边形已添加，对象数:`, this.canvas.getObjects().length);
    this.saveSnapshot();
  }

  // ========== F023: 选中图形 ==========

  /** 获取画布绘制对象（排除网格线） */
  private getUserObjects(): FabricObject[] {
    if (!this.canvas) return [];
    return this.canvas.getObjects().filter(
      (o) => o.selectable !== false || o.evented !== false
    );
  }

  /** 选中最后绘制的图形 */
  selectLast(): FabricObject | null {
    if (!this.canvas) return null;
    const objs = this.getUserObjects();
    if (objs.length === 0) return null;
    const target = objs[objs.length - 1];
    this.canvas.setActiveObject(target);
    this.renderCanvas();
    console.log("[Canvas] 已选中最近图形:", target.type);
    return target;
  }

  /** 按类型选中第一个匹配的图形 */
  selectByType(type: string): FabricObject | null {
    if (!this.canvas) return null;
    const typeMap: Record<string, string> = {
      "圆": "circle", "圆形": "circle",
      "矩形": "rect", "长方形": "rect", "正方形": "rect",
      "三角": "triangle", "三角形": "triangle",
      "直线": "line", "线": "line",
      "五角星": "polygon", "星形": "polygon", "星星": "polygon",
      "多边形": "polygon",
    };
    const fabricType = typeMap[type] || type;
    const objs = this.getUserObjects();
    let target: FabricObject | null = null;
    for (let i = objs.length - 1; i >= 0; i--) {
      if (objs[i].type === fabricType) { target = objs[i]; break; }
    }
    if (!target) target = objs[objs.length - 1] ?? null;
    if (!target) return null;
    this.canvas.setActiveObject(target);
    this.renderCanvas();
    console.log("[Canvas] 按类型选中:", type, "→", target.type);
    return target;
  }

  /** 全选 */
  selectAll(): number {
    if (!this.canvas) return 0;
    const objs = this.getUserObjects();
    if (objs.length === 0) return 0;
    const sel = new ActiveSelection(objs, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    this.renderCanvas();
    console.log("[Canvas] 全选:", objs.length, "个对象");
    return objs.length;
  }

  /** 取消选中 */
  deselectAll(): void {
    if (!this.canvas) return;
    this.canvas.discardActiveObject();
    this.renderCanvas();
    console.log("[Canvas] 已取消选中");
  }

  // ========== F024: 移动图形 ==========

  moveSelected(direction: string, amount = 50): boolean {
    const obj = this.canvas?.getActiveObject();
    if (!obj) return false;
    const dx = direction === "left" ? -amount : direction === "right" ? amount : 0;
    const dy = direction === "up" ? -amount : direction === "down" ? amount : 0;
    obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
    obj.setCoords();
    this.renderCanvas();
    this.saveSnapshot();
    console.log("[Canvas] 图形移动:", direction, amount, "px");
    return true;
  }

  // ========== F025: 缩放图形 ==========

  scaleSelected(factor: number): boolean {
    const obj = this.canvas?.getActiveObject();
    if (!obj) return false;
    const newScaleX = Math.min(5, Math.max(0.2, (obj.scaleX ?? 1) * factor));
    const newScaleY = Math.min(5, Math.max(0.2, (obj.scaleY ?? 1) * factor));
    obj.set({ scaleX: newScaleX, scaleY: newScaleY });
    obj.setCoords();
    this.renderCanvas();
    this.saveSnapshot();
    console.log("[Canvas] 图形缩放: factor=", factor, "→", newScaleX);
    return true;
  }

  // ========== F026: 旋转图形 ==========

  rotateSelected(angle: number, absolute = false): boolean {
    const obj = this.canvas?.getActiveObject();
    if (!obj) return false;
    const newAngle = absolute ? angle : (obj.angle ?? 0) + angle;
    obj.set({ angle: ((newAngle % 360) + 360) % 360 });
    obj.setCoords();
    this.renderCanvas();
    this.saveSnapshot();
    console.log("[Canvas] 图形旋转:", angle, "° →", obj.angle, "°");
    return true;
  }

  // ========== F027: 复制粘贴 ==========

  private clipboard: FabricObject | null = null;

  copySelected(): boolean {
    const obj = this.canvas?.getActiveObject();
    if (!obj) return false;
    obj.clone().then((cloned: FabricObject) => {
      this.clipboard = cloned;
      console.log("[Canvas] 已复制图形到剪贴板");
    });
    return true;
  }

  pasteSelected(): FabricObject | null {
    if (!this.canvas || !this.clipboard) return null;
    this.clipboard.clone().then((cloned: FabricObject) => {
      cloned.set({
        left: (cloned.left ?? 0) + 30,
        top: (cloned.top ?? 0) + 30,
      });
      this.canvas!.add(cloned);
      this.canvas!.setActiveObject(cloned);
      this.renderCanvas();
      this.saveSnapshot();
      console.log("[Canvas] 已粘贴图形");
    });
    return null; // async, return immediately
  }

  // ========== F028: 翻转图形 ==========

  flipSelected(direction: "horizontal" | "vertical"): boolean {
    const obj = this.canvas?.getActiveObject();
    if (!obj) return false;
    if (direction === "horizontal") {
      obj.set({ flipX: !obj.flipX });
    } else {
      obj.set({ flipY: !obj.flipY });
    }
    obj.setCoords();
    this.renderCanvas();
    this.saveSnapshot();
    console.log("[Canvas] 图形翻转:", direction);
    return true;
  }


}

export const canvasManager = new CanvasManager();
(window as any).canvasManager = canvasManager;