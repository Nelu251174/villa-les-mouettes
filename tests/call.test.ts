import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.VLM_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vlm-call-"));
process.env.VLM_SECRET = "z".repeat(40);

let call: typeof import("../src/lib/call");
let store: typeof import("../src/lib/store");
beforeAll(async () => {
  call = await import("../src/lib/call");
  store = await import("../src/lib/store");
});
afterEach(() => vi.unstubAllGlobals());

const SID = "AC" + "a".repeat(32);
const good = { enabled: true, phone: "+40712345678", sid: SID, from: "+14155550123", token: "tok-SECRET-123" };
const msg = { ro: "Rezervare nouă", en: "New reservation" };

describe("apel telefonic", () => {
  it("fara configurare nu suna si nu arunca", async () => {
    expect(await call.callOwner(msg, { tag: "t" })).toEqual({ called: false, reason: "disabled" });
  });
  it("valideaza datele si cere token", async () => {
    expect(await call.saveCallSettings({ ...good, phone: "0712345678" })).toEqual({ ok: false, error: "phone" });
    expect(await call.saveCallSettings({ ...good, sid: "XX123" })).toEqual({ ok: false, error: "sid" });
    expect(await call.saveCallSettings({ ...good, token: undefined })).toEqual({ ok: false, error: "token" });
  });
  it("tokenul e criptat pe disc si nu apare in starea publica", async () => {
    expect(await call.saveCallSettings(good)).toEqual({ ok: true });
    const raw = JSON.stringify(await store.readSettings());
    expect(raw).not.toContain("tok-SECRET-123");
    expect(JSON.stringify(await call.publicCallStatus())).not.toContain("tok-SECRET");
    expect((await call.publicCallStatus()).configured).toBe(true);
    expect(call.decrypt((await call.getCallSettings())!.tokenEnc)).toBe("tok-SECRET-123");
    expect(call.decrypt("gunoi.gunoi.gunoi")).toBeNull();
  });
  it("suna prin Twilio cu autentificare Basic, escape XML, apoi respecta limita de frecventa", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 201 }));
    vi.stubGlobal("fetch", f);
    expect(await call.callOwner({ ro: 'Ion <b>&"x"', en: "x" }, { tag: "r1" })).toEqual({ called: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: URLSearchParams }];
    expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`);
    expect(init.headers.authorization).toBe("Basic " + Buffer.from(`${SID}:tok-SECRET-123`).toString("base64"));
    expect(init.body.get("To")).toBe("+40712345678");
    expect(init.body.get("Twiml")).toContain("Ion &lt;b&gt;&amp;&quot;x&quot;");
    expect(init.body.get("Twiml")).not.toContain("<b>");
    // al doilea apel imediat: blocat de limita de 2 minute
    expect(await call.callOwner(msg, { tag: "r2" })).toEqual({ called: false, reason: "rate_limited" });
    expect(f).toHaveBeenCalledTimes(1);
    // testul din aplicatie ocoleste limita
    expect((await call.callOwner(msg, { tag: "test", force: true })).called).toBe(true);
  });
  it("daca vocea romana esueaza, reincearca cu engleza; daca esueaza tot, raporteaza esec", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 }).mockResolvedValueOnce({ ok: true, status: 201 });
    vi.stubGlobal("fetch", f);
    expect((await call.callOwner(msg, { tag: "fb", force: true })).called).toBe(true);
    expect((f.mock.calls[1] as unknown as [string, { body: URLSearchParams }])[1].body.get("Twiml")).toContain("Polly.Joanna");
    const g = vi.fn(async () => ({ ok: false, status: 401 }));
    vi.stubGlobal("fetch", g);
    expect(await call.callOwner(msg, { tag: "bad", force: true })).toEqual({ called: false, reason: "twilio_401" });
  });
});
