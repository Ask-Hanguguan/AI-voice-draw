import { create } from "zustand";

export type AppStatus = "sleeping" | "active";

interface AppState {
  status: AppStatus;
  /** 最近一次识别到的原文（临时展示用） */
  lastRecognizedText: string;
  /** 语音识别是否就绪 */
  speechReady: boolean;

  setStatus: (status: AppStatus) => void;
  setLastRecognizedText: (text: string) => void;
  setSpeechReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: "sleeping",
  lastRecognizedText: "",
  speechReady: false,

  setStatus: (status) => set({ status }),
  setLastRecognizedText: (text) => set({ lastRecognizedText: text }),
  setSpeechReady: (ready) => set({ speechReady: ready }),
}));
