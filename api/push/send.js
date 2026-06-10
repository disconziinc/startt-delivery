import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function supabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase nao configurado para notificacoes.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:disconziinc@gmail.com";
  if (!publicKey || !privateKey) throw new Error("Chaves VAPID nao configuradas.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function subscriptionFromRow(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Metodo nao permitido." });
    return;
  }

  try {
    configureWebPush();
    const companyId = String(req.body?.companyId || "");
    const companySlug = String(req.body?.companySlug || "");
    const orderId = String(req.body?.orderId || "");
    const orderNumber = req.body?.orderNumber ? String(req.body.orderNumber) : "";
    const customerName = String(req.body?.customerName || "Cliente");
    const total = String(req.body?.total || "");
    if (!companyId || !orderId) {
      res.status(400).json({ ok: false, error: "Pedido sem empresa ou ID." });
      return;
    }

    const supabase = supabaseClient();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("company_id", companyId)
      .eq("active", true)
      .limit(50);
    if (error) throw error;

    const url = companySlug ? `/${companySlug}/admin/pedidos` : "/master";
    const payload = JSON.stringify({
      title: orderNumber ? `Novo pedido #${orderNumber}` : "Novo pedido recebido",
      body: `${customerName}${total ? ` - ${total}` : ""}`,
      url,
      orderId,
      companyId,
      tag: `startt-order-${orderId}`,
      icon: "/favicon-192x192.png",
      badge: "/favicon-192x192.png",
    });

    const results = await Promise.allSettled((data || []).map((row) => webpush.sendNotification(subscriptionFromRow(row), payload)));
    const expiredIds = [];
    let sent = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      const statusCode = result.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) expiredIds.push(data[index].id);
    });

    if (expiredIds.length) {
      await supabase.from("push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).in("id", expiredIds);
    }

    res.status(200).json({ ok: true, sent, totalSubscriptions: data?.length || 0, expired: expiredIds.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Falha ao enviar notificacao." });
  }
}
