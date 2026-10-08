import { Suspense } from "react";
import { NotepadView } from "@/components/notepad/NotepadView";

/** Meeting page ("Notepad"). `params` is a Promise in Next 16, resolved inside Suspense. */
export default function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" />}>
      {params.then(({ id }) => (
        <NotepadView id={Number(id)} />
      ))}
    </Suspense>
  );
}
