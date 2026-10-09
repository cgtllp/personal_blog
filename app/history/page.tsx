import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUserFromCookieHeader } from "../../lib/account-auth";
import TaskHistory from "../../components/task-history";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await currentUserFromCookieHeader((await headers()).get("cookie"));
  if (!user) redirect("/");
  return <TaskHistory userName={user.username} />;
}
