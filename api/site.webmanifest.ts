const RESERVED_PATHS = new Set(["", "sobre", "contatos", "assets", "docs", "api", "admin"]);

function normalizeStartUrl(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";

  const segments = raw.split("/").filter(Boolean);
  const first = (segments[0] || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!first || RESERVED_PATHS.has(first)) return "/";
  if (first === "master") return "/master";
  if (segments[1] === "admin") return `/${first}/admin/dashboard`;
  return `/${first}`;
}

function appIdentity(startUrl: string) {
  if (startUrl === "/") {
    return { id: "/", name: "Startt Delivery", shortName: "Startt", scope: "/" };
  }

  if (startUrl === "/master") {
    return { id: "/master", name: "Startt Delivery - Admin Master", shortName: "Startt Master", scope: "/master" };
  }

  const slug = startUrl.split("/").filter(Boolean)[0];
  const storeName = slug.replace(/-/g, " ").toUpperCase();
  const admin = startUrl.includes("/admin/");
  return {
    id: admin ? `/${slug}/admin` : `/${slug}`,
    name: admin ? `${storeName} - Painel Startt` : `${storeName} - Startt Delivery`,
    shortName: admin ? `${storeName} Admin` : storeName,
    scope: `/${slug}/`,
  };
}

export default function handler(request: any, response: any) {
  const startUrl = normalizeStartUrl(request.query?.start_url);
  const identity = appIdentity(startUrl);

  response.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    id: identity.id,
    name: identity.name,
    short_name: identity.shortName,
    description: "Cardapio digital e gestao de pedidos via WhatsApp.",
    start_url: startUrl,
    scope: identity.scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#0A0A0A",
    theme_color: "#FF6A00",
    orientation: "portrait",
    icons: [
      { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/favicon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  });
}
