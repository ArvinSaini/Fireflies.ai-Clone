import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintView } from "@/components/notepad/PrintView";

export const metadata: Metadata = { title: "Print meeting" };

/** Printable meeting document — used for the PDF export (browser "Save as PDF"). */
export default function PrintMeetingPage({ params }: PageProps<"/meetings/[id]/print">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => <PrintView id={Number(id)} />)}
    </Suspense>
  );
}
