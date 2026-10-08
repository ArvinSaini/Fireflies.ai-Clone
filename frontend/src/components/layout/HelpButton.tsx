import { CircleHelp } from "lucide-react";

/** Floating "?" help button in the bottom-right corner, as in the live app. */
export function HelpButton() {
  return (
    <a
      href="https://guide.fireflies.ai"
      target="_blank"
      rel="noreferrer"
      aria-label="Help center"
      className="fixed right-5 bottom-5 z-30 hidden size-12 items-center justify-center rounded-full border-2 border-brand-200 bg-surface text-ink shadow-pop hover:border-brand md:flex print:hidden"
    >
      <CircleHelp className="size-6" strokeWidth={1.75} />
    </a>
  );
}
