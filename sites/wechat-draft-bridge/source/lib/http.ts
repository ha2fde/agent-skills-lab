import { UserFacingError } from "./errors";
export function requireUser(request: Request) {
  const id = request.headers.get("oai-authenticated-user-id");
  if (!id) throw new UserFacingError("请先使用你的 ChatGPT 账号登录。");
  return id;
}
export function requireSettingsRequest(request: Request) {
  if (request.headers.get("x-wechat-client") !== "settings") throw new UserFacingError("请从私有设置页提交请求。");
  const origin = request.headers.get("origin");
  if (!origin) throw new UserFacingError("请求来源无效，请刷新设置页。");
  if (new URL(origin).host !== new URL(request.url).host && origin !== "https://wechat-draft-bridge.hac2fde.chatgpt.site") throw new UserFacingError("请求来源无效，请刷新设置页。");
}
export function respond(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
