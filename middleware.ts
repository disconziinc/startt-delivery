type RateEntry = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

const rateStore = new Map<string, RateEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 90;
const BLOCK_MS = 120_000;
const MAX_STORE_SIZE = 5_000;

const PUBLIC_FILE_RE = /\.(?:js|css|map|png|jpg|jpeg|webp|gif|svg|ico|json|xml|txt|html|woff2?|ttf|otf|pdf)$/i;
const KNOWN_GOOD_CRAWLERS_RE = /googlebot|bingbot|duckduckbot|slurp|yandexbot|baiduspider/i;
const SUSPICIOUS_UA_RE = /curl|wget|python-requests|httpclient|libwww|scrapy|spider|crawler|headless|phantom|selenium|playwright|puppeteer|axios|node-fetch|go-http-client|java\/|okhttp|sqlmap|nikto|masscan|nmap|bytespider|petalbot|claudebot|ccbot|gptbot|semrush|ahrefs/i;

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

function isStaticOrSeoPath(pathname: string) {
  if (PUBLIC_FILE_RE.test(pathname)) return true;
  return [
    "/assets/",
    "/docs/",
    "/favicon",
    "/robots.txt",
    "/sitemap.xml",
    "/site.webmanifest",
    "/manifest.webmanifest",
    "/apple-touch-icon",
  ].some((prefix) => pathname.startsWith(prefix));
}

function isProtectedPublicPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return false;
  const [first, second] = segments;
  if (["master", "sobre", "contatos", "assets", "docs", "api"].includes(first)) return false;
  if (["admin", "login"].includes(second || "")) return false;
  return true;
}

function cleanupStore(now: number) {
  if (rateStore.size < MAX_STORE_SIZE) return;
  for (const [key, value] of rateStore) {
    if (value.resetAt < now && value.blockedUntil < now) rateStore.delete(key);
    if (rateStore.size < MAX_STORE_SIZE * 0.8) break;
  }
}

function tooManyRequests(ip: string, pathname: string) {
  const now = Date.now();
  cleanupStore(now);
  const key = `${ip}:${pathname}`;
  const current = rateStore.get(key);
  if (!current || current.resetAt < now) {
    rateStore.set(key, { count: 1, resetAt: now + WINDOW_MS, blockedUntil: 0 });
    return false;
  }
  if (current.blockedUntil > now) return true;
  current.count += 1;
  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    current.blockedUntil = now + BLOCK_MS;
    return true;
  }
  return false;
}

function rateLimitResponse() {
  return new Response("Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.", {
    status: 429,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(Math.ceil(BLOCK_MS / 1000)),
      "x-startt-rate-limit": "blocked",
    },
  });
}

export const config = {
  matcher: ["/((?!assets|docs|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|manifest.webmanifest|apple-touch-icon.png|og-image.png|startt-logo.png|paulo-disconzi.jpeg|google0e3bd01949710477.html).*)"],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (request.method !== "GET" && request.method !== "HEAD") return;
  if (isStaticOrSeoPath(pathname) || !isProtectedPublicPath(pathname)) return;

  const userAgent = request.headers.get("user-agent")?.trim() || "";
  if (!userAgent) return rateLimitResponse();
  if (!KNOWN_GOOD_CRAWLERS_RE.test(userAgent) && SUSPICIOUS_UA_RE.test(userAgent)) return rateLimitResponse();

  if (tooManyRequests(clientIp(request), pathname)) return rateLimitResponse();
}
