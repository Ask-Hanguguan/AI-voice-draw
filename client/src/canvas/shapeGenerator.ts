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

// ========== 新增渲染器（15 个常见物体） ==========

// --- 猫 ---
function renderCat(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 120; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx - 35*s} ${cy + 10*s}`,
    `C ${cx - 40*s} ${cy - 30*s} ${cx - 15*s} ${cy - 45*s} ${cx} ${cy - 35*s}`,
    `C ${cx + 15*s} ${cy - 45*s} ${cx + 40*s} ${cy - 30*s} ${cx + 35*s} ${cy + 10*s}`,
    `C ${cx + 40*s} ${cy + 30*s} ${cx + 20*s} ${cy + 40*s} ${cx} ${cy + 25*s}`,
    `C ${cx - 20*s} ${cy + 40*s} ${cx - 40*s} ${cy + 30*s} ${cx - 35*s} ${cy + 10*s} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#808080", stroke: p.stroke || "#555", strokeWidth: p.strokeWidth ?? 1.5 }),
    // ears
    new Polygon([{x: cx-30*s, y: cy-35*s}, {x: cx-20*s, y: cy-55*s}, {x: cx-8*s, y: cy-35*s}], { fill: p.fill || "#808080" }),
    new Polygon([{x: cx+30*s, y: cy-35*s}, {x: cx+20*s, y: cy-55*s}, {x: cx+8*s, y: cy-35*s}], { fill: p.fill || "#808080" }),
    // eyes
    new Ellipse({ left: cx-12*s, top: cy-15*s, rx: 5*s, ry: 6*s, fill: "#fff" }),
    new Ellipse({ left: cx+7*s, top: cy-15*s, rx: 5*s, ry: 6*s, fill: "#fff" }),
    new Circle({ left: cx-10*s, top: cy-13*s, radius: 2.5*s, fill: "#333" }),
    new Circle({ left: cx+9*s, top: cy-13*s, radius: 2.5*s, fill: "#333" }),
    // nose
    new Polygon([{x: cx-3*s, y: cy-2*s}, {x: cx+3*s, y: cy-2*s}, {x: cx, y: cy+3*s}], { fill: "#ff9999" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 狗 ---
function renderDog(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 120; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx - 30*s} ${cy}`,
    `C ${cx - 40*s} ${cy - 25*s} ${cx - 30*s} ${cy - 45*s} ${cx - 5*s} ${cy - 35*s}`,
    `L ${cx + 15*s} ${cy - 45*s}`,
    `L ${cx + 35*s} ${cy - 35*s}`,
    `C ${cx + 50*s} ${cy - 20*s} ${cx + 40*s} ${cy + 10*s} ${cx + 25*s} ${cy + 15*s}`,
    `C ${cx + 10*s} ${cy + 20*s} ${cx - 10*s} ${cy + 20*s} ${cx - 30*s} ${cy} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#c8956c", stroke: p.stroke || "#8b5e3c", strokeWidth: p.strokeWidth ?? 1.5 }),
    // eye
    new Circle({ left: cx+8*s, top: cy-12*s, radius: 4*s, fill: "#333" }),
    // nose
    new Ellipse({ left: cx-12*s, top: cy-8*s, rx: 6*s, ry: 4*s, fill: "#333" }),
    // tongue
    new Ellipse({ left: cx-8*s, top: cy+2*s, rx: 3*s, ry: 5*s, fill: "#ff6666" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 鸟 ---
function renderBird(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx - 25*s} ${cy - 5*s}`,
    `C ${cx - 30*s} ${cy - 20*s} ${cx - 15*s} ${cy - 30*s} ${cx} ${cy - 20*s}`,
    `C ${cx + 15*s} ${cy - 30*s} ${cx + 30*s} ${cy - 20*s} ${cx + 25*s} ${cy - 5*s}`,
    `C ${cx + 20*s} ${cy + 5*s} ${cx + 5*s} ${cy + 10*s} ${cx} ${cy}`,
    `C ${cx - 5*s} ${cy + 10*s} ${cx - 20*s} ${cy + 5*s} ${cx - 25*s} ${cy - 5*s} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#e74c3c", stroke: p.stroke || "#c0392b", strokeWidth: p.strokeWidth ?? 1 }),
    // eye
    new Circle({ left: cx+8*s, top: cy-12*s, radius: 2.5*s, fill: "#fff" }),
    new Circle({ left: cx+9*s, top: cy-11*s, radius: 1.2*s, fill: "#000" }),
    // beak
    new Polygon([{x: cx+22*s, y: cy-5*s}, {x: cx+30*s, y: cy-2*s}, {x: cx+22*s, y: cy+2*s}], { fill: "#f39c12" }),
    // wing
    new Path(`M ${cx-5*s} ${cy-15*s} Q ${cx-15*s} ${cy} ${cx} ${cy-3*s}`, { fill: "none", stroke: "#c0392b", strokeWidth: 2 }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 鱼 ---
function renderFish(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 100; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx - 40*s} ${cy}`,
    `C ${cx - 30*s} ${cy - 25*s} ${cx + 20*s} ${cy - 25*s} ${cx + 40*s} ${cy}`,
    `C ${cx + 20*s} ${cy + 25*s} ${cx - 30*s} ${cy + 25*s} ${cx - 40*s} ${cy} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#f39c12", stroke: p.stroke || "#e67e22", strokeWidth: p.strokeWidth ?? 1 }),
    // tail
    new Polygon([{x: cx-35*s, y: cy}, {x: cx-50*s, y: cy-20*s}, {x: cx-50*s, y: cy+20*s}], { fill: p.fill || "#f39c12" }),
    // eye
    new Circle({ left: cx+20*s, top: cy-6*s, radius: 4*s, fill: "#fff" }),
    new Circle({ left: cx+22*s, top: cy-5*s, radius: 2*s, fill: "#000" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 蝴蝶 ---
function renderButterfly(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    // body
    new Ellipse({ left: cx-3*s, top: cy-20*s, rx: 3*s, ry: 20*s, fill: "#333" }),
    // upper left wing
    new Path(`M ${cx} ${cy-10*s} C ${cx-25*s} ${cy-30*s} ${cx-35*s} ${cy-5*s} ${cx} ${cy}`, { fill: p.fill || "#e91e63", stroke: "#c2185b", strokeWidth: 1 }),
    // upper right wing
    new Path(`M ${cx} ${cy-10*s} C ${cx+25*s} ${cy-30*s} ${cx+35*s} ${cy-5*s} ${cx} ${cy}`, { fill: p.fill || "#e91e63", stroke: "#c2185b", strokeWidth: 1 }),
    // lower left wing
    new Path(`M ${cx} ${cy} C ${cx-20*s} ${cy+5*s} ${cx-25*s} ${cy+20*s} ${cx} ${cy+10*s}`, { fill: "#f48fb1", stroke: "#c2185b", strokeWidth: 1 }),
    // lower right wing
    new Path(`M ${cx} ${cy} C ${cx+20*s} ${cy+5*s} ${cx+25*s} ${cy+20*s} ${cx} ${cy+10*s}`, { fill: "#f48fb1", stroke: "#c2185b", strokeWidth: 1 }),
    // antennae
    new Line([cx-2*s, cy-18*s, cx-8*s, cy-32*s], { stroke: "#333", strokeWidth: 1 }),
    new Line([cx+2*s, cy-18*s, cx+8*s, cy-32*s], { stroke: "#333", strokeWidth: 1 }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 房子 ---
function renderHouse(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 100; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Rect({ left: cx-35*s, top: cy-5*s, width: 70*s, height: 45*s, fill: p.fill || "#f5deb3", stroke: p.stroke || "#8b7355", strokeWidth: p.strokeWidth ?? 2 }),
    new Polygon([{x: cx-42*s, y: cy-5*s}, {x: cx, y: cy-35*s}, {x: cx+42*s, y: cy-5*s}], { fill: "#c0392b", stroke: "#8b0000", strokeWidth: 2 }),
    new Rect({ left: cx-8*s, top: cy+15*s, width: 16*s, height: 25*s, fill: "#8b4513" }),
    new Rect({ left: cx-28*s, top: cy, width: 12*s, height: 12*s, fill: "#87ceeb", stroke: "#5f9ea0", strokeWidth: 1 }),
    new Rect({ left: cx+16*s, top: cy, width: 12*s, height: 12*s, fill: "#87ceeb", stroke: "#5f9ea0", strokeWidth: 1 }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 汽车 ---
function renderCar(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 150; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    // body lower
    new Rect({ left: cx-70*s, top: cy-10*s, width: 140*s, height: 30*s, rx: 8*s, ry: 8*s, fill: p.fill || "#e74c3c" }),
    // body upper
    new Path(`M ${cx-40*s} ${cy-10*s} L ${cx-25*s} ${cy-30*s} L ${cx+35*s} ${cy-30*s} L ${cx+50*s} ${cy-10*s} Z`, { fill: p.fill || "#e74c3c", stroke: "#c0392b", strokeWidth: 2 }),
    // windows
    new Path(`M ${cx-22*s} ${cy-12*s} L ${cx-8*s} ${cy-27*s} L ${cx+12*s} ${cy-12*s} Z`, { fill: "#87ceeb", stroke: "#5f9ea0", strokeWidth: 1 }),
    new Path(`M ${cx+14*s} ${cy-12*s} L ${cx+30*s} ${cy-27*s} L ${cx+47*s} ${cy-12*s} Z`, { fill: "#87ceeb", stroke: "#5f9ea0", strokeWidth: 1 }),
    // wheels
    new Circle({ left: cx-45*s, top: cy+15*s, radius: 12*s, fill: "#333" }),
    new Circle({ left: cx-45*s, top: cy+15*s, radius: 5*s, fill: "#888" }),
    new Circle({ left: cx+30*s, top: cy+15*s, radius: 12*s, fill: "#333" }),
    new Circle({ left: cx+30*s, top: cy+15*s, radius: 5*s, fill: "#888" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 船 ---
function renderBoat(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 100; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Path(`M ${cx-45*s} ${cy} L ${cx-35*s} ${cy+15*s} L ${cx+35*s} ${cy+15*s} L ${cx+45*s} ${cy} Z`, { fill: "#8b4513", stroke: "#5c2e00", strokeWidth: 2 }),
    new Rect({ left: cx-5*s, top: cy-10*s, width: 3*s, height: -40*s, fill: "#5c2e00" }),
    new Polygon([{x: cx-3*s, y: cy-40*s}, {x: cx+30*s, y: cy-25*s}, {x: cx-3*s, y: cy-10*s}], { fill: "#fff", stroke: "#ddd", strokeWidth: 1 }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 山 ---
function renderMountain(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 120; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Polygon([{x: cx-70*s, y: cy+35*s}, {x: cx-20*s, y: cy-40*s}, {x: cx+25*s, y: cy+35*s}], { fill: "#7f8c8d", stroke: "#636e72", strokeWidth: 2 }),
    new Polygon([{x: cx-5*s, y: cy+35*s}, {x: cx+30*s, y: cy-25*s}, {x: cx+70*s, y: cy+35*s}], { fill: "#95a5a6", stroke: "#636e72", strokeWidth: 2 }),
    // snow cap
    new Polygon([{x: cx-24*s, y: cy-20*s}, {x: cx-20*s, y: cy-40*s}, {x: cx-12*s, y: cy-20*s}], { fill: "#fff", stroke: "none" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 闪电 ---
function renderLightning(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 100; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx-5*s} ${cy-50*s}`,
    `L ${cx+20*s} ${cy-15*s}`,
    `L ${cx+5*s} ${cy-10*s}`,
    `L ${cx+15*s} ${cy+35*s}`,
    `L ${cx-15*s} ${cy}`,
    `L ${cx-5*s} ${cy-5*s}`,
    `L ${cx-25*s} ${cy-20*s} Z`,
  ].join(" ");
  return new Path(path, { fill: p.fill || "#f1c40f", stroke: p.stroke || "#d4a017", strokeWidth: p.strokeWidth ?? 2, opacity: p.opacity ?? 1 });
}

// --- 音符 ---
function renderMusicNote(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 50; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Ellipse({ left: cx-12*s, top: cy+10*s, rx: 8*s, ry: 6*s, fill: "#333" }),
    new Rect({ left: cx+2*s, top: cy-30*s, width: 2.5*s, height: 42*s, fill: "#333" }),
    new Path(`M ${cx+4*s} ${cy-30*s} Q ${cx+20*s} ${cy-28*s} ${cx+20*s} ${cy-15*s} Q ${cx+15*s} ${cy-18*s} ${cx+4*s} ${cy-20*s}`, { fill: "#333" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 蘑菇 ---
function renderMushroom(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Path(`M ${cx-30*s} ${cy} C ${cx-30*s} ${cy-35*s} ${cx+30*s} ${cy-35*s} ${cx+30*s} ${cy} Z`, { fill: p.fill || "#e74c3c", stroke: "#c0392b", strokeWidth: 1.5 }),
    new Rect({ left: cx-8*s, top: cy, width: 16*s, height: 22*s, fill: "#f5deb3", stroke: "#d2b48c", strokeWidth: 1 }),
    new Circle({ left: cx-8*s, top: cy-20*s, radius: 3*s, fill: "#fff" }),
    new Circle({ left: cx+5*s, top: cy-15*s, radius: 2*s, fill: "#fff" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 叶子 ---
function renderLeaf(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx} ${cy - 40*s}`,
    `C ${cx - 25*s} ${cy - 20*s} ${cx - 25*s} ${cy + 10*s} ${cx} ${cy + 40*s}`,
    `C ${cx + 25*s} ${cy + 10*s} ${cx + 25*s} ${cy - 20*s} ${cx} ${cy - 40*s} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#2ecc71", stroke: p.stroke || "#27ae60", strokeWidth: p.strokeWidth ?? 1 }),
    new Line([cx, cy-35*s, cx, cy+38*s], { stroke: "#27ae60", strokeWidth: 1.5 }),
    // veins
    new Line([cx, cy-15*s, cx-12*s, cy-5*s], { stroke: "#27ae60", strokeWidth: 0.8 }),
    new Line([cx, cy+5*s, cx+12*s, cy+15*s], { stroke: "#27ae60", strokeWidth: 0.8 }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 眼睛 ---
function renderEye(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const parts: FabricObject[] = [
    new Ellipse({ left: cx-35*s, top: cy-20*s, rx: 35*s, ry: 20*s, fill: "#fff", stroke: "#333", strokeWidth: 2 }),
    new Circle({ left: cx-8*s, top: cy-8*s, radius: 12*s, fill: p.fill || "#3498db" }),
    new Circle({ left: cx-4*s, top: cy-4*s, radius: 5*s, fill: "#000" }),
    new Circle({ left: cx-6*s, top: cy-6*s, radius: 1.5*s, fill: "#fff" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
}

// --- 皇冠 ---
function renderCrown(canvas: FabricCanvas, p: RendererParams): FabricObject {
  const s = p.size / 80; const cx = p.x * (canvas.width || 800); const cy = p.y * (canvas.height || 600);
  const path = [
    `M ${cx-40*s} ${cy+25*s}`,
    `L ${cx-35*s} ${cy-10*s}`,
    `L ${cx-20*s} ${cy+5*s}`,
    `L ${cx} ${cy-25*s}`,
    `L ${cx+20*s} ${cy+5*s}`,
    `L ${cx+35*s} ${cy-10*s}`,
    `L ${cx+40*s} ${cy+25*s} Z`,
  ].join(" ");
  const parts: FabricObject[] = [
    new Path(path, { fill: p.fill || "#f1c40f", stroke: p.stroke || "#d4a017", strokeWidth: p.strokeWidth ?? 2 }),
    new Rect({ left: cx-42*s, top: cy+25*s, width: 84*s, height: 10*s, fill: p.fill || "#f1c40f", stroke: "#d4a017", strokeWidth: 1 }),
    // jewels
    new Circle({ left: cx-20*s, top: cy+10*s, radius: 3*s, fill: "#e74c3c" }),
    new Circle({ left: cx, top: cy-8*s, radius: 4*s, fill: "#3498db" }),
    new Circle({ left: cx+17*s, top: cy+10*s, radius: 3*s, fill: "#2ecc71" }),
  ];
  return new Group(parts, { opacity: p.opacity ?? 1 });
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
  cat: renderCat,
  dog: renderDog,
  bird: renderBird,
  fish: renderFish,
  butterfly: renderButterfly,
  house: renderHouse,
  car: renderCar,
  boat: renderBoat,
  mountain: renderMountain,
  lightning: renderLightning,
  music_note: renderMusicNote,
  mushroom: renderMushroom,
  leaf: renderLeaf,
  eye: renderEye,
  crown: renderCrown,
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
    { renderer: "cat", aliases: ["猫", "小猫", "猫咪"] },
    { renderer: "dog", aliases: ["狗", "小狗", "狗狗"] },
    { renderer: "bird", aliases: ["鸟", "小鸟", "鸟儿"] },
    { renderer: "fish", aliases: ["鱼", "小鱼", "鱼儿"] },
    { renderer: "butterfly", aliases: ["蝴蝶", "蝴蝶形"] },
    { renderer: "house", aliases: ["房子", "房屋", "屋子"] },
    { renderer: "car", aliases: ["汽车", "车", "小车"] },
    { renderer: "boat", aliases: ["船", "小船", "帆船"] },
    { renderer: "mountain", aliases: ["山", "山峰", "山脉"] },
    { renderer: "lightning", aliases: ["闪电", "雷电"] },
    { renderer: "music_note", aliases: ["音符", "音乐符号", "乐符"] },
    { renderer: "mushroom", aliases: ["蘑菇", "菌菇"] },
    { renderer: "leaf", aliases: ["叶子", "树叶", "叶片"] },
    { renderer: "eye", aliases: ["眼睛", "眼球"] },
    { renderer: "crown", aliases: ["皇冠", "王冠", "王冕"] },
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
