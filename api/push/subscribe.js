import { createClient } from "@supabase/supabase-js";

function supabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase nao configurado para notificacoes.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeSubscription(subscription) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return null;
  return {
    endpoint: String(subscription.endpoint),
    keys: {
      p256dh: String(subscription.keys.p256dh),
      auth: String(subscription.keys.auth),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Metodo nao permitido." });
    return;
  }

  try {
    const companyId = String(req.body?.companyId || "");
    const userId = String(req.body?.userId || "");
    const companySlug = String(req.body?.companySlug || "");
    const subscription = normalizeSubscription(req.body?.subscription);
    if (!companyId || !subscription) {
      res.status(400).json({ ok: false, error: "Dados de inscricao incompletos." });
      return;
    }

    const supabase = supabaseClient();
    const payload = {
      company_id: companyId,
      user_id: userId || null,
      company_slug: companySlug || null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 500),
      active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("push_subscriptions").upsert(payload, { onConflict: "endpoint" });
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Falha ao ativar notificacoes." });
  }
}
