import { create } from "zustand";

export type AppStatus = "idle" | "sleeping" | "active";

export type FeedbackType = "success" | "error" | "confirm" | "guidance" | "info";

interface AppState {
  status: AppStatus;
  /** 最近一次识别到的原文（临时展示用） */
  lastRecognizedText: string;
  /** 语音识别是否就绪 */
  speechReady: boolean;

  /** F002: 最近一次语音反馈 */
  lastFeedbackType: FeedbackType | null;
  lastFeedbackMessage: string;

  setStatus: (status: AppStatus) => void;
  setLastRecognizedText: (text: string) => void;
  setSpeechReady: (ready: boolean) => void;
  setFeedback: (type: FeedbackType, message: string) => void;
  clearFeedback: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: "idle",
  lastRecognizedText: "",
  speechReady: false,

  lastFeedbackType: null,
  lastFeedbackMessage: "",

  setStatus: (status) => set({ status }),
  setLastRecognizedText: (text) => set({ lastRecognizedText: text }),
  setSpeechReady: (ready) => set({ speechReady: ready }),
  setFeedback: (type, message) =>
    set({ lastFeedbackType: type, lastFeedbackMessage: message }),
  clearFeedback: () =>
    set({ lastFeedbackType: null, lastFeedbackMessage: "" }),
}));
