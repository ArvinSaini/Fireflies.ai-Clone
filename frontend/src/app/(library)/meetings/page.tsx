import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetingsView } from "@/components/meetings/MeetingsView";

export const metadata: Metadata = { title: "Meetings" };

// MeetingsView reads ?view / ?channel, so it renders inside a Suspense boundary.
export default function MeetingsPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <MeetingsView />
    </Suspense>
  );
}
