import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.VLM_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vlm-push-"));

const sent: { endpoint: string; body: string; opts: Record<string, unknown> }[] = [];
vi.mock("web-push", async () => {
  const actual = await vi.importActual<typeof import("web-push")>("web-push");
  const sendNotification = vi.fn(async (sub: { endpoint: string }, body: string, opts: Record<string, unknown>) => {
    if (sub.endpoint.includes("dead")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    if (sub.endpoint.includes("flaky")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    sent.push({ endpoint: sub.endpoint, body, opts });
    return { statusCode: 201 };
  });
  return { ...actual, default: { ...(actual as unknown as { default: object }).default, setVapidDetails: vi.fn(), sendNotification } };
});

let push: typeof import("../src/lib/push");
let store: typeof import("../src/lib/store");
beforeAll(async () => {
  push = await import("../src/lib/push");
  store = await import("../src/lib/store");
});

const sub = (name: string) => ({ endpoint: `https://push.example/${name}`, keys: { p256dh: "BPk", auth: "a" }, ua: "test" });

describe("notificari push", () => {
  it("fara telefoane inregistrate: nu trimite si nu arunca", async () => {
    expect(await push.notifyOwner({ title: "t", body: "b" })).toEqual({ sent: 0, failed: 0, removed: 0 });
  });
  it("cheile VAPID se genereaza o singura data si raman aceleasi", async () => {
    const a = await push.vapid(), b = await push.vapid();
    expect(a.publicKey).toBeTruthy();
    expect(a).toEqual(b);
  });
  it("trimite la toate telefoanele, sterge abonamentele moarte (410) si numara esecurile", async () => {
    await store.addPushSub(sub("ok-1"));
    await store.addPushSub(sub("ok-2"));
    await store.addPushSub(sub("dead-1"));
    await store.addPushSub(sub("flaky-1"));
    const r = await push.notifyOwner({ title: "Rezervare nouă", body: "Jean · 14 → 18", tag: "res-1", url: "/admin?tab=azi" });
    expect(r).toEqual({ sent: 2, failed: 1, removed: 1 });
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push.example/ok-1", "https://push.example/ok-2"]);
    expect(JSON.parse(sent[0].body)).toMatchObject({ title: "Rezervare nouă", url: "/admin?tab=azi" });
    expect(sent[0].opts).toMatchObject({ urgency: "high" });
    const left = (await store.listPushSubs()).map((s) => s.endpoint).sort();
    expect(left).toEqual(["https://push.example/flaky-1", "https://push.example/ok-1", "https://push.example/ok-2"]); // dead-1 sters, flaky pastrat
  });
  it("abonarea aceluiasi telefon nu se dubleaza", async () => {
    await store.addPushSub(sub("ok-1"));
    expect((await store.listPushSubs()).filter((s) => s.endpoint.endsWith("ok-1"))).toHaveLength(1);
  });
});
