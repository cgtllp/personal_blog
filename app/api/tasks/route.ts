import { createTask, listTasks, removeTask, setTaskCompleted } from "../../../db/tasks";
import { currentUser, noStoreJson, sameOrigin } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  console.error("Task API error", error);
  return noStoreJson({ error: "暂时无法保存，请稍后重试。" }, 500);
}

function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
}

export async function GET(request: Request) {
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    return noStoreJson({ tasks: await listTasks(ownerId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    const input = await request.json() as { day?: unknown; title?: unknown };
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!validDay(input.day) || !title || title.length > 200) {
      return noStoreJson({ error: "请填写 1–200 字的待办内容。" }, 400);
    }
    return noStoreJson({ task: await createTask(ownerId, input.day, title) }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    const input = await request.json() as { id?: unknown; completed?: unknown };
    if (typeof input.id !== "string" || typeof input.completed !== "boolean") {
      return noStoreJson({ error: "无效的事项。" }, 400);
    }
    const found = await setTaskCompleted(ownerId, input.id, input.completed);
    return found ? noStoreJson({ ok: true }) : noStoreJson({ error: "找不到这条事项。" }, 404);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return noStoreJson({ error: "无效的事项。" }, 400);
    const found = await removeTask(ownerId, id);
    return found ? noStoreJson({ ok: true }) : noStoreJson({ error: "找不到这条事项。" }, 404);
  } catch (error) { return failure(error); }
}
