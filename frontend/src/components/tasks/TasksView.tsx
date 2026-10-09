"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ListChecks, MessageSquare, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/Topbar";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Checkbox, EmptyState, Segmented, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatDayHeader, formatTime } from "@/lib/format";
import { errorToast, useInvalidateLibrary, useParticipants, useTasks } from "@/lib/queries";
import type { ActionItemWithMeeting, ParticipantCount } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ServerWaking } from "@/components/ui/ServerWaking";

type Status = "open" | "completed" | "all";

function useTaskMutations() {
  const qc = useQueryClient();
  const invalidateLibrary = useInvalidateLibrary();
  const refresh = () => Promise.all([invalidateLibrary(), qc.invalidateQueries({ queryKey: ["meeting"] })]);
  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: number; text?: string; is_completed?: boolean; assignee_id?: number | null }) => api.updateActionItem(id, data),
    onSuccess: refresh,
    onError: errorToast,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteActionItem(id),
    onSuccess: () => { void refresh(); toast.success("Task deleted"); },
    onError: errorToast,
  });
  const create = useMutation({
    mutationFn: ({ meetingId, text }: { meetingId: number; text: string }) => api.addActionItem(meetingId, { text }),
    onSuccess: () => { void refresh(); toast.success("Task added"); },
    onError: errorToast,
  });
  return { update, remove, create };
}

