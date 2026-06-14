// 工具注册表 — 集中管理所有 LLM 可调用的工具
// 从 instructions-spec.json 和 complexShapes 动态生成工具定义
// 新增工具只需编辑 JSON 配置或在此注册

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ToolDefinition } from "../../shared/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(__dirname, "../../shared/instructions-spec.json");
const spec = JSON.parse(readFileSync(specPath, "utf-8"));

// ========== 工具定义 ==========

function buildTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    // ---- 画布操作 ----
    {
      name: "new_canvas",
      description: "新建画布。用户想创建新画布、新图、开始绘画时调用。",
      parameters: {
        type: "object",
        properties: {
          width: { type: "number", description: "画布宽度（像素），默认800" },
          height: { type: "number", description: "画布高度（像素），默认600" },
        },
        required: [],
      },
    },
    {
      name: "clear_canvas",
      description: "清空画布上所有内容。用户说清空、清除、重置画布时调用。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "exit",
      description: "退出/休眠。用户说退出、关闭、休息时调用。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },

    // ---- 视图操作 ----
    {
      name: "canvas_zoom_in",
      description: "放大画布。用户说放大、变大时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "canvas_zoom_out",
      description: "缩小画布。用户说缩小、变小时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "canvas_zoom_reset",
      description: "恢复画布到原始大小。用户说恢复大小、原始大小、重置缩放时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "canvas_zoom_fit",
      description: "画布适应屏幕显示。用户说全屏、适应屏幕时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "canvas_pan",
      description: "平移画布视图。用户说移动画布、往某个方向移动时调用。",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", description: "平移方向" },
          amount: { type: "number", description: "平移像素量，默认50" },
        },
        required: [],
      },
    },

    // ---- 撤销重做 ----
    {
      name: "undo",
      description: "撤销上一步操作。用户说撤销、回退、上一步时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "redo",
      description: "重做被撤销的操作。用户说重做、恢复、下一步时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },

    // ---- 基础图形 ----
    {
      name: "draw_circle",
      description: "绘制圆形或椭圆。用户说画圆、画椭圆、画圈时调用。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "圆心X坐标（相对比例0~1），默认0.5" },
          y: { type: "number", description: "圆心Y坐标（相对比例0~1），默认0.5" },
          radius: { type: "number", description: "半径（像素），默认50" },
          fill: { type: "string", description: "填充颜色（十六进制），如#FF0000" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度" },
          opacity: { type: "number", description: "透明度0~1，默认1" },
        },
        required: [],
      },
    },
    {
      name: "draw_rectangle",
      description: "绘制矩形。用户说画矩形、画长方形、画方块时调用。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "矩形中心X坐标（相对比例0~1），默认0.5" },
          y: { type: "number", description: "矩形中心Y坐标（相对比例0~1），默认0.5" },
          width: { type: "number", description: "宽度（像素），默认100" },
          height: { type: "number", description: "高度（像素），默认80" },
          fill: { type: "string", description: "填充颜色" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度" },
          opacity: { type: "number", description: "透明度" },
        },
        required: [],
      },
    },
    {
      name: "draw_triangle",
      description: "绘制三角形。用户说画三角形时调用。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "三角形中心X坐标", default: 0.5 },
          y: { type: "number", description: "三角形中心Y坐标", default: 0.5 },
          size: { type: "number", description: "边长（像素），默认100" },
          fill: { type: "string", description: "填充颜色" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度" },
          opacity: { type: "number", description: "透明度" },
        },
        required: [],
      },
    },
    {
      name: "draw_star",
      description: "绘制五角星或多角星。用户说画星星、画五角星时调用。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "中心X坐标", default: 0.5 },
          y: { type: "number", description: "中心Y坐标", default: 0.5 },
          radius: { type: "number", description: "外半径（像素），默认60" },
          points: { type: "number", description: "角数，默认5", default: 5 },
          fill: { type: "string", description: "填充颜色" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度" },
          opacity: { type: "number", description: "透明度" },
        },
        required: [],
      },
    },
    {
      name: "draw_polygon",
      description: "绘制多边形（六边形、八边形等）。用户说画多边形、画六边形时调用。",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "中心X坐标", default: 0.5 },
          y: { type: "number", description: "中心Y坐标", default: 0.5 },
          radius: { type: "number", description: "外接圆半径，默认60" },
          sides: { type: "number", description: "边数（3-12），默认6", default: 6 },
          fill: { type: "string", description: "填充颜色" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度" },
          opacity: { type: "number", description: "透明度" },
        },
        required: [],
      },
    },
    {
      name: "draw_line",
      description: "绘制直线。用户说画线、画直线时调用。",
      parameters: {
        type: "object",
        properties: {
          x1: { type: "number", description: "起点X（相对比例）" },
          y1: { type: "number", description: "起点Y（相对比例）" },
          x2: { type: "number", description: "终点X（相对比例）" },
          y2: { type: "number", description: "终点Y（相对比例）" },
          stroke: { type: "string", description: "线条颜色" },
          strokeWidth: { type: "number", description: "线条粗细" },
        },
        required: [],
      },
    },

    // ---- 复杂图形（渲染器） ----
    {
      name: "draw_shape",
      description: "绘制复杂图形。支持：云朵、心形、箭头、圆角矩形、对话框、月牙、水滴、十字、雪花、太阳、花、树、不规则气泡。用户说画云、画爱心、画箭头、画树等时调用。",
      parameters: {
        type: "object",
        properties: {
          renderer: {
            type: "string",
            description: "图形渲染器名称",
            enum: spec.complexShapes.map((s: any) => s.renderer),
          },
          x: { type: "number", description: "中心X坐标（相对比例0~1），默认0.5" },
          y: { type: "number", description: "中心Y坐标（相对比例0~1），默认0.5" },
          size: { type: "number", description: "主尺寸（像素），默认100" },
          fill: { type: "string", description: "填充颜色（hex），如#FFFFFF" },
          stroke: { type: "string", description: "描边颜色" },
          strokeWidth: { type: "number", description: "描边宽度，默认1" },
          opacity: { type: "number", description: "透明度0~1，默认1" },
          rotation: { type: "number", description: "旋转角度（度）" },
          extras: {
            type: "object",
            description: "图形专属参数，如图层数、花瓣数、方向等",
          },
        },
        required: ["renderer"],
      },
    },

    // ---- 样式 ----
    {
      name: "brush_color",
      description: "设置画笔颜色。用户说换成红色、用蓝色画、设置颜色时调用。",
      parameters: {
        type: "object",
        properties: {
          color: { type: "string", description: "颜色hex值，如#FF0000" },
          colorName: { type: "string", description: "颜色中文名，如红色、蓝色" },
        },
        required: ["color"],
      },
    },
    {
      name: "brush_width",
      description: "设置画笔粗细。用户说画笔细一点、加粗线条时调用。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", description: "模式：increase增加/decrease减少/set设置", enum: ["increase", "decrease", "set"] },
          value: { type: "number", description: "目标粗细值（mode=set时）" },
          delta: { type: "number", description: "变化量（mode=increase/decrease时），默认1" },
        },
        required: ["mode"],
      },
    },
    {
      name: "fill_mode",
      description: "设置填充模式。用户说填充颜色、只画轮廓、空心时调用。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", description: "填充模式", enum: ["fill", "outline", "default"] },
          color: { type: "string", description: "填充颜色" },
        },
        required: ["mode"],
      },
    },
    {
      name: "line_style",
      description: "设置线条风格。用户说虚线、点线、实线时调用。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", description: "线条风格", enum: ["dashed", "dotted", "solid"] },
        },
        required: ["mode"],
      },
    },

    // ---- 图形编辑 ----
    {
      name: "select_shape",
      description: "选中画布上的图形。用户说选中圆形、选那个方框时调用。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "要选中的图形类型筛选" },
        },
        required: [],
      },
    },
    {
      name: "delete_shape",
      description: "删除选中的图形。用户说删除、删掉、擦除时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "move_shape",
      description: "移动选中的图形。用户说向上移、往左挪时调用。",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", description: "移动方向：up/down/left/right" },
          distance: { type: "number", description: "移动距离（像素），默认50" },
        },
        required: ["direction"],
      },
    },
    {
      name: "scale_shape",
      description: "缩放选中的图形。用户说放大图形、缩小一点时调用。",
      parameters: {
        type: "object",
        properties: {
          factor: { type: "number", description: "缩放倍数，>1放大<1缩小，默认1.2" },
        },
        required: [],
      },
    },
    {
      name: "rotate_shape",
      description: "旋转选中的图形。用户说旋转、转过来时调用。",
      parameters: {
        type: "object",
        properties: {
          angle: { type: "number", description: "旋转角度（度），默认45" },
        },
        required: [],
      },
    },
    {
      name: "copy_shape",
      description: "复制选中的图形。用户说复制、拷贝时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "paste_shape",
      description: "粘贴复制的图形。用户说粘贴时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      name: "flip_shape",
      description: "翻转选中的图形。用户说水平翻转、垂直翻转、镜像时调用。",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", description: "翻转方向", enum: ["horizontal", "vertical"] },
        },
        required: ["direction"],
      },
    },

    // ---- 修改图形属性 ----
    {
      name: "modify_shape",
      description: "修改选中图形的属性（颜色、透明度、边框等）。用户说把这个变成红色、加粗边框、半透明时调用。",
      parameters: {
        type: "object",
        properties: {
          fill: { type: "string", description: "新填充颜色" },
          stroke: { type: "string", description: "新描边颜色" },
          strokeWidth: { type: "number", description: "新描边宽度" },
          opacity: { type: "number", description: "新透明度0~1" },
        },
        required: [],
      },
    },

    // ---- 排列 ----
    {
      name: "arrange_shapes",
      description: "排列图形层次。用户说置顶、置于底层、上移一层、下移一层时调用。",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            description: "排列操作",
            enum: ["bring_to_front", "send_to_back", "bring_forward", "send_backward"],
          },
        },
        required: ["operation"],
      },
    },

    // ---- 文件 ----
    {
      name: "save_image",
      description: "保存画布为图片。用户说保存、导出、下载时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  ];

  return tools;
}

