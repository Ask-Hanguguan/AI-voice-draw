// 标准化图形渲染器注册表
// 三类渲染器：路径计算 / 原语组合 / 噪声有机
// LLM 只需指定 renderer 名 + 参数，前端查表执行

import { Canvas as FabricCanvas, FabricObject, Path, Circle, Ellipse, Rect, Triangle, Polygon, Line, Group, Point } from "fabric";
import type { RendererParams } from "@shared/types.ts";

type ShapeRenderer = (canvas: FabricCanvas, p: RendererParams) => FabricObject | null;

// ========== 统一渲染器接口 ==========



// ========== 缩放辅助 ==========

function scale(val: number, canvas: FabricCanvas): number {
  return val * Math.min(canvas.width || 800, canvas.height || 600) / 600;
}

// ========== 一类：路径计算渲染（算法 → SVG path → fabric.Path） ==========

// --- 云朵 ---
function renderCloud(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 120;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx - 35*s} ${cy + 5*s}`,
    `C ${cx - 40*s} ${cy - 15*s} ${cx - 20*s} ${cy - 25*s} ${cx - 5*s} ${cy - 20*s}`,
    `C ${cx - 5*s}  ${cy - 40*s} ${cx + 20*s} ${cy - 40*s} ${cx + 25*s} ${cy - 20*s}`,
    `C ${cx + 45*s} ${cy - 25*s} ${cx + 50*s} ${cy - 5*s}  ${cx + 35*s} ${cy + 5*s}`,
    `C ${cx + 40*s} ${cy + 15*s} ${cx + 20*s} ${cy + 20*s} ${cx}       ${cy + 10*s}`,
    `C ${cx - 20*s} ${cy + 20*s} ${cx - 35*s} ${cy + 15*s} ${cx - 35*s} ${cy + 5*s} Z`,
  ].join(" ");
  return new Path(path, {
    fill: p.fill || "white",
    stroke: p.stroke || "#cccccc",
    strokeWidth: p.strokeWidth ?? 1,
    opacity: p.opacity ?? 1,
  });
}

// --- 心形 ---
function renderHeart(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 120;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx} ${cy + 20*s}`,
    `C ${cx - 50*s} ${cy - 10*s} ${cx - 50*s} ${cy - 50*s} ${cx} ${cy - 25*s}`,
    `C ${cx + 50*s} ${cy - 50*s} ${cx + 50*s} ${cy - 10*s} ${cx} ${cy + 20*s} Z`,
  ].join(" ");
  return new Path(path, {
    fill: p.fill || "#e74c3c",
    stroke: p.stroke || "transparent",
    strokeWidth: p.strokeWidth ?? 0,
    opacity: p.opacity ?? 1,
  });
}

