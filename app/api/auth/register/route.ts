import {
  createSession, noStoreJson, normalizeUsername, readSmallJson,
  registerUser, registrationAllowed, sameOrigin, validPassword,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStoreJson({ error: "请求来源无效。" }, 403);
  const input = await readSmallJson(request);
  if (!input) return noStoreJson({ error: "请求内容无效。" }, 400);
  const normalized = normalizeUsername(input.username);
  if (!normalized || !validPassword(input.password)) {
    return noStoreJson({ error: "账号须为 3–32 位字母、数字或下划线；密码不能为空。" }, 400);
  }
  if (!(await registrationAllowed(request))) {
    return noStoreJson({ error: "注册尝试过多，请一小时后再试。" }, 429);
  }
  try {
    const user = await registerUser(input.username as string, normalized, input.password);
    if (!user) return noStoreJson({ error: "这个账号已被使用。" }, 409);
    const response = noStoreJson({ ok: true });
    response.headers.set("Set-Cookie", await createSession(request, user.id));
    return response;
  } catch (error) {
    console.error("Registration failed", error);
    return noStoreJson({ error: "暂时无法注册，请稍后重试。" }, 500);
  }
}
