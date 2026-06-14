import { create } from "zustand";

export type AppStatus = "idle" | "sleeping" | "active";

export type FeedbackType = "success" | "error" | "confirm" | "guidance" | "info";

export interface CanvasSize {
  width: number;
  height: number;
}

// 待确认操作
export interface PendingConfirm {
  question: string;
  action: () => void;
}

interface AppState {
  status: AppStatus;
  lastRecognizedText: string;
  speechReady: boolean;
  speechPaused: boolean;

  /* F002: 语音反馈 */
  lastFeedbackType: FeedbackType | null;
  lastFeedbackMessage: string;

  /* F003: 画布状态 */
  canvasConfig: CanvasSize | null;
  hasUnsavedContent: boolean;

  /* 待确认操作 */
  pendingConfirm: PendingConfirm | null;

  /* F005: 画布缩放级别 (0.1~5.0, 默认 1) */
  zoomLevel: number;

  /* F006~F009: 画笔样式 */
  brushColor: string;
  brushStrokeWidth: number;
  brushFill: string;

  /* F022: 线条风格（虚线/点划线/实线） */
  brushDashArray: number[];

  setStatus: (status: AppStatus) => void;
  setLastRecognizedText: (text: string) => void;
  setSpeechReady: (ready: boolean) => void;
  setSpeechPaused: (paused: boolean) => void;
  setFeedback: (type: FeedbackType, message: string) => void;
  clearFeedback: () => void;

  setCanvasConfig: (config: CanvasSize | null) => void;
  setHasUnsavedContent: (hasContent: boolean) => void;

  setPendingConfirm: (pending: PendingConfirm | null) => void;

  setZoomLevel: (zoom: number) => void;

  setBrushColor: (color: string) => void;
  setBrushStrokeWidth: (width: number) => void;
  setBrushFill: (fill: string) => void;
  setBrushDashArray: (dash: number[]) => void;
}

export const useAppStore = create<AppState>((set) => ({

  status: "idle",
  lastRecognizedText: "",
  speechReady: false,
  speechPaused: false,

  lastFeedbackType: null,
  lastFeedbackMessage: "",

  canvasConfig: null,
  hasUnsavedContent: false,

  pendingConfirm: null,

  zoomLevel: 1,

  brushColor: "#000000",
  brushStrokeWidth: 3,
  brushFill: "",
  brushDashArray: [],

  setStatus: (status) => set({ status }),
  setLastRecognizedText: (text) => set({ lastRecognizedText: text }),
  setSpeechReady: (ready) => set({ speechReady: ready }),
  setSpeechPaused: (paused) => set({ speechPaused: paused }),
  setFeedback: (type, message) =>
    set({ lastFeedbackType: type, lastFeedbackMessage: message }),
  clearFeedback: () =>
    set({ lastFeedbackType: null, lastFeedbackMessage: "" }),

  setCanvasConfig: (config) => set({ canvasConfig: config }),
  setHasUnsavedContent: (hasContent) => set({ hasUnsavedContent: hasContent }),

  setPendingConfirm: (pending) => set({ pendingConfirm: pending }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setBrushColor: (color) => set({ brushColor: color }),
  setBrushStrokeWidth: (width) => set({ brushStrokeWidth: width }),
  setBrushFill: (fill) => set({ brushFill: fill }),
  setBrushDashArray: (dash) => set({ brushDashArray: dash }),
}));

(window as any).__store = useAppStore;