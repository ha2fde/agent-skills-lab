import { relaySource, dockerSource } from "@/lib/relay-source";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const content = file === "relay.mjs" ? relaySource : file === "Dockerfile" ? dockerSource : null;
  if (!content) return new Response("Not found", { status: 404 });
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"`, "X-Content-Type-Options": "nosniff" } });
}
