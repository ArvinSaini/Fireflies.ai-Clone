"use client";
// Dialogs shared by the meetings library and the meeting page: rename/edit, move to channel,
// delete confirmation and the "Details" side panel.
import { Clock3, Globe2, Hash, Lock, Plus, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Checkbox, Field, Input } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatDuration, formatLongDate, parseDate } from "@/lib/format";
import { errorToast, keys, useChannels, useInvalidateLibrary, useMeetingMutation } from "@/lib/queries";
import type { MeetingDetail, MeetingListItem } from "@/lib/types";
import { LANGUAGES } from "./CreateMeetingModal";
import { PlatformIcon, platformLabel } from "./PlatformIcon";

type AnyMeeting = MeetingListItem | MeetingDetail;

const toLocalInput = (iso: string) => {
  const d = parseDate(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Edit title, date, language and participants (the CRUD "edit metadata" flow). */
export function EditMeetingDialog({ meeting, open, onClose }: { meeting: AnyMeeting; open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(meeting.title);
  const [startedAt, setStartedAt] = useState(toLocalInput(meeting.started_at));
  const [language, setLanguage] = useState(meeting.language);
  const [people, setPeople] = useState(meeting.participants.map((p) => ({ name: p.name, email: p.email ?? "" })));
  const [newPerson, setNewPerson] = useState("");
  const save = useMeetingMutation(
    meeting.id,
    () =>
      api.updateMeeting(meeting.id, {
        title: title.trim(),
        started_at: new Date(startedAt).toISOString().slice(0, 19),
        language,
        participants: people.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), email: p.email.trim() || null })),
      }),
    { success: "Meeting updated" },
  );
  const addPerson = () => {
    if (!newPerson.trim()) return;
    setPeople([...people, { name: newPerson.trim(), email: "" }]);
    setNewPerson("");
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit meeting"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date & time">
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </Field>
          <Field label="Language">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs outline-none">
              {[...new Set([language, ...LANGUAGES])].map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Participants</p>
          <div className="space-y-1.5">
            {people.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Avatar name={p.name || "?"} size="sm" />
                <input value={p.name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="h-8 min-w-0 flex-1 rounded-md border border-transparent px-2 text-[13px] text-ink hover:border-line focus:border-brand-400 focus:outline-none" />
                <input value={p.email} placeholder="email (optional)" onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                  className="h-8 w-40 rounded-md border border-transparent px-2 text-[13px] text-ink-3 hover:border-line focus:border-brand-400 focus:outline-none" />
                <button aria-label={`Remove ${p.name}`} onClick={() => setPeople(people.filter((_, j) => j !== i))} className="rounded p-1 text-ink-5 hover:bg-muted hover:text-danger">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addPerson(); }}>
            <Input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Add participant by name" className="h-9" />
            <Button type="submit" disabled={!newPerson.trim()}><Plus className="size-4" /> Add</Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

export function MoveToChannelDialog({
  meetingIds, initial = [], open, onClose, onMoved,
}: { meetingIds: number[]; initial?: number[]; open: boolean; onClose: () => void; onMoved?: () => void }) {
  const { data: channels } = useChannels();
  const [selected, setSelected] = useState<number[]>(initial);
  const move = useMeetingMutation(
    meetingIds[0] ?? 0,
    () => api.bulk({ action: "move", meeting_ids: meetingIds, channel_ids: selected }),
    { success: meetingIds.length > 1 ? `Moved ${meetingIds.length} meetings` : "Channels updated" },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to channel"
      description={meetingIds.length > 1 ? `${meetingIds.length} meetings selected` : "Pick the channels this meeting belongs to."}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={move.isPending} onClick={() => move.mutate(undefined, { onSuccess: () => { onClose(); onMoved?.(); } })}>
            Move
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        {channels?.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
            <Checkbox checked={selected.includes(c.id)} onChange={(on) => setSelected(on ? [...selected, c.id] : selected.filter((x) => x !== c.id))} label={c.name} />
            {c.is_private ? <Lock className="size-4 text-ink-4" /> : <Hash className="size-4 text-ink-4" />}
            <span className="flex-1 text-[14px] text-ink-2">{c.name}</span>
            <span className="text-xs text-ink-5">{c.meeting_count}</span>
          </label>
        ))}
        {!channels?.length && <p className="text-[13px] text-ink-4">No channels yet — create one from the channels panel.</p>}
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Delete", pending,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; pending?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm} data-autofocus>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Trash2 className="size-5" />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-[13px] text-ink-4">{description}</p>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteMeetingDialog({ meeting, open, onClose }: { meeting: AnyMeeting; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const invalidateLibrary = useInvalidateLibrary();
  const del = useMutation({
    mutationFn: () => api.deleteMeeting(meeting.id),
    onSuccess: () => {
      onClose();
      if (window.location.pathname.startsWith(`/meetings/${meeting.id}`)) router.push("/meetings");
      // Drop (don't refetch) the deleted meeting's caches, then refresh the lists.
      for (const key of [keys.meeting(meeting.id), keys.transcript(meeting.id), keys.analytics(meeting.id)]) qc.removeQueries({ queryKey: key });
      void invalidateLibrary();
      toast.success("Meeting deleted");
    },
    onError: errorToast,
  });
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      pending={del.isPending}
      title="Delete this meeting?"
      description={`"${meeting.title}" and its transcript, notes and action items will be permanently deleted.`}
      onConfirm={() => del.mutate()}
    />
  );
}

/** Right-hand "Details" panel from the Notebook list. */
export function MeetingDetailsDrawer({ meeting, onClose }: { meeting: MeetingListItem | null; onClose: () => void }) {
  if (!meeting) return null;
  const rows: [string, React.ReactNode][] = [
    ["Host", meeting.host?.name ?? "—"],
    ["Date", formatLongDate(meeting.started_at)],
    ["Duration", formatDuration(meeting.duration_ms)],
    ["Language", <span key="l" className="inline-flex items-center gap-1"><Globe2 className="size-3.5" />{meeting.language}</span>],
    ["Captured from", <span key="p" className="inline-flex items-center gap-1.5"><PlatformIcon platform={meeting.platform} />{platformLabel(meeting.platform)}</span>],
  ];
  return (
    <div className="fixed inset-0 z-40" onMouseDown={onClose}>
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-4 uppercase">Meeting details</p>
            <h2 className="mt-1 text-[17px] font-semibold text-ink">{meeting.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-ink-4 hover:bg-muted"><X className="size-5" /></button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <dl className="space-y-2.5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex text-[13px]">
                <dt className="w-32 shrink-0 text-ink-4">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
          {meeting.overview && (
            <section>
              <h3 className="mb-1.5 text-[13px] font-semibold text-ink">AI summary</h3>
              <p className="text-[13px] leading-relaxed text-ink-3">{meeting.overview}</p>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">Channels</h3>
            <div className="flex flex-wrap gap-1.5">
              {meeting.channels.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-ink-3">
                  {c.is_private ? <Lock className="size-3" /> : <Hash className="size-3" />}{c.name}
                </span>
              ))}
              {!meeting.channels.length && <span className="text-[13px] text-ink-5">Not in any channel</span>}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">Participants · {meeting.participants.length}</h3>
            <ul className="space-y-2">
              {meeting.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <Avatar name={p.name} color={p.color} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-ink-4">{p.email ?? "No email"}</span>
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-ink-4 capitalize">{p.role}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex items-center gap-2 text-[13px] text-ink-4">
            <Clock3 className="size-4" /> {meeting.action_items_open} open of {meeting.action_items_total} action items
          </section>
        </div>
      </aside>
    </div>
  );
}
