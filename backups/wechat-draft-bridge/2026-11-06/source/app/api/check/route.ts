import { checkConnection } from "@/lib/wechat";
import { safeError } from "@/lib/errors";
import { requireUser, requireSettingsRequest, respond } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { requireSettingsRequest(request); return respond(await checkConnection(requireUser(request))); }
  catch (e) { return respond({ error: safeError(e) }, 400); }
}
