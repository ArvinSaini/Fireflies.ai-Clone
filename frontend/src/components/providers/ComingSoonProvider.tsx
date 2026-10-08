"use client";

import { Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Feature {
  name: string;
  description?: string;
}

const ComingSoonContext = createContext<(feature: Feature | string) => void>(() => {});

/** `const comingSoon = useComingSoon(); comingSoon("Live meeting bot")` — one shared placeholder dialog. */
export const useComingSoon = () => useContext(ComingSoonContext);

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<Feature | null>(null);
  const open = useCallback((f: Feature | string) => setFeature(typeof f === "string" ? { name: f } : f), []);
  return (
    <ComingSoonContext.Provider value={open}>
      {children}
      <Modal open={!!feature} onClose={() => setFeature(null)} size="sm">
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Sparkles className="size-7" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-brand uppercase">Coming soon</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{feature?.name}</h3>
          <p className="mt-2 text-[13px] text-ink-4">
            {feature?.description ??
              "This part of Fireflies isn't available in this demo yet. Meetings, transcripts, summaries, tasks and AskFred are fully functional."}
          </p>
          <Button variant="primary" className="mt-6" onClick={() => setFeature(null)}>
            Got it
          </Button>
        </div>
      </Modal>
    </ComingSoonContext.Provider>
  );
}