// --- N角星 ---
function renderStar(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const points = p.extras?.points || 5;
  const outerR = p.size / 2;
  const innerR = outerR * 0.4;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const coords: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(new Point(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
  }
  return new Polygon(coords, {
    fill: p.fill || "#ffcc00",
    stroke: p.stroke || "#cc9900",
    strokeWidth: p.strokeWidth ?? 1,
    opacity: p.opacity ?? 1,
  });
}

// --- 箭头（4方向） ---
function renderArrow(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const dir = String(p.extras?.direction || "right");
  const bodyW = 60 * s, bodyH = 16 * s, headW = 20 * s, headH = 25 * s;

  let parts: FabricObject[];
  switch (dir) {
    case "up":
      parts = [
        new Rect({ left: cx - bodyH/2, top: cy - bodyW/2, width: bodyH, height: bodyW, fill: p.fill }),
        new Triangle({ left: cx - headH/2, top: cy - bodyW/2 - headW, width: headH, height: headW, fill: p.fill, angle: 0 }),
      ];
      break;
    case "down":
      parts = [
        new Rect({ left: cx - bodyH/2, top: cy - bodyW/2, width: bodyH, height: bodyW, fill: p.fill }),
        new Triangle({ left: cx - headH/2, top: cy + bodyW/2, width: headH, height: headW, fill: p.fill, angle: 180 }),
      ];
      break;
    case "left":
      parts = [
        new Rect({ left: cx - bodyW/2, top: cy - bodyH/2, width: bodyW, height: bodyH, fill: p.fill }),
        new Triangle({ left: cx - bodyW/2 - headW, top: cy - headH/2, width: headW, height: headH, fill: p.fill, angle: -90 }),
      ];
      break;
    default: // right
      parts = [
        new Rect({ left: cx - bodyW/2, top: cy - bodyH/2, width: bodyW, height: bodyH, fill: p.fill }),
        new Triangle({ left: cx + bodyW/2, top: cy - headH/2, width: headW, height: headH, fill: p.fill, angle: 90 }),
      ];
  }
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 圆角矩形 ---
function renderRoundedRect(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const w = p.size * (p.aspect || 1.2);
  const h = p.size;
  const r = (p.extras?.cornerRadius as number) || Math.min(w, h) * 0.15;
  return new Rect({
    left: cx - w / 2, top: cy - h / 2,
    width: w, height: h,
    rx: r, ry: r,
    fill: p.fill || "#4a90d9",
    stroke: p.stroke || "#2c5f8a",
    strokeWidth: p.strokeWidth ?? 1,
    opacity: p.opacity ?? 1,
  });
}

// --- 对话框气泡 ---
function renderSpeechBubble(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const w = p.size * (p.aspect || 1.4);
  const h = p.size;
  const tailW = 20, tailH = 15, r = 12;
  const dir = String(p.extras?.direction || "bottom-right");
  const path = [
    `M ${cx - w/2 + r} ${cy - h/2}`,
    `L ${cx + w/2 - r} ${cy - h/2}`,
    `Q ${cx + w/2} ${cy - h/2} ${cx + w/2} ${cy - h/2 + r}`,
    `L ${cx + w/2} ${cy + h/2 - r}`,
    `Q ${cx + w/2} ${cy + h/2} ${cx + w/2 - r} ${cy + h/2}`,
    // tail
    `L ${cx + w/2 - 30} ${cy + h/2}`,
    `L ${cx + w/2 - 30 - tailW} ${cy + h/2 + tailH}`,
    `L ${cx + w/2 - 40 - tailW} ${cy + h/2}`,
    // rest of bottom
    `L ${cx - w/2 + r} ${cy + h/2}`,
    `Q ${cx - w/2} ${cy + h/2} ${cx - w/2} ${cy + h/2 - r}`,
    `L ${cx - w/2} ${cy - h/2 + r}`,
    `Q ${cx - w/2} ${cy - h/2} ${cx - w/2 + r} ${cy - h/2} Z`,
  ].join(" ");
  return new Path(path, {
    fill: p.fill || "white",
    stroke: p.stroke || "#333333",
    strokeWidth: p.strokeWidth ?? 1,
    opacity: p.opacity ?? 1,
  });
}

// --- 月牙 ---
function renderCrescent(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 60;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx + 10*s} ${cy - 28*s}`,
    `A 30 30 0 1 0 ${cx + 10*s} ${cy + 28*s}`,
    `A 24 30 0 1 1 ${cx + 10*s} ${cy - 28*s} Z`,
  ].join(" ");
  return new Path(path, {
    fill: p.fill || "#ffcc00",
    stroke: p.stroke || "transparent",
    strokeWidth: 0,
    opacity: p.opacity ?? 1,
  });
}

// --- 水滴 ---
function renderTeardrop(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 50;
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx} ${cy + 25*s}`,
    `C ${cx - 20*s} ${cy + 5*s} ${cx - 25*s} ${cy - 10*s} ${cx} ${cy - 25*s}`,
    `C ${cx + 25*s} ${cy - 10*s} ${cx + 20*s} ${cy + 5*s} ${cx} ${cy + 25*s} Z`,
  ].join(" ");
  return new Path(path, {
    fill: p.fill || "#3498db",
    stroke: p.stroke || "transparent",
    strokeWidth: 0,
    opacity: p.opacity ?? 1,
  });
}

// --- 十字 ---
function renderCross(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const armW = p.size * 0.25;
  const armH = p.size * 0.5;
  const parts = [
    new Rect({ left: cx - armW/2, top: cy - armH, width: armW, height: armH * 2, fill: p.fill }),
    new Rect({ left: cx - armH, top: cy - armW/2, width: armH * 2, height: armW, fill: p.fill }),
  ];
  return new Group(parts, {
    opacity: p.opacity ?? 1,
  });
}

