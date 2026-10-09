import { deleteSession, expiredSessionCookie, sameOrigin } from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  try {
    await deleteSession(request);
  } catch (error) {
    console.error("Logout failed", error);
    return new Response("Unable to sign out", { status: 500 });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/", request.url).toString(),
      "Set-Cookie": expiredSessionCookie(request),
      "Cache-Control": "no-store",
    },
  });
}
