import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTaskDetails } from "../../../db/tasks";
import { currentUserFromCookieHeader } from "../../../lib/account-auth";
import TaskDetailsEditor from "../../../components/task-details-editor";

export const dynamic = "force-dynamic";

export default async function TaskDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const user = await currentUserFromCookieHeader((await headers()).get("cookie"));
  if (!user) redirect("/");
  const task = await getTaskDetails(user.id, (await params).id);
  if (!task) notFound();
  return <TaskDetailsEditor task={task} fromHistory={(await searchParams).from === "history"} />;
}
