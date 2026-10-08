"use client";
// UI state shared across the meeting page panels (which rail panel is open, transcript filters…).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type RailPanel = "search" | "index" | "soundbites" | "comments" | "bookmarks" | null;
export type RightTab = "transcript" | "askfred";

/** A Smart Search filter applied to the transcript ("4 Questions", "Pricing", "Negative"…). */
export interface TranscriptFilter {
  label: string;
  color: string;
  segmentIds: number[];
}

interface NotepadState {
  meetingId: number;
  panel: RailPanel;
  setPanel: (p: RailPanel) => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;
  filter: TranscriptFilter | null;
  setFilter: (f: TranscriptFilter | null) => void;
  /** Ask the transcript to scroll a segment into view (e.g. from a comment or bookmark). */
  focusSegment: number | null;
  setFocusSegment: (id: number | null) => void;
  /** Open the comment composer for a segment. */
  commentOn: number | null;
  setCommentOn: (id: number | null) => void;
}

const Ctx = createContext<NotepadState | null>(null);

export function useNotepad() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotepad must be used inside <NotepadProvider>");
  return ctx;
}

export function NotepadProvider({ meetingId, children }: { meetingId: number; children: ReactNode }) {
  const [panel, setPanel] = useState<RailPanel>(null);
  const [rightTab, setRightTab] = useState<RightTab>("transcript");
  const [filter, setFilter] = useState<TranscriptFilter | null>(null);
  const [focusSegment, setFocusSegment] = useState<number | null>(null);
  const [commentOn, setCommentOn] = useState<number | null>(null);
  const value = useMemo(
    () => ({ meetingId, panel, setPanel, rightTab, setRightTab, filter, setFilter, focusSegment, setFocusSegment, commentOn, setCommentOn }),
    [meetingId, panel, rightTab, filter, focusSegment, commentOn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
