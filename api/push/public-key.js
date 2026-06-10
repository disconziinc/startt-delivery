export default function handler(_req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) {
    res.status(500).json({ ok: false, error: "Chave publica de notificacoes nao configurada." });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ ok: true, publicKey });
}
