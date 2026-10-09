import { getTaskDetails, saveTaskDetails } from "../../../../../db/tasks";
import { currentUser, noStoreJson, sameOrigin } from "../../../../../lib/account-auth";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    const task = await getTaskDetails(ownerId, (await params).id);
    return task ? noStoreJson({ task }) : noStoreJson({ error: "找不到这条事项。" }, 404);
  } catch (error) {
    console.error("Task details read error", error);
    return noStoreJson({ error: "暂时无法读取明细，请稍后重试。" }, 500);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return noStoreJson({ error: "请求格式无效。" }, 415);
  }
  try {
    const ownerId = (await currentUser(request))?.id;
    if (!ownerId) return noStoreJson({ error: "请先登录后使用。" }, 401);
    const reader = request.body?.getReader();
    if (!reader) return noStoreJson({ error: "请填写明细内容。" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100_000) {
        await reader.cancel();
        return noStoreJson({ error: "明细最多 50,000 字。" }, 413);
      }
      chunks.push(value);
    }
    let input: unknown;
    try { input = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
    catch { return noStoreJson({ error: "请求格式无效。" }, 400); }
    const detailsMd = input && typeof input === "object" && "detailsMd" in input ? input.detailsMd : null;
    if (typeof detailsMd !== "string" || detailsMd.length > 50_000) {
      return noStoreJson({ error: "明细最多 50,000 字。" }, 400);
    }
    const updatedAt = await saveTaskDetails(ownerId, (await params).id, detailsMd);
    return updatedAt ? noStoreJson({ updatedAt }) : noStoreJson({ error: "找不到这条事项。" }, 404);
  } catch (error) {
    console.error("Task details save error", error);
    return noStoreJson({ error: "暂时无法保存明细，请稍后重试。" }, 500);
  }
}