// ========== 二类：原语组合渲染（多对象 → fabric.Group） ==========

// --- 雪花 ---
function renderSnowflake(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const arms = p.extras?.arms || 6;
  const armLen = p.size / 2;
  const parts: FabricObject[] = [];
  for (let i = 0; i < arms; i++) {
    const angle = (Math.PI * 2 / arms) * i;
    const x2 = cx + armLen * Math.cos(angle);
    const y2 = cy + armLen * Math.sin(angle);
    const line = new Line([cx, cy, x2, y2], {
      stroke: p.stroke || "#aaccee",
      strokeWidth: p.strokeWidth ?? 2,
    });
    // branchlets
    for (let j = 0.3; j < 0.9; j += 0.3) {
      const bx = cx + armLen * j * Math.cos(angle);
      const by = cy + armLen * j * Math.sin(angle);
      const bl = armLen * 0.2;
      const bx1 = bx + bl * Math.cos(angle + Math.PI / 3);
      const by1 = by + bl * Math.sin(angle + Math.PI / 3);
      const bx2 = bx + bl * Math.cos(angle - Math.PI / 3);
      const by2 = by + bl * Math.sin(angle - Math.PI / 3);
      parts.push(new Line([bx, by, bx1, by1], { stroke: p.stroke || "#aaccee", strokeWidth: 1 }));
      parts.push(new Line([bx, by, bx2, by2], { stroke: p.stroke || "#aaccee", strokeWidth: 1 }));
    }
    parts.push(line);
  }
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 太阳 ---
function renderSun(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const r = p.size * 0.35;
  const rays = p.extras?.rays || 8;
  const rayLen = p.size * 0.25;
  const parts: FabricObject[] = [];
  parts.push(new Circle({ left: cx - r, top: cy - r, radius: r, fill: p.fill || "#ffcc00" }));
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 / rays) * i;
    const x1 = cx + (r + 3) * Math.cos(angle);
    const y1 = cy + (r + 3) * Math.sin(angle);
    const x2 = cx + (r + rayLen) * Math.cos(angle);
    const y2 = cy + (r + rayLen) * Math.sin(angle);
    parts.push(new Line([x1, y1, x2, y2], { stroke: p.fill || "#ffcc00", strokeWidth: 3 }));
  }
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 花 ---
function renderFlower(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const petals = p.extras?.petals || 5;
  const petalW = p.size * 0.22;
  const petalH = p.size * 0.45;
  const parts: FabricObject[] = [];
  for (let i = 0; i < petals; i++) {
    const angle = (Math.PI * 2 / petals) * i;
    const px = cx + petalH * 0.6 * Math.cos(angle);
    const py = cy + petalH * 0.6 * Math.sin(angle);
    const petal = new Ellipse({
      left: px - petalW / 2, top: py - petalH / 2,
      rx: petalW, ry: petalH,
      fill: p.fill || "#ff69b4",
      stroke: p.stroke || "#cc5599",
      strokeWidth: 1,
      angle: (angle * 180) / Math.PI,
    });
    parts.push(petal);
  }
  parts.push(new Circle({ left: cx - petalW, top: cy - petalW, radius: petalW, fill: String(p.extras?.centerColor || "#ffcc00") || "#ffcc00" }));
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 树 ---
function renderTree(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const trunkW = p.size * 0.15;
  const trunkH = p.size * 0.4;
  const crownR = p.size * 0.35;
  const levels = p.extras?.levels || 3;
  const parts: FabricObject[] = [];
  // trunk
  parts.push(new Rect({
    left: cx - trunkW / 2, top: cy - trunkH * 0.3,
    width: trunkW, height: trunkH,
    fill: String(p.extras?.trunkColor || "#8B4513") || "#8B4513",
  }));
  // layered crown
  for (let i = 0; i < levels; i++) {
    const yOff = -(trunkH * 0.3 + crownR * (i + 0.3));
    const scaleFactor = 1 - i * 0.2;
    const r = crownR * scaleFactor;
    parts.push(new Circle({
      left: cx - r, top: cy + yOff - r,
      radius: r,
      fill: p.fill || "#2d6a4f",
      stroke: p.stroke || "#1b4332",
      strokeWidth: 1,
    }));
  }
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// ========== 三类：噪声/有机渲染 ==========

// --- 不规则气泡（噪音扰动） ---
function renderBlob(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const cx = p.x * (canvas.width || 800);
  const cy = p.y * (canvas.height || 600);
  const baseR = p.size / 2;
  const segments = p.extras?.segments || 24;
  const noise = p.extras?.noise || 0.2;
  const seed = p.extras?.seed || 42;
  // simple pseudo-random using seed
  const rand = (i: number) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const coords: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (Math.PI * 2 / segments) * i;
    const r = baseR * (1 + (rand(i) - 0.5) * noise * 2);
    coords.push(new Point(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
  }
  return new Polygon(coords, {
    fill: p.fill || "rgba(100,150,255,0.3)",
    stroke: p.stroke || "rgba(100,150,255,0.6)",
    strokeWidth: p.strokeWidth ?? 1,
    opacity: p.opacity ?? 1,
  });
}

// ========== 注册表 ==========

const registry: Record<string, ShapeRenderer> = {
  cloud: renderCloud,
  heart: renderHeart,
  star: renderStar,
  arrow: renderArrow,
  rounded_rect: renderRoundedRect,
  speech_bubble: renderSpeechBubble,
  crescent: renderCrescent,
  teardrop: renderTeardrop,
  cross: renderCross,
  snowflake: renderSnowflake,
  sun: renderSun,
  flower: renderFlower,
  tree: renderTree,
  blob: renderBlob,
};

/**
 * 执行图形渲染
 * @param rendererName 渲染器名称
 * @param canvas Fabric canvas 实例
 * @param params 渲染参数
 * @returns 渲染出的 FabricObject，或 null（未知渲染器）
 */
export function drawShape(
  rendererName: string,
  canvas: FabricCanvas,
  params: RendererParams,
): FabricObject | null {
  const renderer = registry[rendererName];
  if (!renderer) {
    console.warn(`[ShapeGen] Unknown renderer: "${rendererName}". Available:`, Object.keys(registry));
    return null;
  }
  console.log(`[ShapeGen] 调用渲染器 "${rendererName}" 参数:`, JSON.stringify(params));
  const obj = renderer(canvas, params);
  if (obj) {
    console.log(`[ShapeGen] 渲染成功，类型: ${obj.type}，添加到画布...`);
    canvas.add(obj);
    canvas.requestRenderAll();
    console.log(`[ShapeGen] 已添加，画布对象数: ${canvas.getObjects().length}`);
  } else {
    console.warn(`[ShapeGen] 渲染器 "${rendererName}" 返回 null/undefined`);
  }
  return obj;
}

/**
 * 获取所有可用渲染器名称及其别名
 */
export function getAvailableShapes(): Array<{ renderer: string; aliases: string[] }> {
  return [
    { renderer: "cloud", aliases: ["云", "云朵", "白云", "乌云"] },
    { renderer: "heart", aliases: ["心形", "爱心", "心"] },
    { renderer: "star", aliases: ["星形", "星星", "五角星", "六角星"] },
    { renderer: "arrow", aliases: ["箭头", "方向箭头"] },
    { renderer: "rounded_rect", aliases: ["圆角矩形", "圆角方形"] },
    { renderer: "speech_bubble", aliases: ["对话框", "气泡", "聊天气泡"] },
    { renderer: "crescent", aliases: ["月牙", "月亮", "弯月"] },
    { renderer: "teardrop", aliases: ["水滴", "雨滴", "泪滴"] },
    { renderer: "cross", aliases: ["十字", "加号", "十字形"] },
    { renderer: "snowflake", aliases: ["雪花", "雪花形"] },
    { renderer: "sun", aliases: ["太阳", "阳光"] },
    { renderer: "flower", aliases: ["花", "花朵", "小花"] },
    { renderer: "tree", aliases: ["树", "树木", "大树", "小树"] },
    { renderer: "blob", aliases: ["气泡", "不规则圆形", "斑点"] },
  ];
}

/**
 * 根据中文别名查找渲染器名
 */
export function resolveRendererName(alias: string): string | null {
  for (const shape of getAvailableShapes()) {
    if (shape.aliases.includes(alias)) return shape.renderer;
    if (shape.renderer === alias) return shape.renderer;
  }
  return null;
}
