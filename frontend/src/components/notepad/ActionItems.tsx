"use client";

import { Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Checkbox } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { useMeetingMutation } from "@/lib/queries";
import type { ActionItem, MeetingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Timestamp } from "./Timestamp";

function AssigneePicker({ item, people, onPick }: { item: ActionItem; people: MeetingParticipant[]; onPick: (id: number | null) => void }) {
  return (
    <Popover
      align="end"
      className="w-56"
      trigger={({ toggle }) => (
        <button onClick={toggle} title="Assign" className="shrink-0 rounded-md p-0.5 hover:bg-muted">
          {item.assignee ? <Avatar name={item.assignee.name} color={item.assignee.color} size="xs" /> : <UserRound className="size-4 text-ink-5" />}
        </button>
      )}
    >
      {(close) => (
        <>
          {people.map((p) => (
            <MenuItem key={p.id} icon={<Avatar name={p.name} color={p.color} size="xs" />} onClick={() => { close(); onPick(p.id); }}>
              {p.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => { close(); onPick(null); }}>Unassigned</MenuItem>
        </>
      )}
    </Popover>
  );
}

function ItemRow({ item, meetingId, people }: { item: ActionItem; meetingId: number; people: MeetingParticipant[] }) {
  const [editing, setEditing] = useState(false);
  const update = useMeetingMutation(meetingId, (data: Parameters<typeof api.updateActionItem>[1]) => api.updateActionItem(item.id, data));
  const remove = useMeetingMutation(meetingId, () => api.deleteActionItem(item.id), { success: "Action item deleted" });
  return (
    <li className="group flex items-start gap-3 py-1.5">
      <Checkbox
        className="mt-[5px]"
        checked={item.is_completed}
        onChange={(v) => update.mutate({ is_completed: v })}
        label={item.is_completed ? "Mark as not done" : "Mark as done"}
      />
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
        {editing ? (
          <input
            autoFocus
            defaultValue={item.text}
            onBlur={(e) => { setEditing(false); if (e.target.value.trim() && e.target.value.trim() !== item.text) update.mutate({ text: e.target.value.trim() }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-md border border-brand-400 bg-surface px-2 py-0.5 text-ink outline-none ring-4 ring-brand-100"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            title="Click to edit"
            className={cn("cursor-text text-ink-2", item.is_completed && "text-ink-5 line-through")}
          >
            {item.text}
          </span>
        )}
        {!editing && item.timestamp_ms != null && <> <Timestamp ms={item.timestamp_ms} /></>}
      </div>
      <div className="flex items-center gap-1">
        <AssigneePicker item={item} people={people} onPick={(id) => update.mutate({ assignee_id: id })} />
        <button
          aria-label="Delete action item"
          onClick={() => remove.mutate(undefined)}
          className="rounded-md p-1 text-ink-5 opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

/** Action items grouped by assignee, as in Fireflies' summary ("Chris" → bullets with timestamps). */
export function ActionItems({ meetingId, items, people }: { meetingId: number; items: ActionItem[]; people: MeetingParticipant[] }) {
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<number | null>(null);
  const add = useMeetingMutation(
    meetingId,
    () => api.addActionItem(meetingId, { text: text.trim(), assignee_id: assignee }),
    { success: "Action item added" },
  );

  const groups = new Map<string, ActionItem[]>();
  for (const item of items) {
    const key = item.assignee?.name ?? "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const open = items.filter((i) => !i.is_completed).length;

  return (
    <div>
      <p className="mb-2 text-xs text-ink-4">{open} open · {items.length - open} completed</p>
      {[...groups.entries()].map(([name, list]) => (
        <div key={name} className="mb-3">
          <p className="mb-1 text-[15px] text-ink-4">{name}</p>
          <ul>{list.map((item) => <ItemRow key={item.id} item={item} meetingId={meetingId} people={people} />)}</ul>
        </div>
      ))}
      <form
        className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-1.5 focus-within:border-brand-400"
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(undefined, { onSuccess: () => { setText(""); setAssignee(null); } }); }}
      >
        <Plus className="size-4 text-ink-5" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an action item…"
          className="h-8 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-5" />
        <select value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : null)}
          aria-label="Assignee" className="h-8 max-w-36 rounded-md bg-transparent text-[13px] text-ink-3 outline-none">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="submit" disabled={!text.trim() || add.isPending} className="text-[13px] font-medium text-brand disabled:opacity-40">Add</button>
      </form>
    </div>
  );
}
