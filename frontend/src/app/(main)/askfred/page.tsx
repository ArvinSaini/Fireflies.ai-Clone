import type { Metadata } from "next";
import { Suspense } from "react";
import { AskFredView } from "@/components/askfred/AskFredView";

export const metadata: Metadata = { title: "AskFred" };

export default function AskFredPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <AskFredView />
    </Suspense>
  );
}
