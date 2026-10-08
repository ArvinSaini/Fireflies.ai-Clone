import type { Metadata } from "next";
import { TasksView } from "@/components/tasks/TasksView";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return <TasksView />;
}
