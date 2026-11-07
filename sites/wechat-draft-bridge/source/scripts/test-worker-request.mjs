import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(await realpath("node_modules/wrangler/package.json"));
const { Miniflare } = require("miniflare");
const outbound = [];
const mf = new Miniflare({
  modules: true,
  compatibilityDate: "2026-05-15",
  script: `export default { async fetch() {
    let rejectsUnsupportedMode = false;
    try { new Request("https://api.weixin.qq.com", { redirect: "error" }); }
    catch (error) { rejectsUnsupportedMode = error instanceof TypeError; }
    const response = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
      method: "POST", body: "{}", redirect: "manual", signal: AbortSignal.timeout(1000)
    });
    return Response.json({ rejectsUnsupportedMode, status: response.status });
  } };`,
  outboundService(request) {
    outbound.push(request.url);
    return new Response(null, { status: 302, headers: { Location: "https://untrusted.example/" } });
  },
});
try {
  const result = await (await mf.dispatchFetch("http://localhost/")).json();
  assert.equal(result.rejectsUnsupportedMode, true);
  assert.equal(result.status, 302);
  assert.deepEqual(outbound, ["https://api.weixin.qq.com/cgi-bin/stable_token"]);
  console.log("PASS actual workerd Request compatibility, timeout signal and no credential-bearing redirect follow");
} finally { await mf.dispose(); }
