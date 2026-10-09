import {
  authenticateUser, clearLoginFailures, createSession, loginAllowed,
  noStoreJson, normalizeUsername, readSmallJson, recordLoginFailure, sameOrigin,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  const input = await readSmallJson(request);
  const normalized = normalizeUsername(input?.username);
  const password = input?.password;
  if (!normalized || typeof password !== "string" || !password) {
    return noStoreJson({ error: "账号或密码错误。" }, 401);
  }
  try {
    if (!(await loginAllowed(normalized))) {
      return noStoreJson({ error: "登录尝试过多，请 15 分钟后再试。" }, 429);
    }
    const user = await authenticateUser(normalized, password);
    if (!user) {
      await recordLoginFailure(normalized);
      return noStoreJson({ error: "账号或密码错误。" }, 401);
    }
    await clearLoginFailures(normalized);
    const response = noStoreJson({ ok: true });
    response.headers.set("Set-Cookie", await createSession(request, user.id));
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return noStoreJson({ error: "暂时无法登录，请稍后重试。" }, 500);
  }
}
