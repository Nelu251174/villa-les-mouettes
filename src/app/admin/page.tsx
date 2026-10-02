import { adminConfigured, isAdmin } from "@/lib/admin";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="wrap" style={{ padding: "84px var(--gutter)" }}>
        <h1 className="h2">Admin</h1>
        <p className="body">Admin disabled: set <code>VLM_ADMIN_PASSWORD</code> (12+ chars) and <code>VLM_SECRET</code> (32+ chars) on the server.</p>
      </main>
    );
  }
  return <AdminPanel authed={await isAdmin()} />;
}