// ========== 颜色映射（供 system prompt 使用） ==========
function buildColorTable(): string {
  return spec.colors
    .map((c: any) => `- ${c.keyword}(${c.aliases?.join(",") || ""}): ${c.hex}`)
    .join("\n");
}

function buildPositionTable(): string {
  return spec.positions
    .map((p: any) => `- ${p.keyword}(${(p.aliases || []).join(",")}): x=${p.x}, y=${p.y}`)
    .join("\n");
}

function buildComplexShapeTable(): string {
  return (spec.complexShapes || [])
    .map((s: any) => `- ${s.renderer}(${(s.aliases || []).join(",")}): 默认大小${s.defaultParams?.size || 100}px`)
    .join("\n");
}

// ========== System Prompt ==========
function buildSystemPrompt(): string {
  return `你是一个语音绘图指令解析器。用户通过语音说出绘图指令，你需要调用合适的工具来执行操作。

## 重要规则
1. 必须调用工具来执行操作，不要只回复文字
2. 如果用户说的是闲聊或与绘图无关的内容，不调用任何工具
3. 位置参数(x, y)使用相对比例0~1，如中间=(0.5, 0.5)，左上=(0.2, 0.2)
4. 颜色参数使用十六进制格式如#FF0000
5. 复杂多步指令应依次调用多个工具
6. 单个复杂指令如果可以用一个工具完成就不要拆分（如"画一个红色的云"=一次draw_shape调用）

## 颜色参考
${buildColorTable()}

## 位置参考
${buildPositionTable()}

## 复杂图形参考
${buildComplexShapeTable()}

## 示例
- "画一个红色爱心" → draw_shape(renderer="heart", fill="#FF0000")
- "在右下角画一朵白云" → draw_shape(renderer="cloud", fill="#FFFFFF", x=0.8, y=0.8)
- "把选中的图形变成蓝色" → modify_shape(fill="#0066FF")
- "今天的天气真好" → 不调用工具`;
}

export { buildTools, buildSystemPrompt };