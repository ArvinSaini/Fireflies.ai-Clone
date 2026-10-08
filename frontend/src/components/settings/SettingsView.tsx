"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, CreditCard, Hash, KeyRound, Lock, Moon, Palette, Plus, Sun, Tags, Trash2, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { CreateChannelModal } from "@/components/layout/ChannelsPanel";
import { Topbar } from "@/components/layout/Topbar";
import { ConfirmDialog } from "@/components/meetings/MeetingDialogs";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Switch } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { errorToast, keys, useChannels, useMe, useStats, useTrackers } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Tab = "profile" | "appearance" | "notetaker" | "channels" | "trackers" | "billing" | "api";
const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "profile", label: "Profile", icon: <User /> },
  { value: "appearance", label: "Appearance", icon: <Palette /> },
  { value: "notetaker", label: "Notetaker", icon: <Bot /> },
  { value: "channels", label: "Channels", icon: <Hash /> },
  { value: "trackers", label: "Topic Trackers", icon: <Tags /> },
  { value: "billing", label: "Plans & Billing", icon: <CreditCard /> },
  { value: "api", label: "Developer API", icon: <KeyRound /> },
];

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-6 shadow-xs">
      <h2 className="text-[16px] font-medium text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-4">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <Card title={title}>
      <div className="rounded-lg border border-dashed border-line-strong bg-subtle p-6 text-center">
        <span className="rounded bg-brand-soft px-2 py-0.5 text-[11px] font-semibold tracking-wider text-brand uppercase">Coming soon</span>
        <p className="mt-3 text-[13px] text-ink-3">{description}</p>
      </div>
    </Card>
  );
}

function ChannelsSettings() {
  const qc = useQueryClient();
  const { data: channels } = useChannels();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  const del = useMutation({
    mutationFn: (id: number) => api.deleteChannel(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.channels });
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Channel deleted — its meetings were kept");
      setDeleting(null);
    },
    onError: errorToast,
  });
  return (
    <Card title="Channels" description="Organize meetings into public (#) or private channels.">
      <div className="divide-y divide-line rounded-lg border border-line">
        {channels?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            {c.is_private ? <Lock className="size-4 text-ink-4" /> : <Hash className="size-4 text-ink-4" />}
            <span className="flex-1 text-[14px] text-ink-2">{c.name}</span>
            <span className="text-[13px] text-ink-4">{c.meeting_count} meetings</span>
            <button onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`} className="rounded p-1 text-ink-5 hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={() => setCreating(true)}><Plus className="size-4" /> New channel</Button>
      <CreateChannelModal open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting.id)}
        title={`Delete #${deleting?.name}?`} description="Meetings in this channel are not deleted; they just leave the channel." />
    </Card>
  );
}

