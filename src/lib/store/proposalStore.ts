"use client";

import { create } from "zustand";
import type { CVData } from "@/lib/cv/schema";
import { cvHash, type Proposal, type ProposalTool } from "@/lib/tailor/proposal";

/**
 * Open Tailor proposals and the last applied one. Held in memory only: each
 * tool already persists its own run, and re-registers its proposal on restore.
 */
interface AppliedStep {
  tool: ProposalTool;
  /** The CV before the accept, restored by undo. */
  previous: CVData;
  /** Hash of the CV the accept produced; undo only runs while it still matches. */
  resultHash: string;
}

interface ProposalState {
  proposals: Proposal[];
  lastApplied: AppliedStep | null;
  /** Add or replace the open proposal for a tool (one per tool). */
  register: (tool: ProposalTool, base: CVData, after: CVData) => void;
  discard: (tool: ProposalTool) => void;
  /** Record an accept as one undoable step and close that tool's proposal. */
  recordApplied: (tool: ProposalTool, previous: CVData, result: CVData) => void;
  clearApplied: () => void;
}

export const useProposalStore = create<ProposalState>()((set) => ({
  proposals: [],
  lastApplied: null,
  register: (tool, base, after) =>
    set((s) => {
      const existing = s.proposals.find((p) => p.tool === tool);
      if (existing && existing.base === base && existing.after === after) return s;
      const next: Proposal = { id: `${tool}-${Date.now()}`, tool, base, after, createdAt: Date.now() };
      return { proposals: [...s.proposals.filter((p) => p.tool !== tool), next] };
    }),
  discard: (tool) => set((s) => ({ proposals: s.proposals.filter((p) => p.tool !== tool) })),
  recordApplied: (tool, previous, result) =>
    set((s) => ({
      proposals: s.proposals.filter((p) => p.tool !== tool),
      lastApplied: { tool, previous, resultHash: cvHash(result) },
    })),
  clearApplied: () => set({ lastApplied: null }),
}));
