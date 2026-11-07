import { listImages, uploadImage } from "@/lib/wechat";
import { safeError } from "@/lib/errors";
import { requireUser, requireSettingsRequest, respond } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return respond(await listImages(requireUser(request))); }
  catch (e) { return respond({ error: safeError(e) }, 400); }
}
export async function POST(request: Request) {
  try {
    requireSettingsRequest(request);
    const id = requireUser(request);
    if (Number(request.headers.get("content-length") ?? 0) > 11 * 1024 * 1024) return respond({ error: "文件过大。" }, 413);
    const data = await request.formData(), file = data.get("image");
    if (!(file instanceof File)) return respond({ error: "请选择图片。" }, 400);
    if (file.size > 10 * 1024 * 1024) return respond({ error: "图片不能超过 10 MiB。" }, 413);
    return respond(await uploadImage(id, new Uint8Array(await file.arrayBuffer()), file.name, String(data.get("purpose") ?? "cover")));
  } catch (e) { return respond({ error: safeError(e) }, 400); }
}
