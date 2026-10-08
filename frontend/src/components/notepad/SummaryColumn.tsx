"use client";

import { ChevronDown, ChevronUp, Copy, Globe2, Maximize2, Minimize2, Pencil, Plus, RefreshCw, Sparkles, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Segmented, Textarea } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatLongDate, formatTimestamp } from "@/lib/format";
import { useMeetingMutation } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionItems } from "./ActionItems";
import { Timestamp } from "./Timestamp";

/** Summary "templates": different views over the same AI notes. */
export const TEMPLATES = [
  { value: "general", label: "General Summary" },
  { value: "bullets", label: "Bullet Points" },
  { value: "actions", label: "Action Items" },
  { value: "outline", label: "Outline" },
] as const;
type Template = (typeof TEMPLATES)[number]["value"];

const AI_SKILLS = [
  { name: "Follow-up email", description: "Draft a recap email to attendees with decisions and next steps." },
  { name: "Sales call scorecard", description: "Score the call on BANT and highlight objections." },
  { name: "Meeting coach", description: "Talk-time balance, questions asked and filler words." },
  { name: "CRM notes", description: "Format notes for HubSpot / Salesforce." },
];

function Section({ id, title, children, collapsible = true }: { id: string; title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className="scroll-mt-6 pt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-medium text-ink">{title}</h2>
        {collapsible && (
          <button onClick={() => setOpen(!open)} aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            className="rounded-md border border-line p-0.5 text-ink-4 hover:bg-muted">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>
      {open && children}
    </section>
  );
}

/** Splits "Heading: body" bullets so the lead phrase can be bolded like Fireflies does. */
function Bullet({ text }: { text: string }) {
  const m = text.match(/^([^:]{3,48}):\s+(.+)$/);
  return m ? <><b className="font-semibold text-ink">{m[1]}:</b> {m[2]}</> : <>{text}</>;
}

/** Overview paragraph → bullet list (one bullet per sentence), as in the current Fireflies notes. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).filter(Boolean);

export function SummaryColumn({ meeting, expanded, onToggleExpand }: { meeting: MeetingDetail; expanded: boolean; onToggleExpand: () => void }) {
  const comingSoon = useComingSoon();
  const [tab, setTab] = useState<"notes" | "skills">("notes");
  const [template, setTemplate] = useState<Template>("general");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ overview: "", keywords: "" });
  const s = meeting.summary;

  const regenerate = useMeetingMutation(meeting.id, () => api.regenerate(meeting.id), { success: "Notes regenerated from the transcript" });
  const save = useMeetingMutation(
    meeting.id,
    () => api.updateSummary(meeting.id, { overview: draft.overview.trim(), keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean) }),
    { success: "Summary saved" },
  );

  const copySummary = () => {
    if (!s) return;
    const lines = [
      meeting.title, "", "Overview", s.overview, "",
      ...s.notes.flatMap((n) => [n.heading, ...n.bullets.map((b) => `• ${b}`), ""]),
      "Action Items", ...meeting.action_items.map((a) => `• ${a.text}${a.assignee ? ` (${a.assignee.name})` : ""}`),
    ];
    void navigator.clipboard?.writeText(lines.join("\n"));
    toast.success("Summary copied to clipboard");
  };

  const host = meeting.host ?? meeting.participants[0];
  const others = meeting.participants.length - (host ? 1 : 0);
  const show = (part: "overview" | "notes" | "actions" | "outline") =>
    template === "general" || (template === "bullets" && part === "notes") || (template === "actions" && part === "actions") || (template === "outline" && part === "outline");

  return (
    <div className="relative mx-auto w-full max-w-[860px] px-10 pb-24">
      <div className="sticky top-0 z-10 -mx-10 flex items-center justify-center bg-surface/95 px-10 py-3 backdrop-blur">
        <Segmented<"notes" | "skills">
          variant="pill"
          value={tab}
          onChange={setTab}
          options={[{ value: "notes", label: "Notes" }, { value: "skills", label: `AI Skills · ${AI_SKILLS.length}` }]}
        />
        <button onClick={onToggleExpand} aria-label={expanded ? "Exit full width" : "Expand notes"} title={expanded ? "Exit full width" : "Expand notes"}
          className="absolute right-6 rounded-md p-1.5 text-ink-4 hover:bg-muted hover:text-ink">
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      <div className="mt-6 flex items-start justify-between gap-4">
        <h1 className="text-[26px] leading-tight font-normal text-ink">{meeting.title}</h1>
        <Button className="mt-1" onClick={() => comingSoon({ name: "Video recording", description: "Recordings are out of scope for this demo — the player below simulates playback so the transcript, notes and timestamps stay in sync." })}>
          <Video className="size-4" /> Video
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3">
        {host && (
          <span className="inline-flex items-center gap-2">
            <Avatar name={host.name} color={host.color} size="sm" />
            {host.name}
            {others > 0 && <span className="underline decoration-dotted underline-offset-2" title={meeting.participants.map((p) => p.name).join(", ")}>+{others}</span>}
          </span>
        )}
        <span>{formatLongDate(meeting.started_at)}</span>
        <span className="inline-flex items-center gap-1"><Globe2 className="size-3.5" />{meeting.language}</span>
      </div>

      {tab === "skills" ? (
        <div className="mt-8 space-y-3">
          {AI_SKILLS.map((skill) => (
            <button key={skill.name} onClick={() => comingSoon({ name: skill.name, description: skill.description })}
              className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left hover:bg-subtle">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Sparkles className="size-5" /></span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-ink">{skill.name}</span>
                <span className="text-[13px] text-ink-4">{skill.description}</span>
              </span>
              <span className="text-[13px] font-medium text-brand">Run</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Popover
              className="w-52"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="inline-flex items-center gap-1.5 text-[15px] text-brand hover:text-brand-hover">
                  <Sparkles className="size-4" /> {TEMPLATES.find((t) => t.value === template)!.label} <ChevronDown className="size-4" />
                </button>
              )}
            >
              {(close) => TEMPLATES.map((t) => (
                <MenuItem key={t.value} onClick={() => { setTemplate(t.value); close(); }} badge={t.value === template ? <span className="text-brand">✓</span> : null}>
                  {t.label}
                </MenuItem>
              ))}
            </Popover>
            <button onClick={() => regenerate.mutate(undefined)} disabled={regenerate.isPending}
              className="ml-2 inline-flex items-center gap-1.5 text-[15px] text-brand hover:text-brand-hover disabled:opacity-50" title="Re-run the AI on the current transcript">
              <RefreshCw className={cn("size-4", regenerate.isPending && "animate-spin")} /> Refine Summary
            </button>
            <button onClick={copySummary} aria-label="Copy summary" title="Copy summary" className="ml-1 rounded-md p-1.5 text-ink-4 hover:bg-muted"><Copy className="size-4" /></button>
            <div className="ml-auto flex items-center gap-1">
              {s && !editing && (
                <Button variant="ghost" onClick={() => { setDraft({ overview: s.overview, keywords: s.keywords.join(", ") }); setEditing(true); }}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              <Button variant="ghost" onClick={() => comingSoon({ name: "AI Apps", description: "Install apps like Sales Summary Generator or Daily Digest to add custom sections to your notes." })}>
                <Plus className="size-4" /> AI Apps
              </Button>
            </div>
          </div>

          {!s ? (
            <div className="mt-8 rounded-xl border border-dashed border-line-strong p-8 text-center">
              <p className="text-[15px] font-medium text-ink">No AI notes yet</p>
              <p className="mt-1 text-[13px] text-ink-4">
                {meeting.segment_count ? "Generate a summary, outline and action items from the transcript." : "This meeting has no transcript. Add action items below, or upload a transcript to get AI notes."}
              </p>
              {meeting.segment_count > 0 && (
                <Button variant="primary" className="mt-4" onClick={() => regenerate.mutate(undefined)} disabled={regenerate.isPending}>
                  <Sparkles className="size-4" /> Generate notes
                </Button>
              )}
            </div>
          ) : editing ? (
            <div className="mt-6 space-y-4 rounded-xl border border-brand-200 bg-brand-soft/30 p-4">
              <label className="block text-[13px] font-medium text-ink-2">Keywords (comma separated)
                <Textarea rows={2} value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} className="mt-1.5" />
              </label>
              <label className="block text-[13px] font-medium text-ink-2">Overview
                <Textarea rows={8} value={draft.overview} onChange={(e) => setDraft({ ...draft, overview: e.target.value })} className="mt-1.5" />
              </label>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setEditing(false)}>Cancel</Button>
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => setEditing(false) })}>Save</Button>
              </div>
            </div>
          ) : (
            <>
              {show("overview") && s.keywords.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.keywords.map((k) => <span key={k} className="rounded-md bg-muted px-2.5 py-1 text-[14px] text-ink-3">{k}</span>)}
                </div>
              )}
              {show("overview") && (
                <Section id="overview" title="Overview">
                  <ul className="list-disc space-y-2 pl-6 text-[15px] leading-relaxed text-ink-2 marker:text-ink-5">
                    {sentences(s.overview).map((line, i) => <li key={i}><Bullet text={line} /></li>)}
                  </ul>
                </Section>
              )}
              {show("notes") && s.notes.length > 0 && (
                <Section id="notes" title="Notes">
                  <div className="space-y-5">
                    {s.notes.map((note, i) => (
                      <div key={i} id={`note-${i}`} className="scroll-mt-20">
                        <p className="text-[15px] font-medium text-ink">
                          {note.heading} {note.start_ms != null && <span className="font-normal">(<Timestamp ms={note.start_ms} />)</span>}
                        </p>
                        <ul className="mt-2 list-disc space-y-1.5 pl-6 text-[15px] leading-relaxed text-ink-2 marker:text-ink-5">
                          {note.bullets.map((b, j) => <li key={j}><Bullet text={b} /></li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {show("actions") && (
            <Section id="action-items" title="Action Items">
              <ActionItems meetingId={meeting.id} items={meeting.action_items} people={meeting.participants} />
            </Section>
          )}

          {show("outline") && meeting.chapters.length > 0 && (
            <Section id="outline" title="Outline">
              <ol className="space-y-3">
                {meeting.chapters.map((c, i) => (
                  <li key={c.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand">{i + 1}</span>
                    <div>
                      <p className="text-[15px] font-medium text-ink">
                        {c.title} <span className="text-[13px] font-normal text-ink-4">(<Timestamp ms={c.start_ms} /> – {formatTimestamp(c.end_ms)})</span>
                      </p>
                      {c.description && <p className="mt-0.5 text-[14px] text-ink-3">{c.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {s && (
            <p className="mt-10 flex items-center gap-1.5 text-xs text-ink-5">
              <Sparkles className="size-3.5" />
              {s.generated_by === "llm" ? "Generated by Claude" : s.generated_by === "user" ? "Edited by you" : s.generated_by === "seed" ? "AI-generated notes" : "Generated by Fireflies' built-in summarizer"}
              {" · "}Notes can contain mistakes — check important details against the transcript.
            </p>
          )}
        </>
      )}
    </div>
  );
}
