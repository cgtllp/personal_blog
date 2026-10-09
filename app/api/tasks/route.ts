import { createTask, listTasks, removeTask, setTaskCompleted } from "../../../db/tasks";

export const dynamic = "force-dynamic";

function owner(request: Request) {
  return request.headers.get("oai-authenticated-user-id") ||
    (process.env.NODE_ENV === "development" ? "local-preview" : null);
}

function failure(error: unknown) {
  console.error("Task API error", error);
  return Response.json({ error: "暂时无法保存，请稍后重试。" }, { status: 500 });
}

function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
}

export async function GET(request: Request) {
  const ownerId = owner(request);
  if (!ownerId) return Response.json({ error: "请先登录后使用。" }, { status: 401 });
  try {
    return Response.json({ tasks: await listTasks(ownerId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const ownerId = owner(request);
  if (!ownerId) return Response.json({ error: "请先登录后使用。" }, { status: 401 });
  try {
    const input = await request.json() as { day?: unknown; title?: unknown };
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!validDay(input.day) || !title || title.length > 200) {
      return Response.json({ error: "请填写 1–200 字的待办内容。" }, { status: 400 });
    }
    return Response.json({ task: await createTask(ownerId, input.day, title) }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  const ownerId = owner(request);
  if (!ownerId) return Response.json({ error: "请先登录后使用。" }, { status: 401 });
  try {
    const input = await request.json() as { id?: unknown; completed?: unknown };
    if (typeof input.id !== "string" || typeof input.completed !== "boolean") {
      return Response.json({ error: "无效的事项。" }, { status: 400 });
    }
    const found = await setTaskCompleted(ownerId, input.id, input.completed);
    return found ? Response.json({ ok: true }) : Response.json({ error: "找不到这条事项。" }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  const ownerId = owner(request);
  if (!ownerId) return Response.json({ error: "请先登录后使用。" }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "无效的事项。" }, { status: 400 });
    const found = await removeTask(ownerId, id);
    return found ? Response.json({ ok: true }) : Response.json({ error: "找不到这条事项。" }, { status: 404 });
  } catch (error) { return failure(error); }
}