function TaskRow({ task, people, m }: { task: ActionItemWithMeeting; people: ParticipantCount[]; m: ReturnType<typeof useTaskMutations> }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="group flex items-center gap-4 border-b border-line py-3.5 last:border-0">
      <button onClick={() => m.remove.mutate(task.id)} aria-label="Delete task" className="rounded p-1 text-ink-5 hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-4" />
      </button>
      <Checkbox checked={task.is_completed} onChange={(v) => m.update.mutate({ id: task.id, is_completed: v })} label="Complete task" className="size-5" />
      <div className="min-w-0 flex-1 text-[15px]">
        {editing ? (
          <input autoFocus defaultValue={task.text}
            onBlur={(e) => { setEditing(false); const v = e.target.value.trim(); if (v && v !== task.text) m.update.mutate({ id: task.id, text: v }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-md border border-brand-400 px-2 py-1 text-ink outline-none ring-4 ring-brand-100" />
        ) : (
          <span onClick={() => setEditing(true)} className={cn("cursor-text text-ink-2", task.is_completed && "text-ink-5 line-through")}>{task.text}</span>
        )}
      </div>
      <Popover
        align="end"
        className="w-60"
        trigger={({ toggle }) => task.assignee ? (
          <button onClick={toggle} className="flex shrink-0 items-center gap-2">
            <span className="rounded-md bg-danger-soft px-2 py-1 text-[13px] text-danger">{task.assignee.name.split(" ")[0]}</span>
            <Avatar name={task.assignee.name} color={task.assignee.color} size="sm" />
          </button>
        ) : (
          <button onClick={toggle} className="flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-1 text-[13px] text-ink-4 hover:bg-muted">
            <UserPlus className="size-3.5" /> Assign
          </button>
        )}
      >
        {(close) => (
          <div className="max-h-72 overflow-y-auto">
            {people.map((p) => (
              <MenuItem key={p.id} icon={<Avatar name={p.name} color={p.color} size="xs" />} onClick={() => { close(); m.update.mutate({ id: task.id, assignee_id: p.id }); }}>
                {p.name}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem onClick={() => { close(); m.update.mutate({ id: task.id, assignee_id: null }); }}>Unassign</MenuItem>
          </div>
        )}
      </Popover>
    </li>
  );
}

function MeetingGroup({ meetingId, tasks, people, m }: { meetingId: number; tasks: ActionItemWithMeeting[]; people: ParticipantCount[]; m: ReturnType<typeof useTaskMutations> }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const first = tasks[0]!;
  return (
    <section className="rounded-xl border border-line bg-surface px-6 py-4 shadow-xs">
      <div className="flex items-center gap-3">
        <Avatar name={first.meeting_title} size="lg" className="size-10 text-base" />
        <Link href={`/meetings/${meetingId}`} className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink hover:text-brand">{first.meeting_title}</span>
          <span className="text-[14px] text-ink-4">{formatDayHeader(first.meeting_started_at)} · {formatTime(first.meeting_started_at)}</span>
        </Link>
        <span className="text-[14px] text-ink-4">{tasks.length} Task{tasks.length === 1 ? "" : "s"}</span>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"} className="rounded p-1 text-ink-4 hover:bg-muted">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>
      {open && (
        <>
          <ul className="mt-2">{tasks.map((t) => <TaskRow key={t.id} task={t} people={people} m={m} />)}</ul>
          {adding ? (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) m.create.mutate({ meetingId, text: text.trim() }, { onSuccess: () => { setText(""); setAdding(false); } }); }}>
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={() => !text && setAdding(false)} placeholder="Describe the task and press Enter"
                className="h-9 flex-1 rounded-lg border border-line-strong px-3 text-[14px] text-ink outline-none focus:border-brand-400" />
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-2 flex items-center gap-2 py-1.5 text-[14px] text-ink-4 hover:text-ink-2">
              <Plus className="size-4" /> New Task
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function TasksView() {
  const comingSoon = useComingSoon();
  const [mine, setMine] = useState(false);
  const [status, setStatus] = useState<Status>("open");
  const { data: tasks, isLoading } = useTasks(mine);
  const { data: people } = useParticipants();
  const m = useTaskMutations();

  const groups = useMemo(() => {
    const filtered = (tasks ?? []).filter((t) => status === "all" || (status === "completed") === t.is_completed);
    const map = new Map<number, ActionItemWithMeeting[]>();
    filtered.forEach((t) => map.set(t.meeting_id, [...(map.get(t.meeting_id) ?? []), t]));
    return [...map.entries()].sort((a, b) => b[1][0]!.meeting_started_at.localeCompare(a[1][0]!.meeting_started_at));
  }, [tasks, status]);
  const openCount = tasks?.filter((t) => !t.is_completed).length ?? 0;

  return (
    <>
      <Topbar title="Tasks" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <div className="mx-auto max-w-[1000px] px-6 py-8">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<"mine" | "all"> variant="pill" value={mine ? "mine" : "all"} onChange={(v) => setMine(v === "mine")}
              options={[{ value: "mine", label: "My Tasks" }, { value: "all", label: "All Tasks" }]} />
            <Segmented<Status> value={status} onChange={setStatus}
              options={[{ value: "open", label: `Open · ${openCount}` }, { value: "completed", label: "Completed" }, { value: "all", label: "All" }]} />
            <button onClick={() => comingSoon("Feedback")} className="ml-auto flex items-center gap-1.5 text-[14px] text-ink-4 hover:text-ink-2">
              <MessageSquare className="size-4" /> Share Feedback
            </button>
          </div>

          <button onClick={() => comingSoon({ name: "Task integrations", description: "Send action items to Asana, Monday.com, Trello or ClickUp automatically." })}
            className="mt-6 flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-xs hover:bg-subtle">
            <span className="flex -space-x-1">
              {["#f06a6a", "#ff3d57", "#0079bf", "#7b68ee"].map((c) => <span key={c} className="size-6 rounded-md border-2 border-surface" style={{ background: c }} />)}
            </span>
            <span className="flex-1 text-[14px] text-ink-2">Automatically send all your tasks to your work apps.</span>
            <span className="text-[14px] font-medium text-brand">Connect</span>
          </button>

          <div className="mt-6 space-y-4">
            {isLoading && <ServerWaking />}
            {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            {groups.map(([meetingId, list]) => <MeetingGroup key={meetingId} meetingId={meetingId} tasks={list} people={people ?? []} m={m} />)}
            {!isLoading && !groups.length && (
              <EmptyState icon={<ListChecks />}
                title={status === "completed" ? "No completed tasks yet" : mine ? "No tasks assigned to you" : "You're all caught up"}
                description={mine ? "Tasks assigned to you in meetings will show up here." : "Action items from your meetings will show up here."} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
