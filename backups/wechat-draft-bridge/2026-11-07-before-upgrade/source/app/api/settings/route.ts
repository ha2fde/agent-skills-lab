import { connectionStatus, recentOperations, saveConnection } from "@/lib/wechat";
import { safeError } from "@/lib/errors";
import { requireUser, requireSettingsRequest, respond } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = requireUser(request);
    return respond({ ...await connectionStatus(id), ...await recentOperations(id) });
  } catch (e) { return respond({ error: safeError(e) }, 400); }
}
export async function POST(request: Request) {
  try {
    requireSettingsRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 10000) return respond({ error: "设置内容过大。" }, 413);
    return respond(await saveConnection(requireUser(request), await request.json()));
  } catch (e) { return respond({ error: safeError(e) }, 400); }
}
