"use client";

import { create } from "zustand";
import {
  finishRun, isFinished, markStep, startRun, stopAtCap,
  type RunAllState, type RunStep,
} from "@/lib/tailor/runAll";

interface RunAllStore {
  run: RunAllState | null;
  start: (before: number) => void;
  advance: (step: RunStep, status: "done" | "skipped", score: number) => void;
  cap: (step: RunStep, score: number) => void;
  close: () => void;
}

const settle = (r: RunAllState, score: number) => (isFinished(r) ? finishRun(r, score) : r);

export const useRunAllStore = create<RunAllStore>((set) => ({
  run: null,
  start: (before) => set({ run: startRun(before) }),
  advance: (step, status, score) => set((s) => (s.run ? { run: settle(markStep(s.run, step, status), score) } : s)),
  cap: (step, score) => set((s) => (s.run ? { run: settle(stopAtCap(s.run, step), score) } : s)),
  close: () => set({ run: null }),
}));
