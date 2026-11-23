// Shred Coach rest-timer push server. Each phone gets its own Durable Object holding one pending alarm.
import { DurableObject } from "cloudflare:workers";
import { newVapidKeys, sendPush } from "./webpush.js";

const SUBJECT = "https://hiwagana.github.io/shred-coach/";
const ALLOWED = ["https://hiwagana.github.io", "http://localhost:8765"];

export class Hub extends DurableObject {
  async keys() {            // VAPID keys are made once, on first use, and stay in this object's storage
    let k = await this.ctx.storage.get("vapid");
    if (!k) { k = await newVapidKeys(); await this.ctx.storage.put("vapid", k); }
    return k;
  }
  async schedule(sub, delaySec, title, body) {
    await this.ctx.storage.put("job", { sub, title, body });
    await this.ctx.storage.setAlarm(Date.now() + Math.max(1, delaySec) * 1000);
  }
  async cancel() { await this.ctx.storage.deleteAlarm(); await this.ctx.storage.delete("job"); }
  async alarm() {
    const job = await this.ctx.storage.get("job"); if (!job) return;
    await this.ctx.storage.delete("job");
    const keys = await this.env.HUB.get(this.env.HUB.idFromName("vapid")).keys();
    const r = await sendPush(job.sub, JSON.stringify({ title: job.title, body: job.body }), keys, SUBJECT);
    if (!r.ok) console.log("push failed", r.status, await r.text());
  }
}

const cors = origin => ({
  "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin",
});
const json = (o, h, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...h } });
async function userStub(env, endpoint) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return env.HUB.get(env.HUB.idFromName("u:" + [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("")));
}

export default {
  async fetch(req, env) {
    const h = cors(req.headers.get("Origin") || ""), url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    try {
      if (url.pathname === "/vapid") return json({ key: (await env.HUB.get(env.HUB.idFromName("vapid")).keys()).pub }, h);
      if (req.method === "POST" && (url.pathname === "/schedule" || url.pathname === "/cancel")) {
        const b = await req.json();
        if (!b.sub || typeof b.sub.endpoint !== "string" || !/^https:\/\//.test(b.sub.endpoint) || !b.sub.keys) return json({ error: "bad subscription" }, h, 400);
        const stub = await userStub(env, b.sub.endpoint);
        if (url.pathname === "/cancel") await stub.cancel();
        else await stub.schedule(b.sub, Math.min(900, Number(b.delay) || 90), String(b.title || "Rest over").slice(0, 80), String(b.body || "").slice(0, 160));
        return json({ ok: true }, h);
      }
      if (url.pathname === "/") return new Response("Shred Coach push server is running.", { headers: h });
      return json({ error: "not found" }, h, 404);
    } catch (e) { return json({ error: String(e) }, h, 500); }
  },
};
