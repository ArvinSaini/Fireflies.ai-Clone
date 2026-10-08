"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Building2, Hash, Lock, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Skeleton, Switch, Textarea } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { errorToast, keys, useChannels } from "@/lib/queries";
import { cn } from "@/lib/utils";

function Row({
  href, icon, label, active, count, onClick,
}: { href?: string; icon: React.ReactNode; label: string; active?: boolean; count?: number; onClick?: () => void }) {
  const cls = cn(
    "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[14px] transition-colors [&_svg]:size-[17px]",
    active ? "bg-brand-soft font-medium text-brand-hover [&_svg]:text-brand-hover" : "text-ink-3 hover:bg-muted [&_svg]:text-ink-4",
  );
  const body = (
    <>
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-xs text-ink-5">{count}</span>}
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** Second-level navigation for Meetings: default views + channels (# public / 🔒 private). */
export function ChannelsPanel() {
  const path = usePathname();
  const params = useSearchParams();
  const comingSoon = useComingSoon();
  const { data: channels, isLoading } = useChannels();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const view = params.get("view") ?? "mine";
  const channelId = Number(params.get("channel")) || null;
  const onMeetings = path === "/meetings";
  const filtered = (channels ?? []).filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="p-3">
        <Input icon={<Search />} placeholder="Search channels" value={query} onChange={(e) => setQuery(e.target.value)}
          className="h-9 border-transparent bg-subtle shadow-none" />
      </div>
      <div className="space-y-0.5 border-b border-line px-3 pb-3">
        <Row href="/meetings" icon={<Hash />} label="My Meetings" active={onMeetings && !channelId && view === "mine"} />
        <Row href="/meetings?view=all" icon={<Building2 />} label="All Meetings" active={onMeetings && !channelId && view === "all"} />
        <Row icon={<Bot />} label="Voice Agent Meetings"
          onClick={() => comingSoon({ name: "Voice Agent Meetings", description: "Calls handled by your Fireflies voice agents will appear here." })} />
        <Row href="/uploads" icon={<Upload />} label="Uploads" active={path === "/uploads"} />
      </div>
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <span className="text-[14px] font-medium text-ink-2">All channels</span>
        <button onClick={() => setCreating(true)} aria-label="Create channel" title="Create channel"
          className="rounded-md p-1 text-ink-4 hover:bg-muted hover:text-ink">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="mx-3 my-3 h-4" />)}
        {filtered.map((c) => (
          <Row key={c.id} href={`/meetings?channel=${c.id}`} icon={c.is_private ? <Lock /> : <Hash />} label={c.name}
            active={onMeetings && channelId === c.id} count={c.meeting_count} />
        ))}
        {!isLoading && !filtered.length && <p className="px-3 py-4 text-[13px] text-ink-5">No channels found</p>}
      </div>
      <CreateChannelModal open={creating} onClose={() => setCreating(false)} />
    </aside>
  );
}

export function CreateChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const create = useMutation({
    mutationFn: () => api.createChannel({ name, description: description || undefined, is_private: isPrivate }),
    onSuccess: (channel) => {
      qc.invalidateQueries({ queryKey: keys.channels });
      toast.success(`Channel #${channel.name} created`);
      setName(""); setDescription(""); setPrivate(false);
      onClose();
      router.push(`/meetings?channel=${channel.id}`);
    },
    onError: errorToast,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a channel"
      description="Channels keep related meetings together, like #sales-calls or #interviews."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Create channel
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <Field label="Name">
          <Input icon={isPrivate ? <Lock /> : <Hash />} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. customer-feedback" maxLength={50} />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this channel about?" />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-line p-3">
          <div>
            <p className="text-[13px] font-medium text-ink-2">Private channel</p>
            <p className="text-xs text-ink-4">Only invited members can see meetings in it.</p>
          </div>
          <Switch checked={isPrivate} onChange={setPrivate} label="Private channel" />
        </div>
      </form>
    </Modal>
  );
}
