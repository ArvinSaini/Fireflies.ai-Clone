"use client";

import { useMutation } from "@tanstack/react-query";
import { ClipboardPaste, FilePlus2, FileText, Hash, Lock, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { errorToast, useChannels, useInvalidateLibrary } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CreateMode = "upload" | "paste" | "manual";

const Ctx = createContext<(mode?: CreateMode) => void>(() => {});
/** `useCreateMeeting()("upload")` opens the shared create dialog on a given tab. */
export const useCreateMeeting = () => useContext(Ctx);

export function CreateMeetingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CreateMode | null>(null);
  const open = useCallback((m: CreateMode = "upload") => setMode(m), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {mode && <CreateMeetingModal initialMode={mode} onClose={() => setMode(null)} />}
    </Ctx.Provider>
  );
}

export const LANGUAGES = ["English (Global)", "English (US)", "Spanish", "French", "German", "Hindi", "Portuguese", "Japanese"];
const ACCEPT = ".txt,.vtt,.srt,.json";
const SAMPLE = `[00:00:00] Sarah Chen: Thanks for joining. Let's review the Q3 launch checklist.
[00:00:06] Marcus Johnson: Engineering is on track, but the billing migration still needs a final QA pass.
[00:00:14] Sarah Chen: Marcus, can you finish the QA pass by Thursday?
[00:00:18] Marcus Johnson: Yes, I'll finish the billing QA by Thursday and share the report.
[00:00:24] Priya Patel: I'll update the onboarding screens with the new pricing copy.`;

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const toUTC = (local: string) => (local ? new Date(local).toISOString().slice(0, 19) : null);

function ChannelPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const { data: channels } = useChannels();
  return (
    <div className="flex flex-wrap gap-1.5">
      {channels?.map((c) => {
        const on = value.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== c.id) : [...value, c.id])}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-brand bg-brand-soft text-brand-hover" : "border-line-strong text-ink-3 hover:bg-subtle",
            )}
          >
            {c.is_private ? <Lock className="size-3" /> : <Hash className="size-3" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function CreateMeetingModal({ initialMode, onClose }: { initialMode: CreateMode; onClose: () => void }) {
  const router = useRouter();
  const invalidate = useInvalidateLibrary();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CreateMode>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(nowLocal);
  const [language, setLanguage] = useState(LANGUAGES[0]!);
  const [participants, setParticipants] = useState("");
  const [channelIds, setChannelIds] = useState<number[]>([]);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("30");

  const names = participants.split(",").map((n) => n.trim()).filter(Boolean);

  const submit = useMutation({
    mutationFn: async (): Promise<MeetingDetail> => {
      if (mode === "upload") {
        const form = new FormData();
        form.append("file", file!);
        if (title.trim()) form.append("title", title.trim());
        const utc = toUTC(startedAt);
        if (utc) form.append("started_at", utc);
        if (names.length) form.append("participants", names.join(","));
        if (channelIds.length) form.append("channel_ids", channelIds.join(","));
        form.append("language", language);
        return api.uploadMeeting(form);
      }
      return api.createMeeting({
        title: title.trim(),
        started_at: toUTC(startedAt),
        language,
        participants: names.map((name) => ({ name })),
        channel_ids: channelIds,
        transcript_text: mode === "paste" ? transcript : null,
        duration_minutes: mode === "manual" ? Number(duration) || 0 : null,
      });
    },
    onSuccess: async (meeting) => {
      await invalidate();
      toast.success(
        meeting.segment_count ? "Transcript processed — your AI notes are ready" : "Meeting created",
        { description: meeting.title },
      );
      onClose();
      router.push(`/meetings/${meeting.id}`);
    },
    onError: errorToast,
  });

  const canSubmit =
    !submit.isPending &&
    (mode === "upload" ? !!file : title.trim().length > 0 && (mode !== "paste" || transcript.trim().length > 0));

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(txt|vtt|srt|json)$/i.test(f.name)) return toast.error("Upload a .txt, .vtt, .srt or .json transcript");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const tabs: { value: CreateMode; label: string; icon: ReactNode }[] = [
    { value: "upload", label: "Upload file", icon: <Upload className="size-4" /> },
    { value: "paste", label: "Paste transcript", icon: <ClipboardPaste className="size-4" /> },
    { value: "manual", label: "Manual", icon: <FilePlus2 className="size-4" /> },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Add a meeting"
      description="Fireflies transcribes, summarizes and extracts action items automatically."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => submit.mutate()}>
            {submit.isPending ? "Processing…" : mode === "upload" ? "Upload" : "Create meeting"}
          </Button>
        </>
      }
    >
      <div className="mb-5 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setMode(t.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium",
              mode === t.value ? "bg-surface text-ink shadow-xs" : "text-ink-4 hover:text-ink-2",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {mode === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            className={cn(
              "rounded-xl border border-dashed p-6 text-center transition-colors",
              dragging ? "border-brand bg-brand-100" : "border-brand-400 bg-brand-soft",
            )}
          >
            <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg bg-surface p-3 text-left shadow-xs">
                <span className="flex h-9 w-11 items-center justify-center rounded-md bg-[#2e90fa] text-[10px] font-bold text-white uppercase">
                  {file.name.split(".").pop()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{file.name}</span>
                  <span className="text-xs text-ink-4">{formatBytes(file.size)}</span>
                </span>
                <button onClick={() => setFile(null)} aria-label="Remove file" className="rounded p-1 text-ink-4 hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto size-6 text-brand" />
                <p className="mt-2 text-[14px] text-ink-2">Drag & drop a transcript, or</p>
                <Button className="mt-3" onClick={() => fileInput.current?.click()}>Browse Files</Button>
                <p className="mt-3 text-xs text-ink-4">Supports .txt, .vtt, .srt and .json (max 5 MB)</p>
              </>
            )}
          </div>
        )}

        <Field label="Meeting title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "upload" ? "Defaults to the file name" : "e.g. Weekly product sync"} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date & time">
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </Field>
          {mode === "manual" ? (
            <Field label="Duration (minutes)">
              <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          ) : (
            <Field label="Language">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs outline-none focus:border-brand-400">
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
          )}
        </div>

        <Field label="Participants" hint={mode === "manual" ? "Comma-separated. The first person is the host." : "Comma-separated. Speakers found in the transcript are added automatically."}>
          <Input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Sarah Chen, Marcus Johnson" />
        </Field>

        {mode === "paste" && (
          <Field
            label="Transcript"
            hint={
              <>
                Lines like <code>[00:01:23] Name: text</code> or <code>Name: text</code>; WebVTT, SRT and JSON also work.{" "}
                <button type="button" className="font-medium text-brand" onClick={() => setTranscript(SAMPLE)}>Use a sample</button>
              </>
            }
          >
            <Textarea rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="font-mono text-[12px]"
              placeholder="[00:00:00] Sarah Chen: Let's get started…" />
          </Field>
        )}

        <Field label="Channels">
          <ChannelPicker value={channelIds} onChange={setChannelIds} />
        </Field>

        {submit.isPending && (
          <p className="flex items-center gap-2 text-[13px] text-ink-4">
            <FileText className="size-4 animate-pulse text-brand" /> Generating summary, outline and action items…
          </p>
        )}
      </div>
    </Modal>
  );
}
