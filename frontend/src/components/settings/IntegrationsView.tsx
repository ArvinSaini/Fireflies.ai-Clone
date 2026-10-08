"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Input } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";

const APPS = [
  { name: "Zoom", category: "Video conferencing", color: "#2d8cff", description: "Record and transcribe Zoom meetings automatically." },
  { name: "Google Meet", category: "Video conferencing", color: "#00ac47", description: "Fred joins your Meet calls from Google Calendar." },
  { name: "Microsoft Teams", category: "Video conferencing", color: "#5059c9", description: "Capture Teams meetings and webinars." },
  { name: "Google Calendar", category: "Calendar", color: "#4285f4", description: "Auto-join meetings on your calendar." },
  { name: "Outlook Calendar", category: "Calendar", color: "#0078d4", description: "Sync Outlook events with Fireflies." },
  { name: "Slack", category: "Collaboration", color: "#4a154b", description: "Post meeting recaps to channels." },
  { name: "Notion", category: "Collaboration", color: "#111111", description: "Send notes to a Notion database." },
  { name: "HubSpot", category: "CRM", color: "#ff7a59", description: "Log calls and notes to contacts and deals." },
  { name: "Salesforce", category: "CRM", color: "#00a1e0", description: "Sync call summaries to opportunities." },
  { name: "Asana", category: "Project management", color: "#f06a6a", description: "Turn action items into Asana tasks." },
  { name: "Monday.com", category: "Project management", color: "#ff3d57", description: "Push tasks to your boards." },
  { name: "Zapier", category: "Automation", color: "#ff4f00", description: "Connect Fireflies to 5,000+ apps." },
];
const CATEGORIES = ["All", ...new Set(APPS.map((a) => a.category))];

export function IntegrationsView() {
  const comingSoon = useComingSoon();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const apps = APPS.filter((a) => (cat === "All" || a.category === cat) && a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Topbar title="Integrations" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <div className="mx-auto max-w-[1100px] px-6 py-8">
          <h1 className="text-[22px] font-medium text-ink">Integrations</h1>
          <p className="text-[14px] text-ink-4">Connect Fireflies with the tools you already use. (Placeholders in this demo.)</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn("rounded-full border px-3 py-1.5 text-[13px]", cat === c ? "border-brand bg-brand-soft text-brand-hover" : "border-line bg-surface text-ink-3 hover:bg-muted")}>{c}</button>
            ))}
            <div className="ml-auto w-64"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" className="h-9" /></div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => (
              <div key={a.name} className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg text-[15px] font-bold text-white" style={{ background: a.color }}>{a.name[0]}</span>
                  <div>
                    <p className="text-[15px] font-medium text-ink">{a.name}</p>
                    <p className="text-xs text-ink-4">{a.category}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-[13px] text-ink-3">{a.description}</p>
                <button onClick={() => comingSoon(`${a.name} integration`)}
                  className="mt-4 rounded-lg border border-line-strong py-2 text-[13px] font-medium text-ink-2 hover:bg-subtle">Connect</button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
