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

  /* F002: 语音反馈 */
  lastFeedbackType: FeedbackType | null;
  lastFeedbackMessage: string;

  /* F003: 画布状态 */
  canvasConfig: CanvasSize | null;
  hasUnsavedContent: boolean;

  /* 待确认操作 */
  pendingConfirm: PendingConfirm | null;

  setStatus: (status: AppStatus) => void;
  setLastRecognizedText: (text: string) => void;
  setSpeechReady: (ready: boolean) => void;
  setFeedback: (type: FeedbackType, message: string) => void;
  clearFeedback: () => void;

  setCanvasConfig: (config: CanvasSize | null) => void;
  setHasUnsavedContent: (hasContent: boolean) => void;

  setPendingConfirm: (pending: PendingConfirm | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: "idle",
  lastRecognizedText: "",
  speechReady: false,

  lastFeedbackType: null,
  lastFeedbackMessage: "",

  canvasConfig: null,
  hasUnsavedContent: false,

  pendingConfirm: null,

  setStatus: (status) => set({ status }),
  setLastRecognizedText: (text) => set({ lastRecognizedText: text }),
  setSpeechReady: (ready) => set({ speechReady: ready }),
  setFeedback: (type, message) =>
    set({ lastFeedbackType: type, lastFeedbackMessage: message }),
  clearFeedback: () =>
    set({ lastFeedbackType: null, lastFeedbackMessage: "" }),

  setCanvasConfig: (config) => set({ canvasConfig: config }),
  setHasUnsavedContent: (hasContent) => set({ hasUnsavedContent: hasContent }),

  setPendingConfirm: (pending) => set({ pendingConfirm: pending }),
}));