function TrackerSettings() {
  const qc = useQueryClient();
  const { data: trackers } = useTrackers();
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.trackers }), qc.invalidateQueries({ queryKey: ["analytics"] })]);
  const add = useMutation({
    mutationFn: () => api.addTracker({ name: name.trim(), keywords: words.split(",").map((w) => w.trim()).filter(Boolean) }),
    onSuccess: () => { void refresh(); setName(""); setWords(""); toast.success("Topic tracker added"); },
    onError: errorToast,
  });
  const del = useMutation({ mutationFn: (id: number) => api.deleteTracker(id), onSuccess: refresh });
  return (
    <Card title="Topic Trackers" description="Keywords Fireflies counts and highlights in every meeting's Smart Search panel.">
      <div className="space-y-2">
        {trackers?.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-lg border border-line px-4 py-3">
            <span className="mt-1.5 size-2 rounded-full" style={{ background: t.color }} />
            <div className="flex-1">
              <p className="text-[14px] font-medium text-ink">{t.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{t.keywords.map((k) => <span key={k} className="rounded bg-muted px-2 py-0.5 text-xs text-ink-3">{k}</span>)}</div>
            </div>
            <button onClick={() => del.mutate(t.id)} aria-label={`Delete ${t.name}`} className="rounded p-1 text-ink-5 hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); if (name.trim() && words.trim()) add.mutate(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Pricing" />
        <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Keywords: price, discount, budget" />
        <Button type="submit" variant="primary" className="h-10" disabled={!name.trim() || !words.trim()}>Add</Button>
      </form>
    </Card>
  );
}

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("profile");
  const { data: me } = useMe();
  const { data: stats } = useStats();
  const { theme, setTheme } = useTheme();
  const comingSoon = useComingSoon();
  const [prefs, setPrefs] = useState({ autoJoin: true, emailRecap: true, shareWithParticipants: false });

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <div className="mx-auto flex max-w-[1000px] gap-8 px-6 py-8">
          <nav className="hidden w-52 shrink-0 space-y-0.5 md:block">
            {TABS.map((t) => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] [&_svg]:size-4",
                  tab === t.value ? "bg-surface font-medium text-ink shadow-xs" : "text-ink-3 hover:bg-muted")}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 space-y-6">
            <select value={tab} onChange={(e) => setTab(e.target.value as Tab)} aria-label="Settings section"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 md:hidden">
              {TABS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {tab === "profile" && (
              <Card title="Profile" description="Authentication is out of scope for this demo — you're signed in as the default workspace user.">
                <div className="flex items-center gap-4">
                  <Avatar name={me?.name ?? "?"} color={me?.avatar_color} size="lg" className="size-16 text-2xl" />
                  <div>
                    <p className="text-[16px] font-medium text-ink">{me?.name}</p>
                    <p className="text-[13px] text-ink-4">{me?.email}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Full name"><Input value={me?.name ?? ""} readOnly /></Field>
                  <Field label="Email"><Input value={me?.email ?? ""} readOnly /></Field>
                </div>
                <p className="mt-4 text-[13px] text-ink-4">
                  Workspace: {stats?.meeting_count ?? "…"} meetings · AI engine:{" "}
                  <b className="font-medium text-ink-2">{{ claude: "Claude (LLM)", gemini: "Gemini (LLM)", heuristic: "Built-in summarizer" }[stats?.ai_engine ?? "heuristic"]}</b>
                </p>
              </Card>
            )}

            {tab === "appearance" && (
              <Card title="Appearance" description="Choose how Fireflies looks to you.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["light", "dark"] as const).map((t) => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={cn("rounded-xl border-2 p-4 text-left transition-colors", theme === t ? "border-brand" : "border-line hover:border-line-strong")}>
                      <div className={cn("mb-3 h-20 rounded-lg border", t === "light" ? "border-[#eaecf0] bg-white" : "border-[#262b33] bg-[#13161b]")}>
                        <div className={cn("m-3 h-2 w-1/2 rounded", t === "light" ? "bg-[#eaecf0]" : "bg-[#262b33]")} />
                        <div className="mx-3 h-2 w-1/3 rounded bg-[#6938ef]" />
                      </div>
                      <span className="flex items-center gap-2 text-[14px] font-medium text-ink">{t === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}{t === "light" ? "Light" : "Dark"}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {tab === "notetaker" && (
              <Card title="Notetaker" description="How Fred joins and shares your meetings. (Live capture is simulated in this demo.)">
                {[
                  { key: "autoJoin" as const, label: "Auto-join calendar meetings", hint: "Fred joins every meeting with a conferencing link." },
                  { key: "emailRecap" as const, label: "Email recap after meetings", hint: "Send the summary and action items to you after each meeting." },
                  { key: "shareWithParticipants" as const, label: "Share notes with participants", hint: "Everyone on the invite receives the recap." },
                ].map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
                    <div>
                      <p className="text-[14px] font-medium text-ink-2">{p.label}</p>
                      <p className="text-[13px] text-ink-4">{p.hint}</p>
                    </div>
                    <Switch checked={prefs[p.key]} label={p.label}
                      onChange={(v) => { setPrefs({ ...prefs, [p.key]: v }); comingSoon({ name: p.label, description: "Notetaker settings are placeholders — the live meeting bot is out of scope for this demo." }); }} />
                  </div>
                ))}
              </Card>
            )}

            {tab === "channels" && <ChannelsSettings />}
            {tab === "trackers" && <TrackerSettings />}
            {tab === "billing" && <Placeholder title="Plans & Billing" description="You're on the Free plan with unlimited transcription in this demo. Upgrades and invoices will appear here." />}
            {tab === "api" && <Placeholder title="Developer API" description="Generate API keys and webhooks to pull transcripts and summaries into your own tools." />}
          </div>
        </div>
      </main>
    </>
  );
}
