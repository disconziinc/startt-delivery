const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function sendMissing(res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(404).end();
}

export default async function handler(req, res) {
  const id = String(req.query?.id || "");
  if (!SUPABASE_URL || !SUPABASE_KEY || !/^[A-Za-z0-9_-]{3,120}$/.test(id)) {
    sendMissing(res);
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=image&id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!response.ok) {
      sendMissing(res);
      return;
    }

    const rows = await response.json();
    const image = rows?.[0]?.image;
    if (!image || typeof image !== "string") {
      sendMissing(res);
      return;
    }

    if (/^https?:\/\//i.test(image)) {
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
      res.redirect(302, image);
      return;
    }

    const match = image.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) {
      sendMissing(res);
      return;
    }

    const [, contentType, payload] = match;
    const bytes = Buffer.from(payload, "base64");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).send(bytes);
  } catch {
    sendMissing(res);
  }
}
