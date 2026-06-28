import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import {
  BarChart3,
  Bell,
  Bike,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Tags,
  TicketPercent,
  Trash2,
  UploadCloud,
  UserRound,
  Utensils,
  UsersRound,
  X,
} from "lucide-react";
import {
  CashSale,
  Category,
  AssistantStatus,
  Company,
  CompanyStatus,
  Coupon,
  createDatabaseApi,
  Customer,
  DeliveryZone,
  Fulfillment,
  InventoryItem,
  InventoryUnit,
  MockDatabaseState,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Plan,
  PrintSettings,
  Product,
  Settings as CompanySettingsRecord,
  SubscriptionStatus,
  User,
  UserRole,
  VoucherBrand,
} from "./data/mockDatabase";
import {
  cacheCompanyRouteSnapshot,
  DATABASE_STORAGE_KEY,
  DATABASE_SYNC_ERROR_EVENT,
  deleteCompanyCascade,
  getCachedCompanyRouteSnapshot,
  getInitialDatabaseSnapshot,
  loadCompanyOrdersRefresh,
  loadCompanyRouteSnapshot,
  loadDatabaseSnapshot,
  persistDatabaseSnapshot,
  uploadPublicImage,
} from "./services/database";
import { isSupabaseConfigured, STARTT_EMERGENCY_MODE, supabase } from "./lib/supabase";
import {
  connectQzTray,
  disconnectQzTray,
  getQzDownloadUrl,
  getQzStatus,
  getSavedQzPrinter,
  listQzPrinters,
  printQzOrder,
  printQzTest,
  qzInstallInstructions,
  saveQzPrinter,
} from "./services/qzTrayService";
import "./index.css";

type DatabaseApi = ReturnType<typeof createDatabaseApi>;
type CartItem = Product & { qty: number };
type CheckoutState = {
  name: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  payment_method: PaymentMethod;
  card_type: "Débito" | "Crédito";
  voucher_brand_id: string;
  needs_change: "Não" | "Sim";
  coupon: string;
  cash_change_for: string;
  customer_note: string;
};
type AdminScreen =
  | "dashboard"
  | "conta"
  | "caixa"
  | "estoque"
  | "pedidos"
  | "clientes"
  | "produtos"
  | "categorias"
  | "cupons"
  | "relatorios"
  | "fretes"
  | "impressao"
  | "configuracoes"
  | "usuarios";
type MasterScreen = "dashboard" | "empresas" | "usuarios" | "planos" | "configuracoes";
type ToastType = "success" | "error" | "info";

const MASTER_SESSION_KEY = "startt_delivery_master_session";
const ADMIN_SESSION_PREFIX = "startt_delivery_admin_session_";
const NEW_ORDER_EVENT = "startt:new-order";
const DATABASE_CHANGE_PULSE_KEY = "startt_delivery_database_pulse";
const DATABASE_CHANGE_PULSE_EVENT = "startt:database-pulse";
const SAVE_DELAY = 250;
const SITE_URL = "https://starttdelivery.com.br";
const DEFAULT_SEO_TITLE = "Startt Delivery — Seu cardápio do seu jeito";
const DEFAULT_SEO_DESCRIPTION = "Sistema profissional de cardápio digital para lancherias. Receba pedidos pelo WhatsApp, tenha seu próprio delivery e gerencie tudo em um painel moderno.";
const DEFAULT_OG_DESCRIPTION = "Crie seu cardápio digital, receba pedidos pelo WhatsApp e gerencie sua lancheria em um painel profissional.";
const DEFAULT_TWITTER_DESCRIPTION = "Cardápio digital premium para lancherias receberem pedidos direto no WhatsApp.";
const DEFAULT_SEO_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_SEO_KEYWORDS = "cardápio digital, delivery whatsapp, sistema para lancheria, delivery próprio, sistema delivery, cardápio online, Startt Delivery, delivery Porto Alegre, painel para lancheria, sistema para hamburgueria, pedidos via WhatsApp";

const adminNav: Array<{ id: AdminScreen; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "conta", label: "Minha conta", icon: <UserRound size={18} /> },
  { id: "caixa", label: "Caixa", icon: <CreditCard size={18} /> },
  { id: "estoque", label: "Estoque", icon: <Utensils size={18} /> },
  { id: "pedidos", label: "Pedidos", icon: <ClipboardList size={18} /> },
  { id: "clientes", label: "Clientes", icon: <UsersRound size={18} /> },
  { id: "produtos", label: "Produtos", icon: <Package size={18} /> },
  { id: "categorias", label: "Categorias", icon: <Menu size={18} /> },
  { id: "cupons", label: "Cupons", icon: <TicketPercent size={18} /> },
  { id: "relatorios", label: "Relatórios", icon: <BarChart3 size={18} /> },
  { id: "fretes", label: "Fretes", icon: <MapPin size={18} /> },
  { id: "impressao", label: "Impressão", icon: <Printer size={18} /> },
  { id: "configuracoes", label: "Configurações", icon: <Settings size={18} /> },
  { id: "usuarios", label: "Usuários", icon: <UserRound size={18} /> },
];

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const roleAccess: Record<UserRole, AdminScreen[]> = {
  dono: adminNav.map((item) => item.id),
  gerente: adminNav.map((item) => item.id).filter((id) => !["usuarios", "configuracoes"].includes(id)),
  caixa: ["dashboard", "caixa", "estoque", "pedidos"],
  atendente: ["dashboard", "pedidos", "clientes"],
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createPixTxid() {
  return `ST${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 25);
}

function activeOrders(orders: Order[]) {
  return orders.filter((order) => !order.archived && !order.removed_from_dashboard && !order.removedFromDashboard);
}

function notify(type: ToastType, message: string) {
  window.dispatchEvent(new CustomEvent("startt:toast", { detail: { type, message } }));
}

function emitDatabasePulse(companyId?: string) {
  const detail = { company_id: companyId || "", at: new Date().toISOString() };
  try {
    localStorage.setItem(DATABASE_CHANGE_PULSE_KEY, JSON.stringify(detail));
  } catch {
    // O pulso local e apenas um atalho entre abas; o banco continua sendo a fonte real.
  }
  window.dispatchEvent(new CustomEvent(DATABASE_CHANGE_PULSE_EVENT, { detail }));
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function positiveNumber(value: string | number) {
  const number = parseMoney(value);
  return Number.isFinite(number) && number > 0;
}

function parseMoney(value: string | number) {
  if (typeof value === "number") return value;
  const raw = value.trim().replace(/[^\d,.-]/g, "");
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  const normalized = hasComma
    ? raw.replace(/\./g, "").replace(",", ".")
    : hasDot && /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  return Number(normalized);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}

function pixText(value: string, max: number) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .,@+-]/g, "").trim().slice(0, max);
}

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const calc = (factor: number) => {
    const total = value.slice(0, factor - 1).split("").reduce((sum, digit, index) => sum + Number(digit) * (factor - index), 0);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(10) === Number(value[9]) && calc(11) === Number(value[10]);
}

function validCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * factors[index], 0);
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };
  const first = calc(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(value[12]) && second === Number(value[13]);
}

function normalizePixKey(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  const onlyPhoneChars = /^[\d\s().+-]+$/.test(raw);
  const phoneDigits = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if (onlyPhoneChars && digits.length > 0 && phoneDigits.length < 10) return { valid: false, key: raw, type: "telefone incompleto" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { valid: true, key: raw.toLowerCase(), type: "e-mail" };
  if (raw.startsWith("+") && /^\+\d{12,13}$/.test(raw)) return { valid: true, key: raw, type: "telefone" };
  if (validCpf(digits)) return { valid: true, key: digits, type: "CPF" };
  if (validCnpj(digits)) return { valid: true, key: digits, type: "CNPJ" };
  if ((digits.length === 10 || digits.length === 11) && !raw.includes("@")) return { valid: true, key: `+55${digits}`, type: "telefone" };
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return { valid: true, key: `+${digits}`, type: "telefone" };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return { valid: true, key: raw.toLowerCase(), type: "chave aleatória" };
  if (/^[A-Za-z0-9-]{32,77}$/.test(raw)) return { valid: true, key: raw, type: "chave aleatória" };
  return { valid: false, key: raw, type: "" };
}

function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Pix(payload: string) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildPixPayload(settings: CompanySettingsRecord | undefined, amount: number, txid: string) {
  const pixKey = normalizePixKey(settings?.pix_key || "");
  if (!settings?.pix_enabled || !pixKey.valid || amount <= 0) return "";
  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", pixKey.key);
  const payloadWithoutCrc = [
    emv("00", "01"),
    emv("26", merchantAccount),
    emv("52", "0000"),
    emv("53", "986"),
    emv("54", amount.toFixed(2)),
    emv("58", "BR"),
    emv("59", pixText(settings.pix_receiver_name || "STARTT DELIVERY", 25).toUpperCase()),
    emv("60", pixText(settings.pix_city || "PORTO ALEGRE", 15).toUpperCase()),
    emv("62", emv("05", pixText(txid, 25).toUpperCase())),
    "6304",
  ].join("");
  return `${payloadWithoutCrc}${crc16Pix(payloadWithoutCrc)}`;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2);
  return digits;
}

function whatsappPhone(value: string) {
  const normalized = normalizePhone(value);
  return normalized.startsWith("55") ? normalized : `55${normalized}`;
}

function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function absoluteImageUrl(value?: string) {
  if (!value) return DEFAULT_SEO_IMAGE;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return absoluteUrl(value);
}

function cacheBustedUrl(value: string, version?: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}v=${encodeURIComponent(version || "startt")}`;
}

function companyLogoUrl(company: Company) {
  return cacheBustedUrl(company.logo_url, company.updated_at || company.created_at || company.id);
}

function companyHeroUrl(company: Company) {
  return cacheBustedUrl(company.banner_url || company.hero_image, company.updated_at || company.created_at || company.id);
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
}

function upsertCanonical(url: string) {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = url;
}

function applySeo({ title, description = DEFAULT_SEO_DESCRIPTION, path = "/", image = DEFAULT_SEO_IMAGE, type = "website" }: { title: string; description?: string; path?: string; image?: string; type?: string }) {
  const url = absoluteUrl(path);
  const imageUrl = absoluteImageUrl(image);
  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="keywords"]', { name: "keywords", content: DEFAULT_SEO_KEYWORDS });
  upsertMeta('meta[name="author"]', { name: "author", content: "Startt Facilities" });
  upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow" });
  upsertCanonical(url);
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: DEFAULT_OG_DESCRIPTION });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Startt Delivery" });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: DEFAULT_TWITTER_DESCRIPTION });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
}

function findCustomerByPhone(customers: Customer[], companyId: string, phone: string) {
  const normalized = normalizePhone(phone);
  return customers.find((customer) => customer.company_id === companyId && (customer.normalized_phone || normalizePhone(customer.phone)) === normalized);
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

function orderPaymentLines(order: Order) {
  if (order.payment_method === "Pix") {
    return [
      "PAGAMENTO: PIX",
      `VALOR: ${money(order.total)}`,
      `STATUS: ${order.payment_status || "Aguardando comprovante"}`,
      order.pix_txid ? `TXID: ${order.pix_txid}` : "",
      order.pix_payload ? "Cliente recebeu QR Code PIX" : "",
    ].filter(Boolean);
  }
  const lines = [`Pagamento: ${order.payment_method}`];
  if (order.payment_method === "Dinheiro" && (order.change_for || order.cash_change_for)) {
    const changeFor = order.change_for || order.cash_change_for || 0;
    const changeAmount = order.change_amount || order.calculated_change || 0;
    lines.push(`Troco para: ${money(changeFor)}`);
    lines.push(`Troco estimado: ${money(changeAmount)}`);
  }
  if (order.payment_method === "Cartão" && order.card_type) lines.push(`Tipo: ${order.card_type}`);
  if (order.payment_method === "Vale alimentação/refeição" && order.voucher_brand) {
    lines.push(`Marca: ${order.voucher_brand}`);
    if (order.voucher_fee_percentage) lines.push(`Taxa da marca: ${order.voucher_fee_percentage}%`);
  }
  return lines;
}

function buildOrderNote(company: Company, order: Order, items: OrderItem[]) {
  const created = new Date(order.created_at);
  const date = created.toLocaleDateString("pt-BR");
  const time = created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const itemLines = items.length
    ? items.map((item) => `${item.quantity}x ${item.name} | Unit. ${money(item.unit_price)} | Subtotal ${money(item.total)}`).join("\n")
    : "Itens não informados";
  return [
    company.name,
    "Startt Delivery - Produzido por Startt Facilities",
    `Pedido #${displayOrderNumber(order)}`,
    `${date} às ${time}`,
    "",
    "Cliente",
    `Nome: ${order.customer_name || "Cliente"}`,
    `Telefone: ${order.customer_phone || "-"}`,
    `Endereço: ${order.customer_address || "Retirada"}`,
    "",
    "Itens vendidos",
    itemLines,
    "",
    "Totais",
    `Subtotal: ${money(order.subtotal)}`,
    `Entrega: ${money(order.delivery_fee)}`,
    order.discount ? `Descontos/cupons: ${money(order.discount)}` : "",
    `Total final: ${money(order.total)}`,
    "",
    "Pagamento",
    ...orderPaymentLines(order),
    order.customer_note ? `\nObservação do cliente: ${order.customer_note}` : "",
  ].filter(Boolean).join("\n");
}

function buildOrderNoteHtml(company: Company, order: Order, items: OrderItem[]) {
  const created = new Date(order.created_at);
  const date = created.toLocaleDateString("pt-BR");
  const time = created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const rows = items.map((item) => `<tr><td>${item.quantity}x</td><td>${htmlEscape(item.name)}</td><td>${money(item.unit_price)}</td><td>${money(item.total)}</td></tr>`).join("");
  const paymentRows = orderPaymentLines(order).map((line) => `<p>${htmlEscape(line)}</p>`).join("");
  return `<h1>${htmlEscape(company.name)}</h1><p><strong>Startt Delivery</strong> - Produzido por Startt Facilities</p><p><strong>Pedido:</strong> #${displayOrderNumber(order)}</p><p><strong>Data:</strong> ${date} às ${time}</p><h2>Cliente</h2><p><strong>Nome:</strong> ${htmlEscape(order.customer_name || "Cliente")}</p><p><strong>Telefone:</strong> ${htmlEscape(order.customer_phone || "-")}</p><p><strong>Endereço:</strong> ${htmlEscape(order.customer_address || "Retirada")}</p><h2>Itens vendidos</h2><table><tr><th>Qtd</th><th>Item</th><th>Unitário</th><th>Total</th></tr>${rows || "<tr><td colspan='4'>Itens não informados</td></tr>"}</table><h2>Totais</h2><p>Subtotal: ${money(order.subtotal)}</p><p>Entrega: ${money(order.delivery_fee)}</p>${order.discount ? `<p>Descontos/cupons: ${money(order.discount)}</p>` : ""}<h2>Total final: ${money(order.total)}</h2><h2>Pagamento</h2>${paymentRows}${order.customer_note ? `<h2>Observações</h2><p>${htmlEscape(order.customer_note)}</p>` : ""}<p class="signature">Startt Delivery - produzido por Startt Facilities</p>`;
}

function buildThermalOrderHtml(company: Company, order: Order, items: OrderItem[]) {
  const created = new Date(order.created_at);
  const date = created.toLocaleDateString("pt-BR");
  const time = created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const separator = `<div class="sep"></div>`;
  const itemRows = items.length
    ? items.map((item) => `<div class="item"><div class="item-title"><span>${item.quantity}x ${htmlEscape(item.name)}</span><span>${money(item.total)}</span></div><div class="muted">Unit. ${money(item.unit_price)}</div></div>`).join("")
    : `<div class="muted">Itens não informados</div>`;
  const paymentRows = orderPaymentLines(order).map((line) => `<div>${htmlEscape(line)}</div>`).join("");
  return `<main class="thermal-receipt">
    <section class="center"><strong class="store">${htmlEscape(company.name)}</strong><div>${htmlEscape(company.whatsapp || "-")}</div>${company.address ? `<div>${htmlEscape(company.address)}</div>` : ""}<div>Pedido #${displayOrderNumber(order)}</div><div>${date} ${time}</div></section>
    ${separator}
    <section><strong>CLIENTE</strong><div>Nome: ${htmlEscape(order.customer_name || "Cliente")}</div><div>Telefone: ${htmlEscape(order.customer_phone || "-")}</div><div>Entrega: ${order.fulfillment === "delivery" ? "Delivery" : "Retirada"}</div><div>Endereço: ${htmlEscape(order.customer_address || "Retirada")}</div></section>
    ${separator}
    <section><strong>ITENS</strong>${itemRows}</section>
    ${separator}
    <section><div class="line"><span>Subtotal</span><span>${money(order.subtotal)}</span></div><div class="line"><span>Taxa entrega</span><span>${money(order.delivery_fee)}</span></div>${order.discount ? `<div class="line"><span>Desconto/cupom</span><span>${money(order.discount)}</span></div>` : ""}<div class="line total"><span>Total</span><span>${money(order.total)}</span></div></section>
    ${separator}
    <section><strong>PAGAMENTO</strong>${paymentRows}</section>
    ${order.customer_note ? `${separator}<section><strong>OBSERVAÇÕES</strong><div>${htmlEscape(order.customer_note)}</div></section>` : ""}
    ${separator}
    <section class="center"><div>Pedido gerado pelo Startt Delivery</div><div>Produto Startt Facilities</div></section>
  </main>`;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Arquivo inválido"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem"));
    reader.readAsDataURL(file);
  });
}

function nextOrderNumber(orders: Order[], companyId: string) {
  const used = new Set(orders.filter((order) => order.company_id === companyId).map((order) => order.order_number).filter(Boolean));
  let candidate = Math.floor(10000 + Math.random() * 90000);
  while (used.has(candidate)) candidate = Math.floor(10000 + Math.random() * 90000);
  return candidate;
}

function displayOrderNumber(order: Order) {
  return order.order_number ? String(order.order_number).padStart(5, "0") : order.id;
}

function resolveOrderForPrint(order: Order, bundle: ReturnType<DatabaseApi["getCompanyBundle"]>) {
  const customer = bundle.customers.find((item) => item.id === order.customer_id);
  const items = bundle.order_items.filter((item) => item.order_id === order.id);
  return {
    order: { ...order, customer_name: order.customer_name || customer?.name, customer_phone: order.customer_phone || customer?.phone, customer_address: order.customer_address || customer?.address },
    items,
  };
}

function runSave(setSaving: (value: boolean) => void, action: () => void, success: string) {
  setSaving(true);
  window.setTimeout(() => {
    try {
      action();
      notify("success", success);
    } catch {
      notify("error", "Não foi possível salvar agora. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }, SAVE_DELAY);
}

function readableError(error: unknown) {
  if (!error) return "Erro desconhecido.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "Erro desconhecido.");
  return String(error);
}

function cartKey(companyId: string) {
  return `startt_delivery_cart_${companyId}`;
}

function readCart(companyId: string): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(cartKey(companyId)) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

function isInPeriod(date: string, start: string, end: string) {
  const day = date.slice(0, 10);
  return (!start || day >= start) && (!end || day <= end);
}

function openPrintable(title: string, html: string) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    notify("error", "Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
    return;
  }
  popup.document.write(`
    <html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#17211b} table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.signature{margin-top:32px;font-weight:700}</style>
    </head><body>${html}<script>window.print()</script></body></html>
  `);
  popup.document.close();
  notify("success", "Impressão preparada. Confirme a impressão na janela aberta.");
}

function openThermalPrintable(title: string, html: string) {
  const popup = window.open("", "_blank", "width=380,height=760");
  if (!popup) {
    notify("error", "O navegador bloqueou a janela de impressão. Use o botão Imprimir nota térmica.");
    return false;
  }
  popup.document.write(`<!doctype html><html><head><title>${htmlEscape(title)}</title><style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: white; color: #000; }
    .thermal-receipt { width: 80mm; padding: 4mm; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; line-height: 1.35; color: #000; }
    .store { display: block; font-size: 15px; text-transform: uppercase; }
    .center { text-align: center; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
    .line, .item-title { display: flex; justify-content: space-between; gap: 8px; }
    .line span:first-child, .item-title span:first-child { min-width: 0; overflow-wrap: anywhere; }
    .line span:last-child, .item-title span:last-child { white-space: nowrap; }
    .item { margin: 6px 0; }
    .muted { font-size: 11px; }
    .total { margin-top: 6px; font-size: 14px; font-weight: 700; }
    @media print {
      body { margin: 0; background: white; }
      .thermal-receipt { width: 80mm; padding: 4mm; }
      .no-print { display: none !important; }
    }
  </style></head><body>${html}<script>window.onload=function(){try{window.print()}catch(e){}}</script></body></html>`);
  popup.document.close();
  notify("success", "Nota térmica preparada. Confirme a impressão na janela aberta.");
  return true;
}

function App() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const companyRouteSlug = parts[0] && !["master", "sobre", "contatos"].includes(parts[0]) ? parts[0] : "";
  const companyRouteNeedsAdminData = Boolean(companyRouteSlug && parts[1] === "admin");
  const companyRouteAdminScreen = (parts[1] === "admin" ? (parts[2] === "login" ? "login" : parts[2] || "dashboard") : "menu") as AdminScreen | "login" | "menu";
  const emergencyPublicRoute = Boolean(STARTT_EMERGENCY_MODE && companyRouteSlug && !companyRouteNeedsAdminData);
  const [dbState, setDbState] = useState<MockDatabaseState>(() => getCachedCompanyRouteSnapshot(companyRouteSlug) || getInitialDatabaseSnapshot());
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [showRouteLoading, setShowRouteLoading] = useState(false);
  const [savePulse, setSavePulse] = useState(0);
  const pendingSaveRef = useRef(false);
  const savingRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const db = useMemo(() => createDatabaseApi(dbState), [dbState]);
  const withToast = (node: React.ReactNode) => <><ToastHost />{node}</>;
  const companyForSeo = parts[0] ? db.getCompanyBySlug(parts[0]) : undefined;
  const setPersistentDbState = useCallback((action: React.SetStateAction<MockDatabaseState>) => {
    pendingSaveRef.current = true;
    setDbState(action);
  }, [companyRouteSlug, companyRouteNeedsAdminData, emergencyPublicRoute]);

  useEffect(() => {
    if (!parts[0] || ["sobre", "contatos"].includes(parts[0])) {
      applySeo({ title: DEFAULT_SEO_TITLE, description: DEFAULT_SEO_DESCRIPTION, path: parts[0] ? `/${parts[0]}` : "/", image: DEFAULT_SEO_IMAGE });
      return;
    }
    if (parts[0] === "master" || parts[1] === "admin" || parts[1] === "checkout") {
      applySeo({ title: "Startt Delivery — Painel", description: DEFAULT_SEO_DESCRIPTION, path: window.location.pathname, image: DEFAULT_SEO_IMAGE });
      return;
    }
    if (companyForSeo) {
      applySeo({
        title: `${companyForSeo.name} — Cardápio online no Startt Delivery`,
        description: `Acesse o cardápio digital de ${companyForSeo.name}, faça seu pedido pelo WhatsApp e acompanhe as opções disponíveis.`,
        path: `/${companyForSeo.slug}`,
        image: companyForSeo.logo_url || companyForSeo.hero_image || DEFAULT_SEO_IMAGE,
      });
      return;
    }
    applySeo({ title: DEFAULT_SEO_TITLE, description: DEFAULT_SEO_DESCRIPTION, path: window.location.pathname, image: DEFAULT_SEO_IMAGE });
  }, [window.location.pathname, companyForSeo?.id, companyForSeo?.name, companyForSeo?.slug, companyForSeo?.logo_url, companyForSeo?.hero_image]);

  useEffect(() => {
    let alive = true;
    const loadingTimer = window.setTimeout(() => {
      if (alive) setShowRouteLoading(true);
    }, 700);
    const primaryLoad = companyRouteSlug ? loadCompanyRouteSnapshot(companyRouteSlug, companyRouteNeedsAdminData, companyRouteAdminScreen === "menu" ? "dashboard" : companyRouteAdminScreen) : loadDatabaseSnapshot();
    primaryLoad
      .then((snapshot) => {
        if (!alive) return;
        setDbState(snapshot);
        if (companyRouteSlug && snapshot.companies.some((company) => company.slug === companyRouteSlug)) cacheCompanyRouteSnapshot(companyRouteSlug, snapshot);
        setDatabaseError("");
        setShowRouteLoading(false);
        if (companyRouteSlug && !emergencyPublicRoute && !companyRouteNeedsAdminData) {
          loadDatabaseSnapshot()
            .then((fullSnapshot) => {
              if (alive && !pendingSaveRef.current && !savingRef.current) setDbState(fullSnapshot);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (alive) setDatabaseError("Não foi possível sincronizar com o banco. Dados principais podem estar desatualizados.");
      })
      .finally(() => {
        if (alive) setDatabaseReady(true);
        window.clearTimeout(loadingTimer);
      });
    return () => {
      alive = false;
      window.clearTimeout(loadingTimer);
    };
  }, [companyRouteSlug, companyRouteNeedsAdminData, companyRouteAdminScreen, emergencyPublicRoute]);

  useEffect(() => {
    if (!databaseReady || !pendingSaveRef.current || savingRef.current) return;
    const snapshot = dbState;
    pendingSaveRef.current = false;
    savingRef.current = true;
    persistDatabaseSnapshot(snapshot)
      .then(() => {
        setDatabaseError("");
        emitDatabasePulse(companyRouteSlug ? snapshot.companies.find((company) => company.slug === companyRouteSlug)?.id : undefined);
      })
      .catch((error) => setDatabaseError(`Falha ao salvar no banco: ${readableError(error)}`))
      .finally(() => {
        savingRef.current = false;
        if (pendingSaveRef.current) setSavePulse((value) => value + 1);
      });
  }, [dbState, databaseReady, savePulse]);

  useEffect(() => {
    if (emergencyPublicRoute) return;
    if (companyRouteNeedsAdminData) {
      if (companyRouteAdminScreen !== "pedidos") return;
      const interval = window.setInterval(() => {
        if (savingRef.current || pendingSaveRef.current || refreshInFlightRef.current) return;
        refreshInFlightRef.current = true;
        const companyId = dbState.companies.find((company) => company.slug === companyRouteSlug)?.id;
        if (!companyId) {
          refreshInFlightRef.current = false;
          return;
        }
        loadCompanyOrdersRefresh(companyId)
          .then(({ orders, order_items }) => {
            setDbState((current) => ({ ...current, orders, order_items }));
            setDatabaseError("");
          })
          .catch(() => setDatabaseError("Não foi possível atualizar pedidos. Atualize a tela se necessário."))
          .finally(() => {
            refreshInFlightRef.current = false;
          });
      }, 30000);
      return () => window.clearInterval(interval);
    }
    function refreshFromStorage(event?: StorageEvent) {
      if (event && event.key !== DATABASE_STORAGE_KEY && event.key !== DATABASE_CHANGE_PULSE_KEY) return;
      if (savingRef.current || pendingSaveRef.current) return;
      (companyRouteSlug ? loadCompanyRouteSnapshot(companyRouteSlug, companyRouteNeedsAdminData, "dashboard") : loadDatabaseSnapshot()).then(setDbState);
    }
    function refreshFromBackend() {
      if (savingRef.current || pendingSaveRef.current || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      (companyRouteSlug ? loadCompanyRouteSnapshot(companyRouteSlug, companyRouteNeedsAdminData, "dashboard") : loadDatabaseSnapshot())
        .then((snapshot) => {
          setDbState(snapshot);
          setDatabaseError("");
        })
        .catch(() => setDatabaseError("Não foi possível atualizar os dados do banco. A conexão com o Supabase pode estar instável."))
        .finally(() => {
          refreshInFlightRef.current = false;
        });
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshFromBackend();
    }
    function handleSyncError(event: Event) {
      setDatabaseError(`Falha de sincronização com o banco: ${readableError((event as CustomEvent).detail)}`);
    }
    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener(DATABASE_CHANGE_PULSE_EVENT, refreshFromBackend);
    window.addEventListener("focus", refreshFromBackend);
    window.addEventListener(DATABASE_SYNC_ERROR_EVENT, handleSyncError);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(refreshFromBackend, companyRouteNeedsAdminData ? 5000 : 30000);
    return () => {
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener(DATABASE_CHANGE_PULSE_EVENT, refreshFromBackend);
      window.removeEventListener("focus", refreshFromBackend);
      window.removeEventListener(DATABASE_SYNC_ERROR_EVENT, handleSyncError);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [companyRouteSlug, companyRouteNeedsAdminData, companyRouteAdminScreen, emergencyPublicRoute, dbState.companies]);

  useEffect(() => {
    if (STARTT_EMERGENCY_MODE) return;
    if (!companyRouteSlug || !companyRouteNeedsAdminData || !isSupabaseConfigured || !supabase) return;
    const supabaseClient = supabase;
    const company = dbState.companies.find((item) => item.slug === companyRouteSlug);
    if (!company?.id) return;

    const refreshAdminData = () => {
      if (savingRef.current || pendingSaveRef.current || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      loadCompanyRouteSnapshot(companyRouteSlug, true)
        .then((snapshot) => {
          setDbState(snapshot);
          setDatabaseError("");
        })
        .catch(() => setDatabaseError("Não foi possível atualizar pedidos em tempo real. Atualize a tela se necessário."))
        .finally(() => {
          refreshInFlightRef.current = false;
        });
    };

    const channel = supabaseClient
      .channel(`startt-admin-orders-${company.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${company.id}` }, refreshAdminData)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `company_id=eq.${company.id}` }, refreshAdminData)
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [companyRouteSlug, companyRouteNeedsAdminData, dbState.companies.map((company) => `${company.slug}:${company.id}`).join("|")]);

  const shell = (node: React.ReactNode) => withToast(<>{databaseError && <div className="sticky top-0 z-[70] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-black text-amber-900">{databaseError}</div>}{node}</>);

  if (parts[0] === "master") {
    return shell(<MasterApp db={db} setDbState={setPersistentDbState} screen={(parts[1] as MasterScreen) || "dashboard"} login={parts[1] === "login"} />);
  }

  if (!parts[0] || parts[0] === "sobre" || parts[0] === "contatos") return shell(<InstitutionalLanding />);

  const company = db.getCompanyBySlug(parts[0]);
  if (!company && !databaseReady) return shell(showRouteLoading ? <CompanyLoadingScreen /> : <InstantRouteShell />);
  if (!company) return shell(<NotFound message={`Não encontramos a empresa “/${parts[0]}”. Confira o link e tente novamente.`} />);

  if (parts[1] === "admin") {
    const screen = (parts[2] === "login" ? "dashboard" : parts[2] || "dashboard") as AdminScreen;
    return shell(<CompanyAdmin db={db} setDbState={setPersistentDbState} company={company} screen={screen} login={parts[2] === "login"} />);
  }

  if (parts[1] === "checkout") {
    return shell(<PublicMenu db={db} setDbState={setPersistentDbState} company={company} checkoutOnly />);
  }

  return shell(<PublicMenu db={db} setDbState={setPersistentDbState} company={company} />);
}

function ToastHost() {
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ type: ToastType; message: string }>).detail;
      setToast(detail);
      window.setTimeout(() => setToast(null), 3400);
    }
    window.addEventListener("startt:toast", onToast);
    return () => window.removeEventListener("startt:toast", onToast);
  }, []);
  if (!toast) return null;
  const color = toast.type === "success" ? "border-startt-green bg-white text-startt-ink" : toast.type === "error" ? "border-startt-red bg-white text-startt-red" : "border-startt-yellow bg-white text-startt-ink";
  return <div className={`fixed right-4 top-4 z-[80] max-w-sm rounded-lg border p-4 text-sm font-bold shadow-2xl ${color}`}>{toast.message}</div>;
}

function AppHeader({ company }: { company?: Company }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-startt-paper/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-[min(1280px,100%)] items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-3">
            {company?.logo_url ? <img className="h-11 w-11 rounded-lg object-cover" src={companyLogoUrl(company)} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <img className="h-11 w-11 rounded-lg object-cover" src="/startt-logo.png" alt="Startt Delivery" />}
          <span>
            <strong className="block leading-tight">{company?.name || "Startt Delivery"}</strong>
            <small className="block text-startt-muted">Produzido por: Startt Facilities</small>
          </span>
        </a>
        {company ? (
          <a href={`/${company.slug}/admin/login`} className="rounded-lg border border-black/10 bg-white px-4 py-3 font-extrabold">Admin</a>
        ) : (
          <a href="/master/login" className="rounded-lg border border-black/10 bg-white px-4 py-3 font-extrabold">Master</a>
        )}
      </div>
    </header>
  );
}

function InstitutionalLanding() {
  const whatsappDemo = "https://wa.me/5551992885988?text=Ol%C3%A1%21%20Vim%20pelo%20site%20da%20Startt%20Delivery%20e%20gostaria%20de%20solicitar%20uma%20demonstra%C3%A7%C3%A3o.";
  const [lead, setLead] = useState({ name: "", business: "", whatsapp: "", email: "", city: "", instagram: "", message: "" });
  const [leadError, setLeadError] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const benefits = ["Cardápio digital próprio", "Pedidos via WhatsApp", "Painel administrativo", "Controle de clientes", "Identidade própria", "Sem depender de marketplace", "Sem pagamento no app", "Rápido de usar", "Visual profissional"];
  const steps = ["Configuramos sua lancheria com identidade, slug e dados comerciais.", "Você cadastra produtos, categorias, horários, fretes e cupons.", "O cliente acessa seu cardápio e finaliza o pedido direto no WhatsApp."];
  function updateLead(field: keyof typeof lead, value: string) {
    setLead((current) => ({ ...current, [field]: value }));
    setLeadError("");
  }
  function leadBody() {
    return [
      "Novo interesse pelo Startt Delivery",
      "",
      `Nome: ${lead.name}`,
      `Lancheria: ${lead.business}`,
      `WhatsApp: ${lead.whatsapp}`,
      `E-mail: ${lead.email}`,
      `Cidade: ${lead.city}`,
      `Instagram: ${lead.instagram || "-"}`,
      "",
      `Mensagem: ${lead.message || "-"}`,
    ].join("\n");
  }
  function validateLead() {
    if (!lead.name.trim() || !lead.business.trim() || !lead.whatsapp.trim() || !lead.email.trim() || !lead.city.trim()) {
      setLeadError("Preencha nome, lancheria, WhatsApp, e-mail e cidade para solicitar a demonstração.");
      return false;
    }
    return true;
  }
  function submitLead(event: React.FormEvent) {
    event.preventDefault();
    if (!validateLead()) return;
    setLeadSent(true);
    window.location.href = `mailto:disconziinc@gmail.com?subject=${encodeURIComponent("Solicitação de demonstração - Startt Delivery")}&body=${encodeURIComponent(leadBody())}`;
  }
  function sendLeadWhatsApp() {
    if (!validateLead()) return;
    setLeadSent(true);
    window.open(`https://wa.me/5551992885988?text=${encodeURIComponent(leadBody())}`, "_blank", "noopener,noreferrer");
  }
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0A]/86 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1180px,100%)] items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img className="h-11 w-11 rounded-xl object-cover" src="/startt-logo.png" alt="Startt Delivery" />
            <span className="leading-tight"><strong className="block text-sm font-semibold">Startt Delivery</strong><small className="text-xs text-white/55">por Startt Facilities</small></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex">
            <a href="#home" className="hover:text-white">Home</a>
            <a href="#contatos" className="hover:text-white">Contatos</a>
            <a href="#sobre" className="hover:text-white">Sobre nós</a>
          </nav>
          <a href={whatsappDemo} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6A00] px-4 text-sm font-semibold text-white shadow-lg shadow-[#FF6A00]/25">Solicite uma demonstração</a>
        </div>
      </header>

      <section id="home" className="relative isolate overflow-hidden px-4 pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,106,0,.28),transparent_34rem),linear-gradient(180deg,#0A0A0A_0%,#1A1A1A_58%,#0A0A0A_100%)]" />
        <div className="mx-auto grid w-[min(1180px,100%)] items-center gap-10 lg:grid-cols-[1.02fr_.98fr]">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase text-[#FFB27A]"><Sparkles size={15} /> SaaS para negócios locais de alimentação</span>
            <h1 className="mt-6 text-[clamp(2.55rem,9vw,5.8rem)] font-semibold leading-[.94] tracking-normal">Seu cardápio do seu jeito</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 md:text-lg">Uma plataforma moderna para lancherias criarem seu próprio cardápio digital, receberem pedidos pelo WhatsApp e atenderem seus clientes com mais velocidade, identidade e controle.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={whatsappDemo} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 font-semibold text-white shadow-xl shadow-[#FF6A00]/25"><MessageCircle size={18} /> Solicite uma demonstração</a>
              <a href="#lead" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 font-semibold text-white hover:bg-white/10">Ver solução</a>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[.78fr_1fr] lg:items-center">
            <div className="mx-auto w-[min(260px,82vw)] rounded-[2.2rem] border border-white/14 bg-[#111] p-3 shadow-2xl shadow-black/40">
              <div className="overflow-hidden rounded-[1.7rem] bg-[#F5F5F5] text-[#0A0A0A]">
                <div className="bg-[#FF6A00] p-5 text-white"><p className="text-xs font-semibold uppercase">Cardápio digital</p><strong className="mt-12 block text-2xl font-semibold leading-tight">Burger Prime</strong><p className="text-sm text-white/80">Aberto hoje até 23h</p></div>
                <div className="grid gap-3 p-4">{["Combo artesanal", "Pizza brotinho", "Batata especial"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm"><div><strong className="text-sm">{item}</strong><p className="text-xs text-black/45">Pedido via WhatsApp</p></div><span className="rounded-full bg-[#FF6A00]/10 px-3 py-1 text-xs font-bold text-[#FF6A00]">R$ {29 + index * 8}</span></div>)}</div>
              </div>
            </div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[.06] p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase text-white/45">Dashboard</p><h2 className="text-2xl font-semibold">Controle seus produtos, clientes e pedidos</h2></div><BarChart3 className="text-[#FF6A00]" /></div>
              <div className="grid gap-3 sm:grid-cols-2"><MetricMini label="Pedidos hoje" value="42" /><MetricMini label="Clientes" value="1.284" /><MetricMini label="Ticket médio" value="R$ 46" /><MetricMini label="WhatsApp" value="Direto" /></div>
              <div className="mt-5 h-24 rounded-2xl bg-[linear-gradient(135deg,rgba(255,106,0,.9),rgba(255,255,255,.16))]" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid w-[min(1180px,100%)] gap-6">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold md:text-5xl">Delivery próprio para sua lancheria</h2><p className="mt-4 leading-7 text-white/62">Sem marketplace no meio, sem complexidade desnecessária e com a sua marca na frente.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{benefits.map((benefit) => <article key={benefit} className="rounded-2xl border border-white/10 bg-white/[.045] p-5"><Check className="mb-4 text-[#FF6A00]" size={20} /><strong className="font-semibold">{benefit}</strong></article>)}</div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid w-[min(1180px,100%)] gap-8 rounded-[2rem] border border-white/10 bg-[#1A1A1A] p-6 md:p-10 lg:grid-cols-[.8fr_1.2fr]">
          <div><span className="text-sm font-semibold uppercase text-[#FF6A00]">Como funciona</span><h2 className="mt-3 text-3xl font-semibold md:text-4xl">Pedidos direto no WhatsApp</h2></div>
          <div className="grid gap-4">{steps.map((step, index) => <div key={step} className="flex gap-4 rounded-2xl bg-white/[.04] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FF6A00] font-semibold">{index + 1}</span><p className="leading-7 text-white/70">{step}</p></div>)}</div>
        </div>
      </section>

      <section id="sobre" className="px-4 py-20 md:py-28">
        <div className="mx-auto grid w-[min(1180px,100%)] items-center gap-10 lg:grid-cols-[1.04fr_.96fr] lg:gap-16">
          <div className="grid gap-5 text-white/68">
            <span className="text-sm font-semibold uppercase tracking-normal text-[#FF6A00]">Sobre nós</span>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-white md:text-5xl">Sobre a Startt Delivery</h2>
            <div className="grid max-w-2xl gap-4 text-base leading-8">
              <p>O Startt Delivery nasceu dentro do ecossistema Startt Facilities com o objetivo de oferecer uma solução moderna, acessível e completa para lancherias que desejam profissionalizar sua presença digital.</p>
              <p>Idealizado por Paulo Disconzi, em Porto Alegre-RS, o sistema foi desenvolvido para atender negócios que precisam de mais autonomia, organização e identidade própria no atendimento online.</p>
              <p>A proposta é simples: permitir que cada lancheria tenha seu próprio cardápio digital, receba pedidos diretamente pelo WhatsApp e ofereça uma experiência mais rápida, humana e profissional para seus clientes.</p>
              <p>Mais do que uma ferramenta, o Startt Delivery foi criado para ajudar pequenos negócios a venderem melhor, fortalecerem sua marca e terem mais controle sobre seus pedidos e clientes.</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[460px] rounded-[2rem] border border-white/10 bg-white/[.045] p-2.5 shadow-2xl shadow-black/30 lg:max-w-none">
            <img className="aspect-[4/5] w-full rounded-[1.55rem] object-cover object-[50%_18%] shadow-[0_24px_80px_-48px_rgba(255,106,0,.45)]" src="/paulo-disconzi.jpeg" alt="Paulo Disconzi" />
          </div>
        </div>
      </section>

      <section id="contatos" className="px-4 py-16">
        <div className="mx-auto grid w-[min(1180px,100%)] gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[.045] p-6 md:p-8">
            <h2 className="text-3xl font-semibold">Fale com a Startt</h2>
            <div className="mt-6 grid gap-4 text-white/70">
              <a className="flex items-center gap-3 hover:text-white" href="mailto:disconziinc@gmail.com"><Mail size={18} /> disconziinc@gmail.com</a>
              <a className="flex items-center gap-3 hover:text-white" href={whatsappDemo} target="_blank" rel="noreferrer"><MessageCircle size={18} /> +5551992885988</a>
              <a className="flex items-center gap-3 hover:text-white" href="https://www.instagram.com/startt.eco" target="_blank" rel="noreferrer"><Smartphone size={18} /> @startt.eco</a>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href={whatsappDemo} target="_blank" rel="noreferrer" className="rounded-full bg-[#FF6A00] px-5 py-3 text-center font-semibold text-white">Falar com a Startt</a><a href={whatsappDemo} target="_blank" rel="noreferrer" className="rounded-full border border-white/12 px-5 py-3 text-center font-semibold">Solicitar demonstração</a></div>
          </div>
          <form id="lead" onSubmit={submitLead} className="grid gap-4 rounded-[2rem] border border-white/10 bg-[#F5F5F5] p-5 text-[#0A0A0A] shadow-2xl md:p-8">
            <div><h2 className="text-3xl font-semibold">Solicite uma demonstração</h2><p className="mt-2 text-sm leading-6 text-black/58">Conte um pouco sobre sua lancheria. Você pode enviar por e-mail ou WhatsApp.</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><LeadInput placeholder="Nome" value={lead.name} onChange={(value) => updateLead("name", value)} /><LeadInput placeholder="Nome da lancheria" value={lead.business} onChange={(value) => updateLead("business", value)} /><LeadInput placeholder="WhatsApp" value={lead.whatsapp} onChange={(value) => updateLead("whatsapp", value)} /><LeadInput placeholder="E-mail" value={lead.email} onChange={(value) => updateLead("email", value)} /><LeadInput placeholder="Cidade" value={lead.city} onChange={(value) => updateLead("city", value)} /><LeadInput placeholder="Instagram da lancheria" value={lead.instagram} onChange={(value) => updateLead("instagram", value)} /></div>
            <textarea className="min-h-28 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-[#FF6A00]" placeholder="Mensagem" value={lead.message} onChange={(event) => updateLead("message", event.target.value)} />
            {leadError && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-startt-red">{leadError}</p>}
            {leadSent && <p className="rounded-2xl bg-orange-50 p-3 text-sm font-semibold text-[#FF6A00]">Dados preparados com sucesso. Finalize o envio no app aberto.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><button className="min-h-12 rounded-full bg-[#FF6A00] px-5 font-semibold text-white">Solicitar demonstração</button><button type="button" onClick={sendLeadWhatsApp} className="min-h-12 rounded-full border border-black/10 px-5 font-semibold">Enviar pelo WhatsApp</button></div>
          </form>
        </div>
      </section>
    </main>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/18 p-4"><p className="text-xs font-semibold uppercase text-white/42">{label}</p><strong className="mt-2 block text-2xl font-semibold">{value}</strong></div>;
}

function LeadInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <input className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-[#FF6A00]" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function PublicMenu({ db, setDbState, company, checkoutOnly = false }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; checkoutOnly?: boolean }) {
  const bundle = db.getCompanyBundle(company.id);
  const categories = bundle.categories.filter((item) => item.active);
  const products = bundle.products.filter((item) => item.active);
  const activeZones = bundle.delivery_zones.filter((item) => item.active);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cart, setCart] = useState<CartItem[]>(() => readCart(company.id));
  const [cartOpen, setCartOpen] = useState(checkoutOnly);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(company.delivery_enabled ? "delivery" : "pickup");
  const [zoneId, setZoneId] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState>({ name: "", phone: "", cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "", payment_method: "Pix" as PaymentMethod, card_type: "Débito", voucher_brand_id: "", needs_change: "Não", coupon: "", cash_change_for: "", customer_note: "" });
  const [pixTxid, setPixTxid] = useState(createPixTxid);
  const [pixQrCode, setPixQrCode] = useState("");
  const [phoneGateSkipped, setPhoneGateSkipped] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState("");
  const [phoneLookupMessage, setPhoneLookupMessage] = useState("");

  useEffect(() => localStorage.setItem(cartKey(company.id), JSON.stringify(cart)), [cart, company.id]);

  const filtered = products.filter((product) => {
    const byCategory = categoryId === "all" || product.category_id === categoryId;
    const byQuery = `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase());
    return byCategory && byQuery;
  });
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const coupon = bundle.coupons.find((item) => item.company_id === company.id && item.active && item.code.toUpperCase() === checkout.coupon.trim().toUpperCase() && subtotal >= item.minimum_order && item.used_count < item.usage_limit && (!item.expires_at || item.expires_at >= todayInput()));
  const discount = coupon ? (coupon.type === "percentual" ? subtotal * (coupon.value / 100) : coupon.value) : 0;
  const zone = activeZones.find((item) => item.id === zoneId);
  const deliveryFee = fulfillment === "delivery" ? zone?.fee || 0 : 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const pixEnabled = Boolean(bundle.settings?.pix_enabled && normalizePixKey(bundle.settings.pix_key || "").valid);
  const pixPayload = pixEnabled && checkout.payment_method === "Pix" ? buildPixPayload(bundle.settings, total, pixTxid) : "";
  const activeVoucherBrands = bundle.voucher_brands.filter((item) => item.active);
  const voucherBrand = bundle.voucher_brands.find((item) => item.id === checkout.voucher_brand_id);
  const cashChangeFor = checkout.needs_change === "Sim" ? parseMoney(checkout.cash_change_for) || 0 : 0;
  const calculatedChange = checkout.payment_method === "Dinheiro" && cashChangeFor > 0 ? Math.max(0, cashChangeFor - total) : 0;
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    if (!pixEnabled && checkout.payment_method === "Pix") setCheckout((current) => ({ ...current, payment_method: "Dinheiro" }));
  }, [checkout.payment_method, pixEnabled]);

  useEffect(() => {
    let active = true;
    if (!pixPayload) {
      setPixQrCode("");
      return;
    }
    QRCode.toDataURL(pixPayload, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((dataUrl) => { if (active) setPixQrCode(dataUrl); })
      .catch(() => { if (active) setPixQrCode(""); });
    return () => { active = false; };
  }, [pixPayload]);

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { ...product, qty: 1 }];
    });
    setCartOpen(true);
    notify("success", `${product.name} adicionado ao pedido.`);
  }

  function lookupCustomerPhone() {
    const normalized = normalizePhone(phoneLookup);
    if (normalized.length < 10) {
      notify("error", "Informe um telefone com DDD para buscar seu cadastro.");
      return;
    }
    const customer = findCustomerByPhone(bundle.customers, company.id, phoneLookup);
    if (customer) {
      setCheckout({ ...checkout, name: customer.name, phone: customer.phone, address: customer.address });
      setPhoneLookupMessage(`Encontramos seu cadastro, ${customer.name}. Seus dados já foram preenchidos para agilizar o pedido.`);
      notify("success", "Cadastro encontrado e preenchido.");
      return;
    }
    setCheckout({ ...checkout, phone: phoneLookup });
    setPhoneLookupMessage("Ainda não encontramos esse telefone. Você pode navegar normalmente e finalizar preenchendo nome e endereço.");
    notify("info", "Telefone guardado para o checkout.");
  }

  async function finishOrder() {
    if (!cart.length) {
      notify("error", "Adicione pelo menos um produto antes de finalizar.");
      return;
    }
    const normalizedPhone = normalizePhone(checkout.phone);
    if (!checkout.name.trim() || normalizedPhone.length < 10) {
      notify("error", "Informe nome e telefone com DDD para finalizar o pedido.");
      return;
    }
    if (!checkout.address.trim()) {
      notify("error", "Informe o endereço para finalizar o cadastro do pedido.");
      return;
    }
    if (fulfillment === "delivery" && !zoneId) {
      notify("error", "Informe endereço e bairro de entrega.");
      return;
    }
    if (checkout.payment_method === "Cartão" && !checkout.card_type) {
      notify("error", "Escolha débito ou crédito para registrar o pagamento.");
      return;
    }
    if (checkout.payment_method === "Vale alimentação/refeição" && !voucherBrand) {
      notify("error", "Escolha a marca do vale para registrar o pagamento.");
      return;
    }
    if (checkout.payment_method === "Pix" && !pixPayload) {
      notify("error", "PIX indisponível. Confira a configuração da chave PIX da lancheria.");
      return;
    }
    const orderId = id("ord");
    const createdAt = new Date().toISOString();
    const orderNumber = nextOrderNumber(db.orders, company.id);
    const fullAddress = fulfillment === "delivery" ? `${checkout.address}, ${checkout.number}${checkout.complement ? ` - ${checkout.complement}` : ""} - ${checkout.neighborhood} - ${checkout.city}/${checkout.state} - CEP ${checkout.cep}` : checkout.address.trim();
    const existingCustomer = findCustomerByPhone(db.customers, company.id, normalizedPhone);
    const customerId = existingCustomer?.id || id("cus");
    const paymentDetails = orderPaymentLines({
      id: orderId,
      order_number: orderNumber,
      company_id: company.id,
      customer_id: customerId,
      status: "novo",
      fulfillment,
      subtotal,
      discount,
      delivery_fee: deliveryFee,
      total,
      payment_method: checkout.payment_method,
      payment_status: checkout.payment_method === "Pix" ? "Aguardando comprovante" : undefined,
      pix_txid: checkout.payment_method === "Pix" ? pixTxid : undefined,
      pix_payload: checkout.payment_method === "Pix" ? pixPayload : undefined,
      change_for: cashChangeFor,
      change_amount: calculatedChange,
      cash_change_for: cashChangeFor,
      calculated_change: calculatedChange,
      card_type: checkout.card_type,
      voucher_brand: voucherBrand?.name,
      voucher_fee_percentage: voucherBrand?.fee_percentage,
      created_at: createdAt,
    }).join(" | ");
    const finalPixQrCode = checkout.payment_method === "Pix" && !pixQrCode ? await QRCode.toDataURL(pixPayload, { margin: 1, width: 240, errorCorrectionLevel: "M" }) : pixQrCode;
    const order: Order = { id: orderId, order_number: orderNumber, company_id: company.id, customer_id: customerId, customer_name: checkout.name.trim(), customer_phone: checkout.phone.trim(), normalized_phone: normalizedPhone, customer_address: fullAddress, status: "novo", fulfillment, delivery_zone_id: fulfillment === "delivery" ? zoneId : undefined, subtotal, discount, delivery_fee: deliveryFee, total, payment_method: checkout.payment_method, payment_details: paymentDetails, payment_status: checkout.payment_method === "Pix" ? "Aguardando comprovante" : undefined, pix_txid: checkout.payment_method === "Pix" ? pixTxid : undefined, pix_payload: checkout.payment_method === "Pix" ? pixPayload : undefined, pix_qr_code: checkout.payment_method === "Pix" ? finalPixQrCode : undefined, cash_change_for: cashChangeFor, calculated_change: calculatedChange, change_for: cashChangeFor, change_amount: calculatedChange, card_type: checkout.payment_method === "Cartão" ? checkout.card_type : undefined, voucher_brand: checkout.payment_method === "Vale alimentação/refeição" ? voucherBrand?.name : undefined, voucher_fee_percentage: checkout.payment_method === "Vale alimentação/refeição" ? voucherBrand?.fee_percentage : undefined, customer_note: checkout.customer_note, archived: false, removed_from_dashboard: false, qz_printed_at: "", qz_print_attempts: 0, qz_print_error: "", created_at: createdAt };
    const orderItems: OrderItem[] = cart.map((item) => ({ id: id("oit"), company_id: company.id, order_id: orderId, product_id: item.id, name: item.name, quantity: item.qty, unit_price: item.price, total: item.qty * item.price }));
    setDbState((current) => {
      const customerInState = findCustomerByPhone(current.customers, company.id, normalizedPhone);
      const customer: Customer = customerInState
        ? { ...customerInState, name: checkout.name.trim(), phone: checkout.phone.trim(), normalized_phone: normalizedPhone, address: fullAddress, updated_at: createdAt, last_order_at: createdAt, total_orders: (customerInState.total_orders || 0) + 1, total_spent: (customerInState.total_spent || 0) + total }
        : { id: customerId, company_id: company.id, name: checkout.name.trim(), phone: checkout.phone.trim(), normalized_phone: normalizedPhone, address: fullAddress, created_at: createdAt, updated_at: createdAt, last_order_at: createdAt, total_orders: 1, total_spent: total };
      return {
        ...current,
        customers: customerInState ? current.customers.map((item) => item.id === customerInState.id ? customer : item) : [customer, ...current.customers],
        coupons: coupon ? current.coupons.map((item) => item.id === coupon.id && item.company_id === company.id ? { ...item, used_count: item.used_count + 1 } : item) : current.coupons,
        orders: [order, ...current.orders],
        order_items: [...orderItems, ...current.order_items],
      };
    });
    window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { company_id: company.id, order_id: orderId } }));
    const message = buildOrderNote(company, order, orderItems);
    window.open(`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
    setCart([]);
    setPixTxid(createPixTxid());
    setCartOpen(false);
    notify("success", "Pedido criado e mensagem do WhatsApp preparada.");
  }

  if (["blocked", "canceled", "disabled"].includes(company.status)) {
    return <Suspended company={company} publicView />;
  }

  return (
    <main className="min-h-screen bg-[#f4f4f3]">
      <header className="sticky top-0 z-40 bg-[#121212] px-4 py-3 text-white shadow-xl shadow-black/20">
        <div className="mx-auto flex w-[min(1180px,100%)] items-center justify-between gap-3">
          <a href={`/${company.slug}`} className="flex min-w-0 items-center gap-3">
            {company.logo_url ? <img className="h-10 w-10 rounded-full object-cover" src={companyLogoUrl(company)} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-startt-green text-sm font-black">DOG</span>}
            <strong className="truncate text-sm uppercase tracking-[0.18em]">{company.name}</strong>
          </a>
          <div className="flex items-center gap-2">
            <button onClick={() => setCartOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-xl text-white transition hover:bg-white/10" aria-label="Abrir carrinho">
              <ShoppingBag size={22} />
              {itemCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-startt-green px-1 text-xs font-black">{itemCount}</span>}
            </button>
            <button onClick={() => setCompanyInfoOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl text-white transition hover:bg-white/10" aria-label="Informações"><Menu size={22} /></button>
          </div>
        </div>
      </header>
      {!checkoutOnly && (
        <section className="bg-[#121212] px-4 pb-7 pt-5 text-white">
          <div className="mx-auto w-[min(1180px,100%)]">
            <h1 className="text-4xl font-black uppercase leading-none tracking-tight md:text-6xl">
              Cardápio <span className="text-startt-green">Digital</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/72">Escolha seus itens e envie o pedido direto pelo WhatsApp</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 font-black text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {company.is_open ? "Aberto agora" : "Fechado agora"}</span>
              <span className="text-white/56">{company.opening_hours.replace("Aberto hoje, ", "")}</span>
              <span className="text-white/56">{company.estimated_delivery_time}</span>
              <span className="inline-flex items-center gap-1 text-white/70"><Star size={14} fill="currentColor" /> 4,8</span>
            </div>
          </div>
        </section>
      )}
      <section className="mx-auto w-[min(1180px,calc(100%-24px))] py-4">
        {!checkoutOnly && !phoneGateSkipped && !checkout.name && (
          <div className="mb-4 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <div className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-startt-green/10 px-3 py-1 text-xs font-black uppercase text-startt-green"><UsersRound size={14} /> Cadastro inteligente</span>
                <h2 className="mt-3 text-2xl font-black tracking-tight">Agilize seu pedido pelo telefone</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-startt-muted">Informe seu telefone para buscarmos seus dados. Se ainda não tiver cadastro, você poderá finalizar com nome e endereço e receber novidades e cupons da lancheria.</p>
                {phoneLookupMessage && <p className="mt-3 rounded-2xl bg-startt-paper px-4 py-3 text-sm font-bold text-startt-ink">{phoneLookupMessage}</p>}
              </div>
              <div className="grid gap-3 rounded-3xl bg-startt-paper p-3">
                <Input placeholder="Seu WhatsApp com DDD" value={phoneLookup} onChange={setPhoneLookup} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button onClick={lookupCustomerPhone} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-startt-green px-4 font-black text-white">Continuar</button>
                  <button onClick={() => setPhoneGateSkipped(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-black/10 bg-white px-4 font-black text-startt-ink">Pular por enquanto</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="sticky top-[68px] z-30 -mx-3 grid gap-4 bg-[#f4f4f3]/95 px-3 py-4 backdrop-blur">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 text-startt-muted shadow-sm">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-startt-ink outline-none" placeholder="Buscar produto..." />
          </label>
          <div className="flex gap-3 overflow-x-auto pb-1">
            <MenuChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>🍽️ Todos</MenuChip>
            {categories.map((category) => <MenuChip key={category.id} active={categoryId === category.id} onClick={() => setCategoryId(category.id)}>{categoryLabel(category)}</MenuChip>)}
          </div>
        </div>
        {!checkoutOnly && (
          <div className="grid gap-3 pb-24 pt-4 md:grid-cols-2">
            {filtered.map((product) => <ProductCard key={product.id} product={product} category={categoryLabel(categories.find((item) => item.id === product.category_id))} onOpen={() => setSelectedProduct(product)} onAdd={() => add(product)} />)}
            {!filtered.length && <div className="rounded-3xl border border-black/10 bg-white p-8 text-center text-startt-muted md:col-span-2">Nenhum produto encontrado neste cardápio.</div>}
          </div>
        )}
      </section>
      <CartDrawer cartOpen={cartOpen} setCartOpen={setCartOpen} cart={cart} setCart={setCart} company={company} zones={activeZones} zoneId={zoneId} setZoneId={setZoneId} checkout={checkout} setCheckout={setCheckout} fulfillment={fulfillment} setFulfillment={setFulfillment} voucherBrands={activeVoucherBrands} subtotal={subtotal} discount={discount} deliveryFee={deliveryFee} total={total} pixEnabled={pixEnabled} pixPayload={pixPayload} pixQrCode={pixQrCode} pixTxid={pixTxid} finishOrder={finishOrder} />
      {itemCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="mobile-safe-bottom fixed inset-x-4 bottom-3 z-40 flex min-h-14 items-center justify-between rounded-2xl bg-startt-green px-4 font-black text-white shadow-2xl md:hidden">
          <span className="inline-flex items-center gap-2"><ShoppingBag size={18} /> Ver pedido</span>
          <span>{itemCount} item(ns) • {money(total)}</span>
        </button>
      )}
      {selectedProduct && <ProductModal product={selectedProduct} category={categoryLabel(categories.find((item) => item.id === selectedProduct.category_id))} onClose={() => setSelectedProduct(null)} onAdd={() => { add(selectedProduct); setSelectedProduct(null); }} />}
      {companyInfoOpen && <CompanyInfoModal company={company} onClose={() => setCompanyInfoOpen(false)} />}
      <Footer />
    </main>
  );
}

function CartDrawer({ cartOpen, setCartOpen, cart, setCart, company, zones, zoneId, setZoneId, checkout, setCheckout, fulfillment, setFulfillment, voucherBrands, subtotal, discount, deliveryFee, total, pixEnabled, pixPayload, pixQrCode, pixTxid, finishOrder }: { cartOpen: boolean; setCartOpen: (value: boolean) => void; cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; company: Company; zones: DeliveryZone[]; zoneId: string; setZoneId: (value: string) => void; checkout: CheckoutState; setCheckout: (value: CheckoutState) => void; fulfillment: Fulfillment; setFulfillment: (value: Fulfillment) => void; voucherBrands: VoucherBrand[]; subtotal: number; discount: number; deliveryFee: number; total: number; pixEnabled: boolean; pixPayload: string; pixQrCode: string; pixTxid: string; finishOrder: () => void | Promise<void> }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const cashChangeFor = parseMoney(checkout.cash_change_for) || 0;
  const calculatedChange = checkout.payment_method === "Dinheiro" && cashChangeFor > 0 ? Math.max(0, cashChangeFor - total) : 0;
  async function copyPixCode() {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 1800);
      notify("success", "Código PIX copiado.");
    } catch {
      notify("error", "Não foi possível copiar automaticamente. Selecione o código PIX manualmente.");
    }
  }
  function qty(productId: string, delta: number) {
    setCart((current) => current.map((item) => item.id === productId ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));
  }
  async function lookupCep(value: string) {
    const cep = value.replace(/\D/g, "");
    setCheckout({ ...checkout, cep: value });
    setCepMessage("");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepMessage("CEP não encontrado. Você pode preencher o endereço manualmente.");
        return;
      }
      const next = { ...checkout, cep: value, address: data.logradouro || checkout.address, neighborhood: data.bairro || checkout.neighborhood, city: data.localidade || checkout.city, state: data.uf || checkout.state };
      setCheckout(next);
      const matchedZone = zones.find((zone) => normalizeText(zone.neighborhood) === normalizeText(String(data.bairro || "")));
      if (matchedZone) {
        setZoneId(matchedZone.id);
        setCepMessage(`Frete para ${matchedZone.neighborhood}: ${money(matchedZone.fee)} • Prazo ${matchedZone.estimated_minutes || "A combinar"}`);
      } else {
        setZoneId("");
        setCepMessage("Seu bairro ainda não possui frete cadastrado. Você pode selecionar manualmente.");
      }
    } catch {
      setCepMessage("Não foi possível buscar o CEP agora. Preencha manualmente.");
    } finally {
      setCepLoading(false);
    }
  }
  return (
    <div className={`fixed inset-0 z-50 ${cartOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button className={`absolute inset-0 border-0 bg-black/45 backdrop-blur-[2px] transition-opacity ${cartOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setCartOpen(false)} aria-label="Fechar carrinho" />
      <aside className={`absolute bottom-0 right-0 grid h-[96dvh] w-full grid-rows-[auto_1fr_auto] rounded-t-3xl bg-white shadow-drawer transition-transform duration-300 ease-spring sm:right-3 sm:top-3 sm:h-[calc(100dvh-24px)] sm:w-[min(560px,calc(100%-24px))] sm:rounded-3xl ${cartOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-[calc(100%+24px)] sm:translate-y-0"}`}>
        <div className="flex items-center justify-between bg-[#121212] px-5 py-5 text-white sm:rounded-t-3xl">
          <div><span className="inline-flex items-center gap-2 text-sm font-black uppercase"><ShoppingBag size={18} /> Seu pedido</span><p className="mt-2 text-sm text-white/62">Confira seu pedido antes de enviar</p></div>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" onClick={() => setCartOpen(false)} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="overflow-auto p-4">
          <div className="grid gap-4">
            <section className="grid gap-2">
              {cart.length === 0 ? <Empty text="Seu pedido ainda está vazio." /> : cart.map((item) => (
                <div key={item.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
                  <img className="h-16 w-16 rounded-xl object-cover" src={item.image} alt="" />
                  <div className="min-w-0"><strong className="block truncate">{item.name}</strong><span className="text-sm text-startt-muted">{money(item.price)}</span></div>
                  <div className="inline-flex items-center gap-2">
                    <button className="grid h-8 w-8 place-items-center rounded-lg bg-startt-soft text-startt-ink" onClick={() => qty(item.id, -1)}>{item.qty === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                    <b className="w-5 text-center">{item.qty}</b>
                    <button className="grid h-8 w-8 place-items-center rounded-lg bg-startt-green text-white" onClick={() => qty(item.id, 1)}><Plus size={15} /></button>
                  </div>
                </div>
              ))}
            </section>
            <section className="grid gap-3 rounded-2xl bg-startt-paper p-3">
              <div className="grid grid-cols-2 gap-2">
                <Toggle active={fulfillment === "delivery"} disabled={!company.delivery_enabled} onClick={() => setFulfillment("delivery")}>Entrega</Toggle>
                <Toggle active={fulfillment === "pickup"} disabled={!company.pickup_enabled} onClick={() => setFulfillment("pickup")}>Retirada</Toggle>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Nome" value={checkout.name} onChange={(value) => setCheckout({ ...checkout, name: value })} />
                <Input placeholder="Telefone" value={checkout.phone} onChange={(value) => setCheckout({ ...checkout, phone: value })} />
              </div>
              {fulfillment === "delivery" && <>
                <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                  <div className="grid gap-2">
                    <Input placeholder="CEP" value={checkout.cep} onChange={lookupCep} />
                    {cepLoading && <span className="text-xs font-bold text-startt-green">Buscando CEP...</span>}
                  </div>
                  <Input placeholder="Rua" value={checkout.address} onChange={(value) => setCheckout({ ...checkout, address: value })} />
                </div>
                {cepMessage && <span className="text-xs font-bold text-startt-muted">{cepMessage}</span>}
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Número" value={checkout.number} onChange={(value) => setCheckout({ ...checkout, number: value })} />
                  <Input placeholder="Complemento" value={checkout.complement} onChange={(value) => setCheckout({ ...checkout, complement: value })} />
                </div>
                <div className="grid grid-cols-[1fr_1fr_70px] gap-2">
                  <Input placeholder="Bairro" value={checkout.neighborhood} onChange={(value) => setCheckout({ ...checkout, neighborhood: value })} />
                  <Input placeholder="Cidade" value={checkout.city} onChange={(value) => setCheckout({ ...checkout, city: value })} />
                  <Input placeholder="UF" value={checkout.state} onChange={(value) => setCheckout({ ...checkout, state: value.toUpperCase() })} />
                </div>
                <Select value={zoneId} onChange={(value) => { setZoneId(value); const manualZone = zones.find((zone) => zone.id === value); if (manualZone) setCheckout({ ...checkout, neighborhood: manualZone.neighborhood }); }}><option value="">Selecione o bairro</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.neighborhood} - {money(zone.fee)} - {zone.estimated_minutes} min</option>)}</Select>
                {selectedZone && <span className="rounded-xl bg-white p-3 text-sm font-black text-startt-green">Frete para {selectedZone.neighborhood}: {money(selectedZone.fee)}</span>}
              </>}
              {fulfillment === "pickup" && <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3"><span className="text-sm font-black text-startt-ink">Endereço do cliente</span><Input placeholder="Endereço para cadastro" value={checkout.address} onChange={(value) => setCheckout({ ...checkout, address: value })} /></div>}
              <div className="grid grid-cols-2 gap-2">
                <Select value={checkout.payment_method} onChange={(value) => setCheckout({ ...checkout, payment_method: value as PaymentMethod })}>{pixEnabled && <option>Pix</option>}<option>Cartão</option><option>Dinheiro</option><option>Vale alimentação/refeição</option></Select>
                <Input placeholder="Cupom" value={checkout.coupon} onChange={(value) => setCheckout({ ...checkout, coupon: value })} />
              </div>
              {checkout.payment_method === "Pix" && pixEnabled && (
                <div className="grid gap-3 rounded-2xl border border-startt-green/20 bg-gradient-to-br from-startt-green/10 to-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-black uppercase tracking-[.16em] text-startt-green">PIX dinâmico</span>
                      <h3 className="mt-1 text-lg font-black text-startt-ink">{money(total)}</h3>
                      <p className="mt-1 text-sm font-semibold text-startt-muted">Após o pagamento, envie o comprovante pelo WhatsApp.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-startt-green shadow-sm">TXID {pixTxid}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div className="grid place-items-center rounded-2xl bg-white p-3 shadow-sm">
                      {pixQrCode ? <img className="h-52 w-52 rounded-xl object-contain" src={pixQrCode} alt="QR Code PIX do pedido" /> : <div className="grid h-52 w-52 place-items-center rounded-xl bg-startt-paper text-center text-xs font-bold text-startt-muted">Gerando QR Code PIX...</div>}
                    </div>
                    <div className="grid gap-2">
                      <textarea readOnly className="min-h-28 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs leading-5 text-startt-ink outline-none" value={pixPayload} />
                      <button type="button" onClick={copyPixCode} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white shadow-lg transition ${pixCopied ? "bg-emerald-600 shadow-emerald-600/20" : "bg-startt-green shadow-startt-green/20"}`}><ClipboardList size={16} /> {pixCopied ? "PIX copiado" : "Copiar PIX"}</button>
                    </div>
                  </div>
                </div>
              )}
              {checkout.payment_method === "Dinheiro" && <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3"><span className="text-sm font-black text-startt-ink">Precisa de troco?</span><Select value={checkout.needs_change} onChange={(value) => setCheckout({ ...checkout, needs_change: value as "Não" | "Sim", cash_change_for: value === "Sim" ? checkout.cash_change_for : "" })}><option>Não</option><option>Sim</option></Select>{checkout.needs_change === "Sim" && <Input placeholder="Troco para quanto?" value={checkout.cash_change_for} onChange={(value) => setCheckout({ ...checkout, cash_change_for: value })} />}{checkout.needs_change === "Sim" && cashChangeFor > 0 && <span className="text-sm font-bold text-startt-muted">Troco para {money(cashChangeFor)} • Troco estimado: {money(calculatedChange)}</span>}</div>}
              {checkout.payment_method === "Cartão" && <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3"><span className="text-sm font-black text-startt-ink">Tipo do cartão</span><Select value={checkout.card_type} onChange={(value) => setCheckout({ ...checkout, card_type: value as "Débito" | "Crédito" })}><option>Débito</option><option>Crédito</option></Select></div>}
              {checkout.payment_method === "Vale alimentação/refeição" && <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3"><span className="text-sm font-black text-startt-ink">Marca do vale</span><Select value={checkout.voucher_brand_id} onChange={(value) => setCheckout({ ...checkout, voucher_brand_id: value })}><option value="">Selecione uma marca</option>{voucherBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.fee_percentage ? ` • ${brand.fee_percentage}%` : ""}</option>)}</Select>{!voucherBrands.length && <span className="text-xs font-bold text-startt-muted">Esta lancheria ainda não configurou marcas de vale ativas.</span>}</div>}
              <textarea className="min-h-24 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-semibold outline-none transition focus:border-startt-green focus:ring-4 focus:ring-startt-green/10" placeholder="Observação do pedido (opcional)" value={checkout.customer_note} onChange={(event) => setCheckout({ ...checkout, customer_note: event.target.value })} />
            </section>
          </div>
        </div>
        <div className="mobile-safe-bottom grid gap-3 border-t border-black/10 bg-white p-4 shadow-[0_-14px_36px_-28px_rgba(20,26,16,.7)]">
          <Totals subtotal={subtotal} discount={discount} deliveryFee={deliveryFee} total={total} />
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20" onClick={finishOrder}><Check size={18} /> Finalizar no WhatsApp</button>
        </div>
      </aside>
    </div>
  );
}

function CompanyAdmin({ db, setDbState, company, screen, login }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; screen: AdminScreen; login: boolean }) {
  const bundle = db.getCompanyBundle(company.id);
  const sessionKey = `${ADMIN_SESSION_PREFIX}${company.id}`;
  const [sessionUserId, setSessionUserId] = useState(() => localStorage.getItem(sessionKey));
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newOrderBadge, setNewOrderBadge] = useState(0);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastOrderCount = useRef(bundle.orders.length);
  const printedOrderIds = useRef<Set<string>>(new Set());
  const user = bundle.users.find((item) => item.id === sessionUserId);
  const allowed = user ? roleAccess[user.role] : [];
  const activeScreen = allowed.includes(screen) ? screen : allowed[0] || "dashboard";

  function markQzPrinted(orderId: string, error = "") {
    setDbState((current) => ({
      ...current,
      orders: current.orders.map((item) => {
        if (item.id !== orderId || item.company_id !== company.id) return item;
        return {
          ...item,
          qz_printed_at: error ? item.qz_printed_at || "" : new Date().toISOString(),
          qz_print_attempts: (item.qz_print_attempts || 0) + 1,
          qz_print_error: error,
        };
      }),
    }));
  }

  async function printThermalOrder(order: Order, auto = false) {
    try {
      const resolved = resolveOrderForPrint(order, bundle);
      const printSettings = bundle.print_settings;
      const qzPrinter = printSettings?.qz_printer_name || printSettings?.printer_name || "";
      if (printSettings?.qz_tray_enabled && qzPrinter) {
        await printQzOrder(qzPrinter, { company, order: resolved.order, items: resolved.items, settings: printSettings });
        markQzPrinted(order.id);
        notify("success", auto ? "Pedido impresso automaticamente pelo QZ Tray." : "Pedido enviado ao QZ Tray.");
        return;
      }
      const opened = openThermalPrintable(`Pedido #${displayOrderNumber(order)}`, buildThermalOrderHtml(company, resolved.order, resolved.items));
      if (!opened && auto) notify("info", "Impressão automática bloqueada. Use o botão Reimprimir.");
    } catch (error) {
      const message = readableError(error);
      if (auto) markQzPrinted(order.id, message);
      notify("error", `${message} O pedido continua salvo.`);
    }
  }

  function announceNewOrder(order?: Order) {
    setNewOrderBadge((count) => count + 1);
    setNewOrderFlash(true);
    notify("info", "Novo pedido recebido.");
    if (order && bundle.print_settings?.auto_print_orders && !order.qz_printed_at && !(order.qz_print_attempts || 0) && !printedOrderIds.current.has(order.id)) {
      printedOrderIds.current.add(order.id);
      printThermalOrder(order, true);
    }
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const audio = new AudioContextClass();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.18);
      }
    } catch {
      // Navegadores podem bloquear áudio sem interação prévia.
    }
    window.setTimeout(() => setNewOrderFlash(false), 4500);
  }

  useEffect(() => {
    if (bundle.orders.length > lastOrderCount.current) {
      const latest = [...bundle.orders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      announceNewOrder(latest);
    }
    lastOrderCount.current = bundle.orders.length;
  }, [bundle.orders.length]);

  useEffect(() => {
    function onNewOrder(event: Event) {
      const detail = (event as CustomEvent<{ company_id: string; order_id?: string }>).detail;
      if (detail?.company_id === company.id) {
        const order = detail.order_id ? bundle.orders.find((item) => item.id === detail.order_id) : undefined;
        announceNewOrder(order);
      }
    }
    window.addEventListener(NEW_ORDER_EVENT, onNewOrder);
    return () => window.removeEventListener(NEW_ORDER_EVENT, onNewOrder);
  }, [company.id]);

  if (["blocked", "canceled", "disabled"].includes(company.status) || company.subscription_status === "overdue" || company.subscription_status === "canceled") return <Suspended company={company} />;
  if (!company.is_registration_enabled && !user) return <Suspended company={company} message="Cadastro/acesso temporariamente desativado" />;

  function doLogin(event: React.FormEvent) {
    event.preventDefault();
    const found = bundle.users.find((item) => item.email.toLowerCase() === credentials.email.toLowerCase() && item.password === credentials.password && item.is_active);
    if (!found) {
      setLoginError("Login inválido para esta empresa.");
      notify("error", "E-mail ou senha inválidos para esta empresa.");
      return;
    }
    setLoginError("");
    localStorage.setItem(sessionKey, found.id);
    setSessionUserId(found.id);
    notify("success", `Bem-vindo, ${found.name}.`);
    window.history.pushState({}, "", `/${company.slug}/admin/dashboard`);
  }

  function logout() {
    localStorage.removeItem(sessionKey);
    setSessionUserId(null);
    notify("info", "Você saiu do painel.");
    window.history.pushState({}, "", `/${company.slug}/admin/login`);
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(242,106,27,.16),transparent_34rem),#f7f4ef] p-4">
        <form onSubmit={doLogin} className="grid w-[min(460px,100%)] gap-4 rounded-3xl border border-black/10 bg-white p-6 shadow-2xl">
          <LogoTitle title="Acesse seu painel" subtitle={`Produto Startt Delivery para ${company.name}`} />
          <p className="text-sm leading-6 text-startt-muted">Gerencie seu cardápio, pedidos e clientes em um ambiente seguro.</p>
          <Input placeholder="E-mail" value={credentials.email} onChange={(email) => setCredentials({ ...credentials, email })} />
          <PasswordField placeholder="Senha" value={credentials.password} onChange={(password) => setCredentials({ ...credentials, password })} visible={showAdminPassword} onToggle={() => setShowAdminPassword((value) => !value)} />
          {loginError && <p className="rounded-lg bg-startt-red/10 p-3 text-sm font-bold text-startt-red">{loginError}</p>}
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-startt-green px-4 font-black text-white"><LogIn size={18} /> Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1efec] lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 bg-[#121212] p-5 text-white lg:grid lg:grid-rows-[auto_1fr_auto]">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          {company.logo_url ? <img className="h-12 w-12 rounded-2xl object-cover shadow-card" src={companyLogoUrl(company)} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-startt-green text-xl font-black">S</span>}
          <div><p className="font-black uppercase tracking-[0.18em]">{company.name}</p><p className="text-xs text-white/55">Administrador • {user.name}</p></div>
        </div>
        <nav className="mt-5 grid content-start gap-1 overflow-auto pr-1">
          {adminNav.filter((item) => allowed.includes(item.id)).map((item) => <a key={item.id} href={`/${company.slug}/admin/${item.id}`} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${activeScreen === item.id ? "bg-startt-green text-white shadow-lg shadow-startt-green/25" : "text-white/72 hover:bg-white/10 hover:text-white"}`}>{item.icon}{item.label}</a>)}
        </nav>
        <div className="grid gap-2 border-t border-white/10 pt-4">
          <a className="rounded-xl border border-white/10 px-3 py-3 text-sm font-bold text-white/80 hover:bg-white/10" href={`/${company.slug}`}>Ver site público ↗</a>
          <button onClick={logout} className="flex min-h-11 items-center gap-3 rounded-xl bg-white/10 px-3 text-sm font-bold text-white"><LogOut size={18} /> Sair</button>
          <p className="pt-2 text-xs font-bold text-white/36">Startt Facilities</p>
        </div>
      </aside>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><button onClick={() => setMobileNavOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-startt-soft lg:hidden" aria-label="Menu"><Menu size={22} /></button><strong>{adminNav.find((item) => item.id === activeScreen)?.label || "Dashboard"}</strong></div>
          <div className="flex items-center gap-2">
            {newOrderBadge > 0 && <a href={`/${company.slug}/admin/pedidos`} onClick={() => setNewOrderBadge(0)} className={`rounded-xl px-3 py-2 text-sm font-black text-white ${newOrderFlash ? "bg-startt-red shadow-xl" : "bg-startt-green"}`}>{newOrderBadge} novo(s)</a>}
            <a className="hidden rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold md:inline-flex" href={`/${company.slug}/admin/conta`}>Minha conta</a>
            <a className="hidden rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold md:inline-flex" href={`/${company.slug}`}>Ver site</a>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-startt-ink text-xs font-black text-white">{user.name.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
      </header>
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button className={`absolute inset-0 bg-black/45 backdrop-blur-sm transition ${mobileNavOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu" />
        <aside className={`absolute inset-y-0 left-0 grid w-[min(330px,88vw)] grid-rows-[auto_1fr_auto] bg-[#121212] p-5 text-white shadow-drawer transition-transform duration-300 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">{company.logo_url ? <img className="h-11 w-11 rounded-2xl object-cover" src={companyLogoUrl(company)} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-11 w-11 place-items-center rounded-2xl bg-startt-green font-black">S</span>}<div><p className="font-black uppercase tracking-[0.16em]">{company.name}</p><p className="text-xs text-white/55">{user.name}</p></div></div>
            <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" onClick={() => setMobileNavOpen(false)} aria-label="Fechar"><X size={20} /></button>
          </div>
          <nav className="mt-5 grid content-start gap-2 overflow-auto">
            {adminNav.filter((item) => allowed.includes(item.id)).map((item) => <a key={item.id} href={`/${company.slug}/admin/${item.id}`} onClick={() => setMobileNavOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold ${activeScreen === item.id ? "bg-startt-green text-white" : "text-white/72 hover:bg-white/10"}`}>{item.icon}{item.label}</a>)}
          </nav>
          <div className="grid gap-2 border-t border-white/10 pt-4"><a className="rounded-xl border border-white/10 px-3 py-3 text-sm font-bold text-white/80" href={`/${company.slug}`}>Ver site público</a><button onClick={logout} className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-3 text-sm font-bold text-white"><LogOut size={18} /> Sair</button></div>
        </aside>
      </div>
      <section className="p-4 md:p-6">
        <AdminContent screen={activeScreen} db={db} setDbState={setDbState} company={company} user={user} printThermalOrder={printThermalOrder} />
      </section>
    </main>
  );
}

function AdminContent({ screen, db, setDbState, company, user, printThermalOrder }: { screen: AdminScreen; db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; user: User; printThermalOrder: (order: Order, auto?: boolean) => Promise<void> }) {
  const bundle = db.getCompanyBundle(company.id);
  const plan = bundle.plan;
  if (screen === "relatorios" && plan && !plan.allow_reports) return <PlanBlocked />;
  if (screen === "impressao" && plan && !plan.allow_printing) return <PlanBlocked />;
  if (screen === "cupons" && plan && !plan.allow_coupons) return <PlanBlocked />;
  if (screen === "conta") return <AccountSettings company={company} user={user} setDbState={setDbState} />;
  if (screen === "dashboard") return <Dashboard company={company} bundle={bundle} />;
  if (screen === "caixa") return <Cashier company={company} user={user} products={bundle.products.filter((item) => item.active)} setDbState={setDbState} />;
  if (screen === "estoque") return <InventoryManager company={company} items={bundle.inventory_items} setDbState={setDbState} />;
  if (screen === "pedidos") return <OrdersManager bundle={bundle} setDbState={setDbState} company={company} user={user} printThermalOrder={printThermalOrder} />;
  if (screen === "clientes") return <CustomersManager company={company} customers={bundle.customers} orders={bundle.orders} orderItems={bundle.order_items} setDbState={setDbState} />;
  if (screen === "produtos") return <ProductsManager company={company} products={bundle.products} categories={bundle.categories} plan={plan} setDbState={setDbState} />;
  if (screen === "categorias") return <CategoriesManager company={company} categories={bundle.categories} setDbState={setDbState} />;
  if (screen === "cupons") return <CouponsManager company={company} coupons={bundle.coupons} plan={plan} setDbState={setDbState} />;
  if (screen === "relatorios") return <Reports company={company} bundle={bundle} />;
  if (screen === "fretes") return <ZonesManager company={company} zones={bundle.delivery_zones} setDbState={setDbState} />;
  if (screen === "impressao") return <PrintManager company={company} user={user} settings={bundle.print_settings} setDbState={setDbState} />;
  if (screen === "configuracoes") return <CompanySettings company={company} voucherBrands={bundle.voucher_brands} settings={bundle.settings} printSettings={bundle.print_settings} setDbState={setDbState} />;
  return <UsersManager company={company} users={bundle.users} plan={plan} setDbState={setDbState} />;
}

function PlanBlocked() {
  return <section className="rounded-lg border border-black/10 bg-white p-6"><h1 className="text-3xl font-black">Recurso indisponível</h1><p className="mt-2 text-startt-muted">Seu plano atual não inclui este recurso. Entre em contato com a Startt Facilities.</p></section>;
}

function AccountSettings({ company, user, setDbState }: { company: Company; user: User; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.current || !form.next || !form.confirm) {
      notify("error", "Preencha senha atual, nova senha e confirmação.");
      return;
    }
    if (form.current !== user.password) {
      notify("error", "A senha atual não confere.");
      return;
    }
    if (form.next.length < 6) {
      notify("error", "A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (form.next !== form.confirm) {
      notify("error", "A confirmação da nova senha não confere.");
      return;
    }
    runSave(setSaving, () => {
      setDbState((current) => ({
        ...current,
        users: current.users.map((item) => item.id === user.id && item.company_id === company.id ? { ...item, password: form.next } : item),
      }));
      setForm({ current: "", next: "", confirm: "" });
    }, "Senha alterada com sucesso.");
  }
  return (
    <CrudShell title="Minha conta" description="Atualize o acesso do seu usuário com segurança.">
      <section className="grid gap-5 rounded-3xl border border-black/10 bg-white p-5 shadow-card lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-3xl bg-startt-ink p-6 text-white">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-startt-green text-lg font-black">{user.name.slice(0, 2).toUpperCase()}</span>
          <h2 className="mt-5 text-2xl font-semibold">{user.name}</h2>
          <p className="mt-2 text-sm text-white/58">{company.name} • {user.role}</p>
          <p className="mt-6 text-sm leading-6 text-white/62">Seu usuário permanece vinculado somente a esta lancheria, mantendo o painel isolado por empresa.</p>
        </div>
        <form onSubmit={submit} className="grid content-start gap-4">
          <PasswordField placeholder="Senha atual" value={form.current} onChange={(current) => setForm({ ...form, current })} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <PasswordField placeholder="Nova senha" value={form.next} onChange={(next) => setForm({ ...form, next })} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <PasswordField placeholder="Confirmar nova senha" value={form.confirm} onChange={(confirm) => setForm({ ...form, confirm })} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <button disabled={saving} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20 disabled:opacity-60">{saving ? "Salvando..." : "Alterar senha"}</button>
        </form>
      </section>
    </CrudShell>
  );
}

function Dashboard({ company, bundle }: { company: Company; bundle: ReturnType<DatabaseApi["getCompanyBundle"]> }) {
  const [start, setStart] = useState(todayInput());
  const [end, setEnd] = useState(todayInput());
  const visibleOrders = activeOrders(bundle.orders);
  const activeInventory = bundle.inventory_items.filter((item) => item.active);
  const inventoryZero = activeInventory.filter((item) => item.current_quantity <= 0).length;
  const inventoryLow = activeInventory.filter((item) => item.current_quantity > 0 && item.current_quantity <= item.minimum_quantity).length;
  const inventoryShopping = activeInventory.filter((item) => !item.purchase_resolved && (item.purchase_flag || item.current_quantity <= item.minimum_quantity)).length;
  const inventoryOk = activeInventory.filter((item) => item.current_quantity > item.minimum_quantity && !item.purchase_flag).length;
  const online = visibleOrders.filter((item) => isInPeriod(item.created_at, start, end));
  const cash = bundle.cash_sales.filter((item) => isInPeriod(item.created_at, start, end));
  const all = [...online.map((item) => ({ date: item.created_at, total: item.total })), ...cash.map((item) => ({ date: item.created_at, total: item.total }))];
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const salesToday = [...visibleOrders, ...bundle.cash_sales].filter((item) => item.created_at.slice(0, 10) === today).reduce((sum, item) => sum + item.total, 0);
  const salesMonth = [...visibleOrders, ...bundle.cash_sales].filter((item) => item.created_at.slice(0, 7) === month).reduce((sum, item) => sum + item.total, 0);
  const total = all.reduce((sum, item) => sum + item.total, 0);
  const pending = visibleOrders.filter((item) => !["concluido", "cancelado"].includes(item.status)).length;
  const dayValues = Object.entries(sumByDay(all));
  const maxDay = Math.max(1, ...dayValues.map(([, value]) => value));
  const recentOrders = [...visibleOrders].slice(0, 5);

  function pdf() {
    const byStatus = Object.entries(groupSum(visibleOrders.filter((item) => isInPeriod(item.created_at, start, end)), "status")).map(([status, count]) => `<li>${status}: ${count}</li>`).join("");
    openPrintable("Relatório Dashboard", `<h1>${company.name}</h1><p>Período: ${start} até ${end}</p><p>Total de vendas: ${money(total)}</p><p>Quantidade de pedidos: ${online.length}</p><p>Ticket médio: ${money(total / Math.max(1, all.length))}</p><h2>Pedidos por status</h2><ul>${byStatus}</ul><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`);
  }

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight">Boa tarde! 👋</h2>
        <p className="mt-1 text-startt-muted">Aqui está o resumo do seu negócio</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vendas do dia" value={money(salesToday)} icon={<CreditCard />} />
        <Metric label="Vendas da semana" value={money(total)} icon={<BarChart3 />} />
        <Metric label="Vendas do mês" value={money(salesMonth)} icon={<Package />} />
        <Metric label="Ticket médio" value={money(total / Math.max(1, all.length))} icon={<FileText />} />
        <Metric label="Online (mês)" value={String(online.length)} icon={<ShoppingBag />} />
        <Metric label="Presenciais (mês)" value={String(cash.length)} icon={<CreditCard />} />
        <Metric label="Clientes" value={String(bundle.customers.length)} icon={<UsersRound />} />
        <Metric label="Pendentes" value={String(pending)} icon={<Bike />} />
        <Metric label="Estoque OK" value={String(inventoryOk)} icon={<Check />} />
        <Metric label="Estoque baixo" value={String(inventoryLow)} icon={<Bell />} />
        <Metric label="Zerados" value={String(inventoryZero)} icon={<Trash2 />} />
        <Metric label="Comprar" value={String(inventoryShopping)} icon={<ShoppingBag />} />
      </div>
      {inventoryShopping > 0 && <div className="rounded-2xl border border-startt-green/20 bg-startt-green/10 p-4 text-sm font-bold text-startt-ink">{inventoryShopping} {inventoryShopping === 1 ? "item precisa" : "itens precisam"} de atenção na cozinha.</div>}
      <Panel title="Atalhos rápidos">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <QuickLink href={`/${company.slug}/admin/caixa`} title="Caixa presencial" text="Registrar pedido balcão" icon={<CreditCard size={20} />} />
          <QuickLink href={`/${company.slug}/admin/estoque`} title="Estoque" text="Controle leve da cozinha" icon={<Utensils size={20} />} />
          <QuickLink href={`/${company.slug}/admin/pedidos`} title="Ver pedidos" text="Acompanhe os pedidos" icon={<ClipboardList size={20} />} />
          <QuickLink href={`/${company.slug}/admin/clientes`} title="Clientes" text="Cadastro e fidelidade" icon={<UsersRound size={20} />} />
          <QuickLink href={`/${company.slug}/admin/produtos`} title="Novo produto" text="Adicionar ao cardápio" icon={<Package size={20} />} />
          <QuickLink href={`/${company.slug}/admin/relatorios`} title="Relatórios PDF" text="Exportar por período" icon={<FileText size={20} />} />
          <QuickLink href={`/${company.slug}/admin/configuracoes`} title="Configurações" text="Dados do negócio" icon={<Settings size={20} />} />
        </div>
      </Panel>
      <DateFilters start={start} end={end} setStart={setStart} setEnd={setEnd} onPdf={pdf} />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Panel title="Performance por dia">
          <div className="grid min-h-64 content-end gap-3">
            {dayValues.length ? dayValues.map(([day, value]) => <div key={day} className="grid gap-2"><div className="flex justify-between text-sm"><span className="font-bold text-startt-muted">{day}</span><b>{money(value)}</b></div><div className="h-3 overflow-hidden rounded-full bg-startt-soft"><div className="h-full rounded-full bg-startt-green transition-all" style={{ width: `${Math.max(8, (value / maxDay) * 100)}%` }} /></div></div>) : <Empty text="Sem vendas no período selecionado." />}
          </div>
        </Panel>
        <Panel title="Pedidos recentes">
          <div className="grid gap-3">
            {recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-3"><div><strong>#{displayOrderNumber(order)}</strong><p className="text-sm text-startt-muted">{customerName(order.customer_id, bundle.customers)} • {order.status}</p></div><b>{money(order.total)}</b></div>)}
            {!recentOrders.length && <Empty text="Nenhum pedido recente." />}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Cashier({ company, user, products, setDbState }: { company: Company; user: User; products: Product[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [cart, setCart] = useState<Array<{ product: Product; qty: number }>>([]);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("Pix");
  const activeProducts = products.filter((product) => product.active);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  function add(product: Product) {
    setCart((current) => current.find((item) => item.product.id === product.id) ? current.map((item) => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { product, qty: 1 }]);
  }
  function decrease(productId: string) {
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item];
      return item.qty > 1 ? [{ ...item, qty: item.qty - 1 }] : [];
    }));
  }
  function remove(productId: string) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }
  function finish() {
    if (!cart.length) {
      notify("error", "Adicione pelo menos um produto ao caixa.");
      return;
    }
    const sale: CashSale = { id: id("cash"), company_id: company.id, items: cart.map((item) => ({ product_id: item.product.id, name: item.product.name, quantity: item.qty, unit_price: item.product.price, total: item.qty * item.product.price })), subtotal, discount, total, payment_method: payment, created_by: user.id, created_at: new Date().toISOString() };
    setDbState((current) => ({ ...current, cash_sales: [sale, ...current.cash_sales] }));
    setCart([]);
    setDiscount(0);
    openPrintable("Comprovante", `<h1>${company.name}</h1><p>Venda presencial ${sale.id}</p><p>Total: ${money(total)}</p><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`);
    notify("success", "Venda presencial registrada com sucesso.");
  }
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="grid gap-4 rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Caixa presencial</h2>
            <p className="text-sm text-startt-muted">Toque nos produtos para montar uma venda rápida no balcão.</p>
          </div>
          <span className="rounded-full bg-startt-green/10 px-3 py-1 text-sm font-black text-startt-green">{activeProducts.length} produtos ativos</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {activeProducts.map((product) => (
            <button key={product.id} onClick={() => add(product)} className="group grid min-h-[132px] grid-cols-[74px_1fr] items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-startt-green/40 hover:shadow-card">
              <img src={product.image} alt="" className="h-[74px] w-[74px] rounded-2xl object-cover" />
              <span className="grid gap-2">
                <b className="line-clamp-2 text-sm leading-tight text-startt-ink">{product.name}</b>
                <span className="text-xs font-bold text-startt-muted">{product.preparation_time || 10} min</span>
                <strong className="text-lg text-startt-green">{money(product.price)}</strong>
              </span>
            </button>
          ))}
          {!activeProducts.length && <Empty text="Nenhum produto ativo para venda no caixa." />}
        </div>
      </section>

      <aside className="grid gap-4 rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-24 xl:self-start">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div>
            <h2 className="text-xl font-black">Carrinho</h2>
            <p className="text-sm text-startt-muted">{itemCount ? `${itemCount} item(ns) na venda` : "Nenhum item adicionado"}</p>
          </div>
          {cart.length > 0 && <button type="button" onClick={() => setCart([])} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-startt-muted">Limpar</button>}
        </div>

        <div className="grid max-h-[42vh] gap-3 overflow-auto pr-1">
          {cart.map((item) => (
            <div key={item.product.id} className="grid gap-3 rounded-2xl border border-black/10 bg-startt-paper/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate font-black">{item.product.name}</span>
                  <span className="text-sm text-startt-muted">{money(item.product.price)} cada</span>
                </div>
                <b className="shrink-0">{money(item.qty * item.product.price)}</b>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => decrease(item.product.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white font-black" aria-label={`Diminuir ${item.product.name}`}><Minus size={16} /></button>
                <span className="grid h-10 min-w-12 place-items-center rounded-xl bg-white px-3 font-black">{item.qty}</span>
                <button type="button" onClick={() => add(item.product)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white font-black" aria-label={`Adicionar ${item.product.name}`}><Plus size={16} /></button>
                <button type="button" onClick={() => remove(item.product.id)} className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-startt-red" aria-label={`Remover ${item.product.name}`}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {!cart.length && <p className="rounded-xl bg-startt-paper p-4 text-sm font-bold text-startt-muted">Nenhum item no carrinho.</p>}
        </div>

        <div className="grid gap-3 border-t border-black/10 pt-3">
          <label className="grid gap-2 text-sm font-bold">Desconto manual<Input placeholder="0,00" value={String(discount).replace(".", ",")} onChange={(value) => setDiscount(Math.max(0, parseMoney(value) || 0))} /></label>
          <label className="grid gap-2 text-sm font-bold">Pagamento<Select value={payment} onChange={(value) => setPayment(value as PaymentMethod)}><option>Pix</option><option>Cartão</option><option>Dinheiro</option></Select></label>
          <div className="rounded-2xl bg-startt-ink p-4 text-white">
            <Totals subtotal={subtotal} discount={discount} deliveryFee={0} total={total} />
          </div>
          <button onClick={finish} disabled={!cart.length} className="w-full rounded-xl bg-startt-green px-4 py-4 font-black text-white shadow-lg shadow-startt-green/20 disabled:cursor-not-allowed disabled:opacity-50">Finalizar venda</button>
        </div>
      </aside>
    </section>
  );
}

const inventoryUnits: InventoryUnit[] = ["un", "kg", "g", "litro", "ml", "pacote", "caixa"];

function inventoryStatus(item: InventoryItem) {
  if (!item.active) return { label: "Inativo", tone: "bg-black/5 text-startt-muted", dot: "⚪" };
  if (item.current_quantity <= 0 || (item.purchase_flag && !item.purchase_resolved)) return { label: "Comprar urgente", tone: "bg-red-50 text-red-700", dot: "🔴" };
  if (item.current_quantity <= item.minimum_quantity) return { label: "Baixo", tone: "bg-amber-50 text-amber-700", dot: "🟡" };
  return { label: "OK", tone: "bg-emerald-50 text-emerald-700", dot: "🟢" };
}

function InventoryManager({ company, items, setDbState }: { company: Company; items: InventoryItem[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const emptyForm = { id: "", name: "", category: "", current_quantity: "0", minimum_quantity: "0", unit: "un" as InventoryUnit, notes: "", active: true };
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const activeItems = items.filter((item) => item.active);
  const shoppingItems = activeItems.filter((item) => !item.purchase_resolved && (item.purchase_flag || item.current_quantity <= item.minimum_quantity));
  const okCount = activeItems.filter((item) => item.current_quantity > item.minimum_quantity && !item.purchase_flag).length;
  const lowCount = activeItems.filter((item) => item.current_quantity > 0 && item.current_quantity <= item.minimum_quantity).length;
  const zeroCount = activeItems.filter((item) => item.current_quantity <= 0).length;

  function openCreate() {
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setForm({ id: item.id, name: item.name, category: item.category, current_quantity: String(item.current_quantity), minimum_quantity: String(item.minimum_quantity), unit: item.unit, notes: item.notes, active: item.active });
    setFormOpen(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      notify("error", "Informe o nome do item.");
      return;
    }
    const now = new Date().toISOString();
    const currentQuantity = Number(form.current_quantity.replace(",", ".")) || 0;
    const minimumQuantity = Number(form.minimum_quantity.replace(",", ".")) || 0;
    runSave(setSaving, () => {
      setDbState((current) => {
        const previous = form.id ? current.inventory_items.find((item) => item.id === form.id) : undefined;
        const nextItem: InventoryItem = {
          id: form.id || id("inv"),
          company_id: company.id,
          name: form.name.trim(),
          category: form.category.trim(),
          current_quantity: currentQuantity,
          minimum_quantity: minimumQuantity,
          unit: form.unit,
          notes: form.notes.trim(),
          active: form.active,
          purchase_flag: previous?.purchase_flag || currentQuantity <= minimumQuantity,
          purchase_resolved: false,
          created_at: previous?.created_at || now,
          updated_at: now,
        };
        return { ...current, inventory_items: form.id ? current.inventory_items.map((item) => item.id === form.id ? nextItem : item) : [nextItem, ...current.inventory_items] };
      });
      setFormOpen(false);
    }, form.id ? "Item de estoque atualizado." : "Item de estoque cadastrado.");
  }

  function updateItem(itemId: string, updater: (item: InventoryItem) => InventoryItem) {
    setDbState((current) => ({ ...current, inventory_items: current.inventory_items.map((item) => item.id === itemId && item.company_id === company.id ? { ...updater(item), updated_at: new Date().toISOString() } : item) }));
  }

  function adjust(item: InventoryItem, delta: number) {
    updateItem(item.id, (current) => ({ ...current, current_quantity: Math.max(0, Number((current.current_quantity + delta).toFixed(3))), purchase_resolved: false }));
  }

  function markToBuy(item: InventoryItem) {
    updateItem(item.id, (current) => ({ ...current, purchase_flag: true, purchase_resolved: false }));
  }

  function markResolved(item: InventoryItem) {
    updateItem(item.id, (current) => ({ ...current, purchase_flag: false, purchase_resolved: true }));
  }

  function clearResolved() {
    setDbState((current) => ({ ...current, inventory_items: current.inventory_items.map((item) => item.company_id === company.id && item.purchase_resolved ? { ...item, purchase_resolved: false, updated_at: new Date().toISOString() } : item) }));
    notify("success", "Resolvidos limpos da lista.");
  }

  async function copyShoppingList() {
    if (!shoppingItems.length) {
      notify("info", "Nenhum item precisa entrar na lista de compras.");
      return;
    }
    const text = [`Lista de compras - ${company.name}`, ...shoppingItems.map((item) => `- ${item.name}: atual ${item.current_quantity} ${item.unit} / minimo ${item.minimum_quantity} ${item.unit}${item.notes ? ` (${item.notes})` : ""}`)].join("\n");
    await navigator.clipboard.writeText(text);
    notify("success", "Lista copiada. Cole no WhatsApp da equipe.");
    const phone = company.whatsapp.replace(/\D/g, "");
    if (phone) window.open(`https://wa.me/55${phone.replace(/^55/, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <CrudShell title="Estoque" description="Controle leve da cozinha para saber o que tem, o que está baixo e o que precisa comprar.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Itens OK" value={String(okCount)} icon={<Check />} />
        <Metric label="Baixos" value={String(lowCount)} icon={<Bell />} />
        <Metric label="Zerados" value={String(zeroCount)} icon={<Trash2 />} />
        <Metric label="Lista de compras" value={String(shoppingItems.length)} icon={<ShoppingBag />} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Itens da cozinha">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <HelpText>Use +1 e -1 para ajustes rápidos durante a operação. Para kg, litro ou ml, edite a quantidade manualmente.</HelpText>
            <button onClick={openCreate} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo item</button>
          </div>
          <div className="grid gap-3">
            {items.map((item) => {
              const status = inventoryStatus(item);
              return (
                <article key={item.id} className="grid gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black">{item.name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${status.tone}`}>{status.dot} {status.label}</span>
                      {!item.active && <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-startt-muted">oculto</span>}
                    </div>
                    <p className="mt-1 text-sm text-startt-muted">{item.category || "Sem categoria"} • minimo {item.minimum_quantity} {item.unit}</p>
                    {item.notes && <p className="mt-2 text-sm leading-5 text-startt-muted">{item.notes}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button onClick={() => adjust(item, -1)} className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-startt-paper font-black"><Minus size={18} /></button>
                      <strong className="min-w-28 rounded-xl bg-startt-ink px-4 py-3 text-center text-white">{item.current_quantity} {item.unit}</strong>
                      <button onClick={() => adjust(item, 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-startt-paper font-black"><Plus size={18} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button onClick={() => openEdit(item)} className="min-h-11 rounded-xl border border-black/10 px-3 font-bold">Editar</button>
                    <button onClick={() => markToBuy(item)} className="min-h-11 rounded-xl bg-amber-500 px-3 font-black text-white">Marcar comprar</button>
                    <button onClick={() => markResolved(item)} className="min-h-11 rounded-xl bg-startt-green px-3 font-black text-white">Resolvido</button>
                  </div>
                </article>
              );
            })}
            {!items.length && <Empty text="Cadastre os primeiros itens críticos da cozinha." />}
          </div>
        </Panel>
        <Panel title="Lista de compras">
          <div className="grid gap-3">
            {shoppingItems.map((item) => <div key={item.id} className="rounded-2xl border border-black/10 bg-startt-paper p-4"><div className="flex items-start justify-between gap-3"><div><strong>{item.name}</strong><p className="text-sm text-startt-muted">Atual: {item.current_quantity} {item.unit} • minimo: {item.minimum_quantity} {item.unit}</p></div><button onClick={() => markResolved(item)} className="rounded-xl bg-white px-3 py-2 text-xs font-black">Resolvido</button></div></div>)}
            {!shoppingItems.length && <Empty text="Nada urgente para comprar agora." />}
            <button onClick={copyShoppingList} className="min-h-12 rounded-xl bg-startt-ink px-4 font-black text-white">Copiar lista para WhatsApp</button>
            <button onClick={clearResolved} className="min-h-12 rounded-xl border border-black/10 px-4 font-black">Limpar resolvidos</button>
          </div>
        </Panel>
      </div>
      <FormDrawer open={formOpen} title={form.id ? "Editar item" : "Novo item"} description="Cadastre só o essencial para a equipe agir rápido no celular." onClose={() => setFormOpen(false)}>
        <form onSubmit={save} className="grid gap-3">
          <Input placeholder="Nome do item" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Input placeholder="Categoria opcional" value={form.category} onChange={(category) => setForm({ ...form, category })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="number" placeholder="Quantidade atual" value={form.current_quantity} onChange={(current_quantity) => setForm({ ...form, current_quantity })} />
            <Input type="number" placeholder="Quantidade mínima" value={form.minimum_quantity} onChange={(minimum_quantity) => setForm({ ...form, minimum_quantity })} />
            <Select value={form.unit} onChange={(unit) => setForm({ ...form, unit: unit as InventoryUnit })}>{inventoryUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Select>
          </div>
          <Input placeholder="Observação opcional" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <label className="flex items-center gap-2 rounded-xl bg-startt-paper p-3 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Item ativo no controle da cozinha</label>
          <button disabled={saving} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar item"}</button>
        </form>
      </FormDrawer>
    </CrudShell>
  );
}

const orderStatuses: OrderStatus[] = ["novo", "aceito", "preparando", "saiu_para_entrega", "pronto_para_retirada", "concluido", "cancelado"];

function OrdersManager({ bundle, setDbState, company, user, printThermalOrder }: { bundle: ReturnType<DatabaseApi["getCompanyBundle"]>; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; user: User; printThermalOrder: (order: Order) => Promise<void> }) {
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const rows = activeOrders(bundle.orders).filter((order) => (status === "todos" || order.status === status) && (!date || order.created_at.slice(0, 10) === date) && (order.customer_name || customerName(order.customer_id, bundle.customers)).toLowerCase().includes(search.toLowerCase()));
  function update(order: Order, next: OrderStatus) {
    setDbState((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id && item.company_id === company.id ? { ...item, status: next } : item) }));
    notify("success", "Status do pedido atualizado.");
  }
  function archive(order: Order) {
    if (!["dono", "gerente"].includes(user.role)) {
      notify("error", "Seu usuário não tem permissão para arquivar pedidos.");
      return;
    }
    if (!confirm(`Arquivar pedido #${displayOrderNumber(order)} e remover do dashboard? O pedido continuará salvo no histórico interno.`)) return;
    setDbState((current) => ({
      ...current,
      orders: current.orders.map((item) => item.id === order.id && item.company_id === company.id ? { ...item, archived: true, archived_at: new Date().toISOString(), removed_from_dashboard: true } : item),
    }));
    notify("success", "Pedido arquivado e removido do dashboard.");
  }
  return (
    <CrudShell title="Pedidos" description="Pedidos recebidos do cardápio online.">
      <div className="grid gap-3 md:grid-cols-3"><Input placeholder="Buscar cliente" value={search} onChange={setSearch} /><Input placeholder="" type="date" value={date} onChange={setDate} /><Select value={status} onChange={setStatus}><option value="todos">Todos</option>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select></div>
      <Table headers={["Pedido", "Cliente", "Pagamento", "Status", "Impressão", "Total", "Ações"]} rows={rows.map((order) => [`#${displayOrderNumber(order)}`, order.customer_name || customerName(order.customer_id, bundle.customers), order.payment_details || order.payment_method, order.status, order.qz_printed_at ? "Impresso" : order.qz_print_error ? "Falhou" : "Pendente", money(order.total), <div className="flex flex-wrap gap-2" key={order.id}><Select value={order.status} onChange={(value) => update(order, value as OrderStatus)}>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => printOrder(company, order, bundle)}>Ver pedido</button><button className="rounded-lg bg-startt-green px-3 py-2 font-bold text-white shadow-lg shadow-startt-green/20" onClick={() => printThermalOrder(order)}>Reimprimir</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => sendOrderUpdate(order, company, bundle)}>Enviar WhatsApp</button>{["dono", "gerente"].includes(user.role) && <button className="rounded-lg bg-startt-ink px-3 py-2 font-bold text-white" onClick={() => archive(order)}>Arquivar pedido</button>}</div>])} />
    </CrudShell>
  );
}

function printOrder(company: Company, order: Order, bundle: ReturnType<DatabaseApi["getCompanyBundle"]>) {
  const resolved = resolveOrderForPrint(order, bundle);
  openPrintable("Pedido", buildOrderNoteHtml(company, resolved.order, resolved.items));
}

function sendOrderUpdate(order: Order, company: Company, bundle: ReturnType<DatabaseApi["getCompanyBundle"]>) {
  const customer = bundle.customers.find((item) => item.id === order.customer_id);
  const items = bundle.order_items.filter((item) => item.order_id === order.id);
  const message = buildOrderNote(company, { ...order, customer_name: order.customer_name || customer?.name, customer_phone: order.customer_phone || customer?.phone, customer_address: order.customer_address || customer?.address }, items);
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  notify("success", "Mensagem de atualização preparada para WhatsApp.");
}

function ProductsManager({ company, products, categories, plan, setDbState }: { company: Company; products: Product[]; categories: Category[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", description: "", ingredients: "", price: "", category_id: categories[0]?.id || "", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80", preparation_time: "10", badge: "", featured: false, active: true };
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const visibleProducts = products.filter((product) => (categoryFilter === "all" || product.category_id === categoryFilter) && `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase()));
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !positiveNumber(form.price)) {
      notify("error", "Informe nome e preço válido para salvar o produto.");
      return;
    }
    if (!form.category_id) {
      notify("error", "Selecione uma categoria para o produto.");
      return;
    }
    if (!form.id && plan && products.length >= plan.max_products) {
      notify("error", "Limite de produtos do plano atingido. Entre em contato com a Startt Facilities.");
      return;
    }
    const product: Product = { id: form.id || id("prd"), company_id: company.id, category_id: form.category_id, name: form.name, description: form.description, ingredients: form.ingredients, price: parseMoney(form.price), image: form.image, preparation_time: Number(form.preparation_time) || 0, featured: form.featured, active: form.active, badge: form.badge || undefined };
    const editing = Boolean(form.id);
    runSave(setSaving, () => {
      setDbState((current) => ({ ...current, products: form.id ? current.products.map((item) => item.id === form.id && item.company_id === company.id ? product : item) : [product, ...current.products] }));
      setForm(blank);
      setFormOpen(false);
    }, editing ? "Produto atualizado com sucesso." : "Produto criado com sucesso.");
  }
  function create() { setForm({ ...blank, category_id: categories[0]?.id || "" }); setFormOpen(true); }
  function edit(product: Product) { setForm({ id: product.id, name: product.name, description: product.description, ingredients: product.ingredients || "", price: String(product.price), category_id: product.category_id, image: product.image, preparation_time: String(product.preparation_time), badge: product.badge || "", featured: product.featured, active: product.active }); setFormOpen(true); }
  function remove(product: Product) { if (confirm(`Excluir ${product.name}?`)) { setDbState((current) => ({ ...current, products: current.products.filter((item) => !(item.id === product.id && item.company_id === company.id)) })); notify("success", "Produto excluído com sucesso."); } }
  return (
    <CrudShell title="Produtos" description="Ative ou desative produtos conforme disponibilidade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><strong>{products.length} produtos cadastrados</strong><p className="text-sm text-startt-muted">Limite do plano: {plan?.max_products || "sem limite visível"}</p></div>
        <button onClick={create} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo produto</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <Input placeholder="Buscar produto..." value={search} onChange={setSearch} />
        <Select value={categoryFilter} onChange={setCategoryFilter}><option value="all">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}</Select>
      </div>
      <FormModal open={formOpen} title={form.id ? "Editar produto" : "Novo produto"} onClose={() => setFormOpen(false)}>
        <form onSubmit={save} className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold">Nome *<Input placeholder="Ex: Dog Especial" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Preço *<Input placeholder="0,00" value={form.price} onChange={(value) => setForm({ ...form, price: value })} /></label><label className="grid gap-2 text-sm font-bold">Categoria<Select value={form.category_id} onChange={(value) => setForm({ ...form, category_id: value })}>{categories.map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}</Select></label></div>
          <label className="grid gap-2 text-sm font-bold">Descrição<textarea className="min-h-28 rounded-xl border border-startt-border px-3 py-3 text-sm shadow-sm outline-startt-green focus:border-startt-green focus:shadow-input" placeholder="Descreva o produto..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <ImageUpload label="Imagem do produto" value={form.image} onChange={(value) => setForm({ ...form, image: value })} />
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Ordem<Input placeholder="0" value={form.preparation_time} onChange={(value) => setForm({ ...form, preparation_time: value })} /></label><label className="grid gap-2 text-sm font-bold">Notas internas<Input placeholder="Apenas admin vê" value={form.ingredients} onChange={(value) => setForm({ ...form, ingredients: value })} /></label></div>
          <div className="grid gap-2 rounded-2xl bg-startt-paper p-4">
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Ativo</label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Destaque</label>
          </div>
          <button disabled={saving} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20 disabled:opacity-60">{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}</button>
        </form>
      </FormModal>
      <div className="grid gap-3">
        {visibleProducts.map((product) => { const category = categories.find((item) => item.id === product.category_id); return <article key={product.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:flex-nowrap"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-startt-rose text-xl">{categoryEmoji(category)}</span><div className="min-w-0 flex-1"><strong className="block truncate">{product.name}</strong><p className="text-sm text-startt-muted">{categoryLabel(category)} • {money(product.price)}</p></div><label className="relative inline-flex cursor-pointer items-center"><input type="checkbox" className="peer sr-only" checked={product.active} onChange={() => setDbState((current) => ({ ...current, products: current.products.map((item) => item.id === product.id && item.company_id === company.id ? { ...item, active: !item.active } : item) }))} /><span className="h-6 w-11 rounded-full bg-startt-border transition peer-checked:bg-startt-green" /><span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" /></label><button className="grid h-10 w-10 place-items-center rounded-xl border border-black/10" onClick={() => edit(product)} aria-label="Editar"><Settings size={17} /></button><button className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-startt-red" onClick={() => remove(product)} aria-label="Excluir"><Trash2 size={17} /></button></article>; })}
        {!visibleProducts.length && <Empty text="Nenhum produto encontrado." />}
      </div>
    </CrudShell>
  );
}

function CategoriesManager({ company, categories, setDbState }: { company: Company; categories: Category[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  function add() { if (!name.trim()) { notify("error", "Informe o nome da categoria."); return; } if (saving) return; runSave(setSaving, () => { setDbState((current) => ({ ...current, categories: [{ id: id("cat"), company_id: company.id, name, emoji: emoji.trim() || "🍽️", sort_order: categories.length + 1, active: true }, ...current.categories] })); setName(""); setEmoji("🍽️"); setFormOpen(false); }, "Categoria salva com sucesso."); }
  function toggle(category: Category) { runSave(setSaving, () => setDbState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id && item.company_id === company.id ? { ...item, active: !item.active } : item) })), "Categoria atualizada."); }
  function remove(category: Category) { if (confirm(`Excluir ${category.name}?`)) { setDbState((current) => ({ ...current, categories: current.categories.filter((item) => !(item.id === category.id && item.company_id === company.id)) })); notify("success", "Categoria excluída com sucesso."); } }
  return <CrudShell title="Categorias" description="Organize o cardápio por seções e escolha um emoji para deixar o menu mais claro no celular."><div className="flex justify-end"><button onClick={() => setFormOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Nova categoria</button></div><FormDrawer open={formOpen} title="Nova categoria" description="Exemplos: 🥤 Bebidas, 🌭 Dogs, 🍔 Hambúrgueres, 🍕 Pizzas, 🍟 Combos." onClose={() => setFormOpen(false)}><div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-[96px_1fr]"><label className="grid gap-2 text-sm font-bold">Emoji<Input value={emoji} onChange={setEmoji} placeholder="🍔" /></label><label className="grid gap-2 text-sm font-bold">Nome<Input value={name} onChange={setName} placeholder="Nome da categoria" /></label></div><HelpText>O emoji aparece no cardápio público, na lista de produtos e ajuda o cliente a encontrar os itens mais rápido.</HelpText><button onClick={add} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Cadastrar categoria</button></div></FormDrawer><Table headers={["Emoji", "Nome", "Ordem", "Status", "Ações"]} rows={categories.map((category) => [<Input key={`${category.id}-emoji`} value={category.emoji || ""} placeholder="🍽️" onChange={(value) => setDbState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, emoji: value } : item) }))} />, <Input key={category.id} value={category.name} placeholder="Categoria" onChange={(value) => setDbState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, name: value } : item) }))} />, String(category.sort_order), category.active ? "Ativa" : "Inativa", <div key={category.id} className="flex flex-wrap gap-2"><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => toggle(category)}>Ativar/desativar</button><button className="rounded-xl bg-startt-red px-3 py-2 font-bold text-white" onClick={() => remove(category)}>Excluir</button></div>])} /></CrudShell>;
}

function CustomersManager({ company, customers, orders, orderItems, setDbState }: { company: Company; customers: Customer[]; orders: Order[]; orderItems: OrderItem[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", phone: "", address: "" };
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const visibleOrders = activeOrders(orders);
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(search.toLowerCase()));
  function stats(customer: Customer) {
    const history = visibleOrders.filter((order) => order.customer_id === customer.id || (order.normalized_phone && order.normalized_phone === customer.normalized_phone)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const totalOrders = history.length;
    const totalSpent = history.reduce((sum, order) => sum + order.total, 0);
    return { history, totalOrders, totalSpent, average: totalSpent / Math.max(1, totalOrders), last: customer.last_order_at || history[0]?.created_at || "" };
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized_phone = normalizePhone(form.phone);
    if (!form.name.trim() || normalized_phone.length < 10) {
      notify("error", "Informe nome e telefone com DDD.");
      return;
    }
    const createdAt = new Date().toISOString();
    const customer: Customer = { id: form.id || id("cus"), company_id: company.id, name: form.name.trim(), phone: form.phone.trim(), normalized_phone, address: form.address.trim(), total_orders: 0, total_spent: 0, last_order_at: "", created_at: createdAt, updated_at: createdAt };
    setDbState((current) => ({ ...current, customers: form.id ? current.customers.map((item) => item.id === form.id && item.company_id === company.id ? { ...item, ...customer, total_orders: item.total_orders || 0, total_spent: item.total_spent || 0, last_order_at: item.last_order_at, created_at: item.created_at, updated_at: createdAt } : item) : [customer, ...current.customers] }));
    setForm(blank);
    setFormOpen(false);
    notify("success", "Cliente salvo com sucesso.");
  }
  function create() { setForm(blank); setFormOpen(true); }
  function edit(customer: Customer) { setForm({ id: customer.id, name: customer.name, phone: customer.phone, address: customer.address }); setFormOpen(true); }
  function reactivationLink(customer: Customer) {
    const message = `Oi, ${customer.name}!\nAqui é da ${company.name}.\nVimos que faz um tempinho que você não pede com a gente.\nHoje estamos atendendo normalmente e temos várias opções saindo quentinhas.\nQuer que eu te mande o cardápio?\n\n${window.location.origin}/${company.slug}`;
    return `https://wa.me/${whatsappPhone(customer.normalized_phone || customer.phone)}?text=${encodeURIComponent(message)}`;
  }
  return (
    <CrudShell title="CRM de Clientes" description="Cadastro inteligente, histórico de pedidos e recompra por WhatsApp.">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input placeholder="Buscar por nome, telefone ou endereço" value={search} onChange={setSearch} />
        <button onClick={create} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo cliente</button>
      </div>
      <FormDrawer open={formOpen} title={form.id ? "Editar cliente" : "Novo cliente"} description="Telefone com DDD é a chave única dentro desta lancheria." onClose={() => setFormOpen(false)}>
        <form onSubmit={save} className="grid gap-3">
          <Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input placeholder="Telefone com DDD" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Input placeholder="Endereço mais usado" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
          <button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">{form.id ? "Salvar alterações" : "Cadastrar cliente"}</button>
        </form>
      </FormDrawer>
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((customer) => {
          const customerStats = stats(customer);
          return (
            <article key={customer.id} className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-lg">{customer.name}</strong>
                  <span className="text-sm font-bold text-startt-muted">{customer.phone}</span>
                  <p className="mt-2 line-clamp-2 text-sm text-startt-muted">{customer.address || "Endereço ainda não informado"}</p>
                </div>
                <span className="rounded-full bg-startt-green/10 px-3 py-1 text-xs font-black text-startt-green">{customerStats.totalOrders} pedidos</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-startt-paper p-3"><span className="block text-xs font-bold text-startt-muted">Total gasto</span><b>{money(customerStats.totalSpent)}</b></div>
                <div className="rounded-2xl bg-startt-paper p-3"><span className="block text-xs font-bold text-startt-muted">Ticket médio</span><b>{money(customerStats.average)}</b></div>
                <div className="rounded-2xl bg-startt-paper p-3"><span className="block text-xs font-bold text-startt-muted">Último pedido</span><b>{customerStats.last ? customerStats.last.slice(0, 10) : "-"}</b></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={reactivationLink(customer)} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-startt-green px-3 text-sm font-black text-white"><MessageCircle size={16} /> WhatsApp</a>
                <button onClick={() => setSelected(customer)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-black"><FileText size={16} /> Ver histórico</button>
                <button onClick={() => edit(customer)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-black"><Settings size={16} /> Editar</button>
              </div>
            </article>
          );
        })}
        {!visible.length && <Empty text="Nenhum cliente encontrado." />}
      </div>
      <CustomerHistoryDrawer open={Boolean(selected)} customer={selected} company={company} stats={selected ? stats(selected) : undefined} orderItems={orderItems} reactivationLink={selected ? reactivationLink(selected) : ""} onClose={() => setSelected(null)} />
    </CrudShell>
  );
}

function CustomerHistoryDrawer({ open, customer, company, stats, orderItems, reactivationLink, onClose }: { open: boolean; customer: Customer | null; company: Company; stats?: { history: Order[]; totalOrders: number; totalSpent: number; average: number; last: string }; orderItems: OrderItem[]; reactivationLink: string; onClose: () => void }) {
  return (
    <FormDrawer open={open} title={customer ? customer.name : "Cliente"} description="Histórico completo do relacionamento e pedidos." onClose={onClose}>
      {customer && stats && (
        <div className="grid gap-4">
          <div className="rounded-3xl bg-startt-paper p-4">
            <p className="font-black">{customer.phone}</p>
            <p className="mt-1 text-sm text-startt-muted">{customer.address || "Endereço não informado"}</p>
            <p className="mt-3 text-xs font-bold text-startt-muted">Cadastro: {customer.created_at ? customer.created_at.slice(0, 10) : "-"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Pedidos" value={String(stats.totalOrders)} icon={<ClipboardList />} />
            <Metric label="Total gasto" value={money(stats.totalSpent)} icon={<CreditCard />} />
            <Metric label="Ticket médio" value={money(stats.average)} icon={<FileText />} />
            <Metric label="Último pedido" value={stats.last ? stats.last.slice(0, 10) : "-"} icon={<Bell />} />
          </div>
          <a href={reactivationLink} target="_blank" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white"><MessageCircle size={18} /> Chamar no WhatsApp</a>
          <div className="grid gap-3">
            <h3 className="text-sm font-black uppercase text-startt-muted">Últimos pedidos</h3>
            {stats.history.map((order) => {
              const items = orderItems.filter((item) => item.order_id === order.id);
              return (
                <article key={order.id} className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>#{displayOrderNumber(order)}</strong>
                    <span className="rounded-full bg-startt-paper px-3 py-1 text-xs font-black">{order.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-startt-muted">{order.created_at.slice(0, 10)} • {order.payment_details || order.payment_method}</p>
                  <div className="mt-3 grid gap-1 text-sm">{items.map((item) => <span key={item.id}>{item.quantity}x {item.name}</span>)}</div>
                  <b className="mt-3 block">{money(order.total)}</b>
                </article>
              );
            })}
            {!stats.history.length && <Empty text="Este cliente ainda não possui histórico de pedidos." />}
          </div>
        </div>
      )}
    </FormDrawer>
  );
}

function CouponsManager({ company, coupons, plan, setDbState }: { company: Company; coupons: Coupon[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { code: "", type: "percentual", value: "", minimum_order: "0", usage_limit: "100", expires_at: "2026-12-31" };
  const [form, setForm] = useState(blank);
  function add() { if (!form.code || !positiveNumber(form.value)) { notify("error", "Informe código e valor válido para o cupom."); return; } if (plan && !plan.allow_coupons) { notify("error", "Seu plano atual não inclui este recurso. Entre em contato com a Startt Facilities."); return; } setDbState((current) => ({ ...current, coupons: [{ id: id("cup"), company_id: company.id, code: form.code.toUpperCase(), type: form.type as Coupon["type"], value: parseMoney(form.value), minimum_order: parseMoney(form.minimum_order) || 0, usage_limit: Number(form.usage_limit), used_count: 0, expires_at: form.expires_at, active: true }, ...current.coupons] })); setForm(blank); notify("success", "Cupom criado com sucesso."); }
  function toggle(coupon: Coupon) { setDbState((current) => ({ ...current, coupons: current.coupons.map((item) => item.id === coupon.id && item.company_id === company.id ? { ...item, active: !item.active } : item) })); }
  return <CrudShell title="Cupons" description="Criar, editar, excluir e ativar/desativar cupons."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-6"><Input placeholder="Código" value={form.code} onChange={(value) => setForm({ ...form, code: value })} /><Select value={form.type} onChange={(value) => setForm({ ...form, type: value })}><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></Select><Input placeholder="Valor" value={form.value} onChange={(value) => setForm({ ...form, value })} /><Input placeholder="Pedido mínimo" value={form.minimum_order} onChange={(value) => setForm({ ...form, minimum_order: value })} /><Input placeholder="Limite" value={form.usage_limit} onChange={(value) => setForm({ ...form, usage_limit: value })} /><button onClick={add} className="rounded-lg bg-startt-green px-4 font-black text-white">Criar</button></div><Table headers={["Código", "Tipo", "Valor", "Mínimo", "Uso", "Status", "Ações"]} rows={coupons.map((coupon) => [coupon.code, coupon.type, coupon.type === "percentual" ? `${coupon.value}%` : money(coupon.value), money(coupon.minimum_order), `${coupon.used_count}/${coupon.usage_limit}`, coupon.active ? "Ativo" : "Inativo", <div key={coupon.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => toggle(coupon)}>Ativar/desativar</button><button className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white" onClick={() => setDbState((current) => ({ ...current, coupons: current.coupons.filter((item) => !(item.id === coupon.id && item.company_id === company.id)) }))}>Excluir</button></div>])} /></CrudShell>;
}

function Reports({ company, bundle }: { company: Company; bundle: ReturnType<DatabaseApi["getCompanyBundle"]> }) {
  const [start, setStart] = useState(todayInput());
  const [end, setEnd] = useState(todayInput());
  const [type, setType] = useState("todos");
  const [status, setStatus] = useState("todos");
  const online = activeOrders(bundle.orders).filter((item) => isInPeriod(item.created_at, start, end) && (status === "todos" || item.status === status));
  const cash = bundle.cash_sales.filter((item) => isInPeriod(item.created_at, start, end));
  const entries = type === "online" ? online.map((item) => ({ id: item.id, tipo: "Online", total: item.total, date: item.created_at, status: item.status })) : type === "caixa" ? cash.map((item) => ({ id: item.id, tipo: "Caixa", total: item.total, date: item.created_at, status: "concluido" })) : [...online.map((item) => ({ id: item.id, tipo: "Online", total: item.total, date: item.created_at, status: item.status })), ...cash.map((item) => ({ id: item.id, tipo: "Caixa", total: item.total, date: item.created_at, status: "concluido" }))];
  const total = entries.reduce((sum, item) => sum + item.total, 0);
  function pdf() { openPrintable("Relatório", `<h1>${company.name}</h1><p>Período: ${start} até ${end}</p><p>Tipo: ${type}</p><p>Total: ${money(total)}</p><p>Quantidade: ${entries.length}</p><p>Ticket médio: ${money(total / Math.max(1, entries.length))}</p><table><tr><th>ID</th><th>Tipo</th><th>Status</th><th>Total</th></tr>${entries.map((item) => `<tr><td>${item.id}</td><td>${item.tipo}</td><td>${item.status}</td><td>${money(item.total)}</td></tr>`).join("")}</table><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`); }
  return <CrudShell title="Relatórios" description="Filtros por período, tipo, status e exportação PDF."><div className="grid gap-3 md:grid-cols-5"><Input type="date" placeholder="" value={start} onChange={setStart} /><Input type="date" placeholder="" value={end} onChange={setEnd} /><Select value={type} onChange={setType}><option value="todos">Todos</option><option value="online">Pedidos online</option><option value="caixa">Caixa presencial</option></Select><Select value={status} onChange={setStatus}><option value="todos">Todos status</option>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select><button onClick={pdf} className="rounded-lg bg-startt-green px-4 font-black text-white">Exportar PDF</button></div><div className="grid gap-4 md:grid-cols-3"><Metric label="Total" value={money(total)} icon={<CreditCard />} /><Metric label="Quantidade" value={String(entries.length)} icon={<ClipboardList />} /><Metric label="Ticket médio" value={money(total / Math.max(1, entries.length))} icon={<FileText />} /></div><Table headers={["ID", "Tipo", "Status", "Data", "Total"]} rows={entries.map((item) => [item.id, item.tipo, item.status, item.date.slice(0, 10), money(item.total)])} /></CrudShell>;
}

function ZonesManager({ company, zones, setDbState }: { company: Company; zones: DeliveryZone[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [form, setForm] = useState({ neighborhood: "", fee: "", estimated_minutes: "" });
  function add() { if (!form.neighborhood || !positiveNumber(form.fee)) { notify("error", "Informe bairro e valor de frete válido."); return; } setDbState((current) => ({ ...current, delivery_zones: [{ id: id("zon"), company_id: company.id, neighborhood: form.neighborhood, fee: parseMoney(form.fee), estimated_minutes: form.estimated_minutes, active: true }, ...current.delivery_zones] })); setForm({ neighborhood: "", fee: "", estimated_minutes: "" }); notify("success", "Frete cadastrado com sucesso."); }
  return <CrudShell title="Fretes" description="Bairros ativos aparecem no checkout público e aplicam frete automaticamente."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-4"><Input placeholder="Bairro" value={form.neighborhood} onChange={(value) => setForm({ ...form, neighborhood: value })} /><Input placeholder="Valor do frete" value={form.fee} onChange={(value) => setForm({ ...form, fee: value })} /><Input placeholder="Tempo estimado" value={form.estimated_minutes} onChange={(value) => setForm({ ...form, estimated_minutes: value })} /><button onClick={add} className="rounded-lg bg-startt-green px-4 font-black text-white">Cadastrar</button></div><Table headers={["Bairro", "Frete", "Tempo", "Status", "Ações"]} rows={zones.map((zone) => [zone.neighborhood, money(zone.fee), zone.estimated_minutes, zone.active ? "Ativo" : "Inativo", <button key={zone.id} className="rounded-lg border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, delivery_zones: current.delivery_zones.map((item) => item.id === zone.id && item.company_id === company.id ? { ...item, active: !item.active } : item) }))}>Ativar/desativar</button>])} /></CrudShell>;
}

function PrintManager({ company, user, settings, setDbState }: { company: Company; user: User; settings?: PrintSettings; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const fallback: PrintSettings = { company_id: company.id, auto_print_orders: false, auto_print_cash_sales: false, printer_name: "", qz_tray_enabled: false, qz_printer_name: getSavedQzPrinter(company.id, user.id), paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" };
  const [form, setForm] = useState<PrintSettings>({ ...fallback, ...settings, qz_printer_name: settings?.qz_printer_name || settings?.printer_name || fallback.qz_printer_name || "" });
  const [qzStatus, setQzStatus] = useState(getQzStatus());
  const [printers, setPrinters] = useState<string[]>(form.qz_printer_name ? [form.qz_printer_name] : []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function save(next = form) {
    const normalized = { ...next, paper_width: "80mm" as const, printer_name: next.printer_name || next.qz_printer_name || "", qz_printer_name: next.qz_printer_name || next.printer_name || "" };
    saveQzPrinter(company.id, user.id, normalized.qz_printer_name || "");
    setForm(normalized);
    setDbState((current) => ({ ...current, print_settings: current.print_settings.some((item) => item.company_id === company.id) ? current.print_settings.map((item) => item.company_id === company.id ? normalized : item) : [...current.print_settings, normalized] }));
    notify("success", "Configuração de impressão salva.");
  }

  async function run(success: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setQzStatus(getQzStatus());
      setMessage(success);
      notify("success", success);
    } catch (error) {
      const readable = readableError(error);
      setMessage(readable);
      notify("error", readable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrudShell title="Impressão" description="Configure o QZ Tray para imprimir pedidos automaticamente na térmica 80mm do Windows 10.">
      <section className="grid gap-4 rounded-3xl border border-black/10 bg-[#0A0A0A] p-5 text-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">QZ Tray</h2><p className="text-sm text-white/60">Impressão silenciosa via aplicativo local instalado no Windows.</p></div>
          <span className={`rounded-full px-3 py-1 text-sm font-black ${qzStatus === "connected" ? "bg-emerald-400/15 text-emerald-300" : "bg-[#FF6A00]/15 text-[#FF6A00]"}`}>{qzStatus === "connected" ? "Conectado" : "Desconectado"}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <button disabled={busy} onClick={() => run("QZ Tray conectado.", connectQzTray)} className="min-h-12 rounded-xl bg-[#FF6A00] px-4 font-black text-white disabled:opacity-60">Conectar QZ Tray</button>
          <button disabled={busy} onClick={() => run("QZ Tray desconectado.", disconnectQzTray)} className="min-h-12 rounded-xl border border-white/15 px-4 font-black text-white disabled:opacity-60">Desconectar</button>
          <button disabled={busy} onClick={() => run("Impressoras atualizadas.", async () => setPrinters(await listQzPrinters()))} className="min-h-12 rounded-xl border border-white/15 px-4 font-black text-white disabled:opacity-60">Buscar impressoras</button>
          <a href={getQzDownloadUrl()} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 font-black text-[#0A0A0A]">Baixar QZ Tray</a>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/76">{qzInstallInstructions()} Em produção, a assinatura deve ser feita por endpoint seguro no servidor. O frontend aceita modo demo/local sem chave privada para testes.</div>
        {message && <div className="rounded-2xl bg-white/8 p-3 text-sm font-bold text-white/80">{message}</div>}
      </section>
      <section className="grid gap-4 rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Impressora térmica<Select value={form.qz_printer_name || ""} onChange={(value) => setForm({ ...form, qz_printer_name: value, printer_name: value })}><option value="">Selecione uma impressora</option>{printers.map((printer) => <option key={printer} value={printer}>{printer}</option>)}</Select></label>
          <label className="grid gap-2 text-sm font-bold">Quantidade de vias<Input placeholder="1" value={String(form.copies)} onChange={(value) => setForm({ ...form, copies: Math.max(1, Number(value) || 1) })} /></label>
          <label className="grid gap-2 text-sm font-bold md:col-span-2">Rodapé<Input placeholder="Mensagem final" value={form.footer_text} onChange={(value) => setForm({ ...form, footer_text: value })} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-startt-paper px-4 font-black"><input type="checkbox" checked={Boolean(form.qz_tray_enabled)} onChange={(event) => setForm({ ...form, qz_tray_enabled: event.target.checked })} /> Usar QZ Tray nesta loja</label>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-startt-paper px-4 font-black"><input type="checkbox" checked={form.auto_print_orders} onChange={(event) => setForm({ ...form, auto_print_orders: event.target.checked, qz_tray_enabled: event.target.checked ? true : form.qz_tray_enabled })} /> Impressão automática de pedidos</label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => save()} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Salvar impressora</button>
          <button onClick={() => run("Teste enviado para a impressora.", async () => printQzTest(form.qz_printer_name || form.printer_name || "", company.name))} className="min-h-12 rounded-xl border border-black/10 bg-white px-4 font-black">Imprimir teste QZ</button>
          <button onClick={() => openThermalPrintable("Teste térmico 80mm", `<main class="thermal-receipt"><section class="center"><strong class="store">${htmlEscape(company.name)}</strong><div>Teste de impressão 80mm</div></section><div class="sep"></div><div class="line"><span>Total</span><span>R$ 0,00</span></div><div class="sep"></div><section class="center"><div>Pedido gerado pelo Startt Delivery</div><div>Produto Startt Facilities</div></section></main>`)} className="min-h-12 rounded-xl border border-black/10 bg-white px-4 font-black">Teste pelo navegador</button>
        </div>
      </section>
    </CrudShell>
  );
}

function CompanySettings({ company, voucherBrands, settings, printSettings, setDbState }: { company: Company; voucherBrands: VoucherBrand[]; settings?: CompanySettingsRecord; printSettings?: PrintSettings; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [form, setForm] = useState(company);
  const [saving, setSaving] = useState(false);
  const [voucherForm, setVoucherForm] = useState({ id: "", name: "", fee_percentage: "", active: true });
  const [pixForm, setPixForm] = useState({
    enabled: settings?.pix_enabled || false,
    key: settings?.pix_key || "",
  });
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [autoPrintOrders, setAutoPrintOrders] = useState(printSettings?.auto_print_orders || false);
  const defaultHour = company.opening_hours.match(/\d{1,2}:\d{2}[- às]+\d{1,2}:?\d{0,2}/)?.[0]?.replace(" às ", "-") || "18:00-23:00";
  const [hours, setHours] = useState(() => weekDays.map((day) => ({ day, active: company.is_open, time: defaultHour })));
  function openingHoursSummary() {
    const active = hours.filter((item) => item.active);
    if (!active.length) return "Fechado hoje";
    const sameTime = active.every((item) => item.time === active[0].time);
    if (sameTime && active.length === 7) return `Aberto todos os dias, ${active[0].time}`;
    if (sameTime && active.length === 6 && active.every((item) => item.day !== "Domingo")) return `Aberto Seg-Sáb, ${active[0].time}`;
    return active.map((item) => `${item.day.slice(0, 3)} ${item.time}`).join(" • ");
  }
  function save() { if (saving) return; const opening_hours = openingHoursSummary(); runSave(setSaving, () => setDbState((current) => ({ ...current, companies: current.companies.map((item) => item.id === company.id ? { ...form, opening_hours, is_open: hours.some((hour) => hour.active), hero_image: form.banner_url || form.hero_image, updated_at: new Date().toISOString() } : item) })), "Configurações salvas com sucesso."); }
  function saveAutoPrint(value: boolean) {
    setAutoPrintOrders(value);
    const fallback: PrintSettings = { company_id: company.id, auto_print_orders: value, auto_print_cash_sales: printSettings?.auto_print_cash_sales || false, printer_name: printSettings?.printer_name || "", qz_tray_enabled: printSettings?.qz_tray_enabled || false, qz_printer_name: printSettings?.qz_printer_name || "", paper_width: printSettings?.paper_width || "80mm", copies: printSettings?.copies || 1, footer_text: printSettings?.footer_text || "Startt Delivery — produzido por Startt Facilities" };
    setDbState((current) => ({ ...current, print_settings: current.print_settings.some((item) => item.company_id === company.id) ? current.print_settings.map((item) => item.company_id === company.id ? { ...item, auto_print_orders: value } : item) : [...current.print_settings, fallback] }));
    notify("success", value ? "Impressão automática ativada." : "Impressão automática desativada.");
  }
  function savePixSettings(event: React.FormEvent) {
    event.preventDefault();
    const normalizedPix = normalizePixKey(pixForm.key);
    if (pixForm.enabled && !normalizedPix.valid) {
      if (normalizedPix.type === "telefone incompleto") {
        notify("error", "Telefone PIX incompleto. Informe DDD + número, por exemplo: 5198200997.");
        return;
      }
      notify("error", "Informe uma chave PIX válida: CPF, CNPJ, e-mail, telefone brasileiro ou chave aleatória.");
      return;
    }
    const record: CompanySettingsRecord = {
      id: settings?.id || id("set"),
      company_id: company.id,
      critical_locked: settings?.critical_locked || false,
      pix_enabled: pixForm.enabled,
      pix_key: pixForm.enabled ? normalizedPix.key : pixForm.key.trim(),
      pix_receiver_name: settings?.pix_receiver_name || "Startt Delivery",
      pix_city: settings?.pix_city || "Porto Alegre",
      pix_description: "",
    };
    setDbState((current) => ({
      ...current,
      settings: current.settings.some((item) => item.company_id === company.id)
        ? current.settings.map((item) => item.company_id === company.id ? { ...item, ...record } : item)
        : [record, ...current.settings],
    }));
    setPixForm({ ...pixForm, key: record.pix_key || "" });
    notify("success", pixForm.enabled ? `PIX ativado no checkout público. Tipo detectado: ${normalizedPix.type}.` : "PIX desativado no checkout público.");
  }
  function saveVoucher(event: React.FormEvent) {
    event.preventDefault();
    if (!voucherForm.name.trim()) {
      notify("error", "Informe o nome da marca do vale.");
      return;
    }
    const nowIso = new Date().toISOString();
    const previous = voucherBrands.find((item) => item.id === voucherForm.id);
    const brand: VoucherBrand = { id: voucherForm.id || id("vou"), company_id: company.id, name: voucherForm.name.trim(), fee_percentage: parseMoney(voucherForm.fee_percentage) || 0, active: voucherForm.active, created_at: previous?.created_at || nowIso, updated_at: nowIso };
    setDbState((current) => ({ ...current, voucher_brands: voucherForm.id ? current.voucher_brands.map((item) => item.id === voucherForm.id && item.company_id === company.id ? brand : item) : [brand, ...current.voucher_brands] }));
    setVoucherForm({ id: "", name: "", fee_percentage: "", active: true });
    setVoucherOpen(false);
    notify("success", "Marca de vale salva com sucesso.");
  }
  function createVoucher() { setVoucherForm({ id: "", name: "", fee_percentage: "", active: true }); setVoucherOpen(true); }
  function editVoucher(brand: VoucherBrand) { setVoucherForm({ id: brand.id, name: brand.name, fee_percentage: String(brand.fee_percentage || ""), active: brand.active }); setVoucherOpen(true); }
  function deleteVoucher(brand: VoucherBrand) {
    if (!confirm(`Excluir vale ${brand.name}?`)) return;
    setDbState((current) => ({ ...current, voucher_brands: current.voucher_brands.filter((item) => !(item.id === brand.id && item.company_id === company.id)) }));
    notify("success", "Marca de vale excluída.");
  }
  return (
    <CrudShell title="Configurações" description="Essas configs alteram o cardápio público da empresa.">
      <div className="grid gap-5 rounded-2xl border border-black/10 bg-white p-4 shadow-card">
        <div className="grid gap-4 lg:grid-cols-2">
          <ImageUpload label="Logo da loja" value={form.logo_url} storage={{ companyId: company.id, kind: "logo" }} onChange={(value) => setForm({ ...form, logo_url: value })} />
          <ImageUpload label="Banner do cardápio" value={form.banner_url || form.hero_image} storage={{ companyId: company.id, kind: "banner" }} onChange={(value) => setForm({ ...form, banner_url: value, hero_image: value })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Nome da empresa" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} />
          <Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
          <Input placeholder="Pedido mínimo" value={String(form.minimum_order)} onChange={(value) => setForm({ ...form, minimum_order: Number(value) || 0 })} />
          <Input placeholder="Tempo estimado" value={form.estimated_delivery_time} onChange={(value) => setForm({ ...form, estimated_delivery_time: value })} />
          <Input placeholder="Cor principal" value={form.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} />
          <Input placeholder="Mensagem de rodapé" value={form.footer_message} onChange={(value) => setForm({ ...form, footer_message: value })} />
        </div>
        <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
          <h3 className="text-lg font-black">Horários de funcionamento</h3>
          <p className="text-sm text-startt-muted">Defina dias e horários. O resumo aparece no cardápio público.</p>
          <div className="grid gap-2">
            {hours.map((item, index) => <div key={item.day} className="grid gap-2 rounded-2xl bg-startt-paper p-3 sm:grid-cols-[120px_auto_1fr] sm:items-center"><strong>{item.day}</strong><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={item.active} onChange={(event) => setHours((current) => current.map((hour, i) => i === index ? { ...hour, active: event.target.checked } : hour))} /> Aberto</label><Input placeholder="18:00-23:00" value={item.time} onChange={(value) => setHours((current) => current.map((hour, i) => i === index ? { ...hour, time: value } : hour))} /></div>)}
          </div>
          <span className="rounded-xl bg-startt-rose p-3 text-sm font-bold text-startt-green">{openingHoursSummary()}</span>
        </section>
        <form onSubmit={savePixSettings} className="grid gap-4 rounded-2xl border border-startt-green/20 bg-gradient-to-br from-startt-green/10 to-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Pagamento via PIX</h3>
              <p className="text-sm text-startt-muted">Disponível para todos os planos. Basta ativar e informar a chave PIX; o sistema gera QR Code, copia e cola e TXID automaticamente.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPixForm({ ...pixForm, enabled: true })} className={`min-h-11 rounded-xl px-4 font-black ${pixForm.enabled ? "bg-startt-green text-white shadow-lg shadow-startt-green/20" : "border border-black/10 bg-white"}`}>Ativado</button>
              <button type="button" onClick={() => setPixForm({ ...pixForm, enabled: false })} className={`min-h-11 rounded-xl px-4 font-black ${!pixForm.enabled ? "bg-startt-ink text-white" : "border border-black/10 bg-white"}`}>Desativado</button>
            </div>
          </div>
          <div className="grid gap-2 md:max-w-xl">
            <Input placeholder="CPF, CNPJ, e-mail, telefone com DDD ou chave aleatória" value={pixForm.key} onChange={(key) => setPixForm({ ...pixForm, key })} />
            <span className="text-xs font-bold text-startt-muted">Aceita CPF, CNPJ, e-mail, telefone brasileiro ou chave aleatória. Telefones são convertidos automaticamente para +55 no QR Code.</span>
          </div>
          <button className="w-fit rounded-xl bg-startt-green px-4 py-3 font-black text-white shadow-lg shadow-startt-green/20">Salvar PIX</button>
        </form>
        <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Vales aceitos</h3>
              <p className="text-sm text-startt-muted">Configure marcas, taxas e disponibilidade no checkout público.</p>
            </div>
            <button type="button" onClick={createVoucher} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo vale</button>
          </div>
          <FormDrawer open={voucherOpen} title={voucherForm.id ? "Editar vale" : "Novo vale aceito"} description="Apenas marcas ativas aparecem no checkout público desta lancheria." onClose={() => setVoucherOpen(false)}>
            <form onSubmit={saveVoucher} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold">Marca<Input placeholder="Alelo, Sodexo, Ticket, VR..." value={voucherForm.name} onChange={(value) => setVoucherForm({ ...voucherForm, name: value })} /></label>
              <label className="grid gap-2 text-sm font-bold">Taxa percentual<Input placeholder="Ex: 5" value={voucherForm.fee_percentage} onChange={(value) => setVoucherForm({ ...voucherForm, fee_percentage: value })} /></label>
              <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-startt-paper px-4 font-bold"><input type="checkbox" checked={voucherForm.active} onChange={(event) => setVoucherForm({ ...voucherForm, active: event.target.checked })} /> Vale ativo no checkout</label>
              <button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">{voucherForm.id ? "Salvar vale" : "Cadastrar vale"}</button>
            </form>
          </FormDrawer>
          <div className="grid gap-3 sm:grid-cols-2">
            {voucherBrands.map((brand) => (
              <article key={brand.id} className="rounded-2xl border border-black/10 bg-startt-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><strong>{brand.name}</strong><p className="text-sm text-startt-muted">Taxa cadastrada: {brand.fee_percentage || 0}%</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${brand.active ? "bg-startt-green/10 text-startt-green" : "bg-black/5 text-startt-muted"}`}>{brand.active ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button type="button" className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-black" onClick={() => editVoucher(brand)}>Editar</button>
                  <button type="button" className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-black" onClick={() => setDbState((current) => ({ ...current, voucher_brands: current.voucher_brands.map((item) => item.id === brand.id && item.company_id === company.id ? { ...item, active: !item.active, updated_at: new Date().toISOString() } : item) }))}>Ativar/desativar</button>
                  <button type="button" className="min-h-11 rounded-xl bg-startt-red px-3 text-sm font-black text-white" onClick={() => deleteVoucher(brand)}>Excluir</button>
                </div>
              </article>
            ))}
            {!voucherBrands.length && <Empty text="Nenhuma marca de vale configurada." />}
          </div>
        </section>
        <div className="flex flex-wrap gap-4 rounded-2xl bg-startt-paper p-4">
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} /> Aberto</label>
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.delivery_enabled} onChange={(e) => setForm({ ...form, delivery_enabled: e.target.checked })} /> Permitir entrega</label>
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.pickup_enabled} onChange={(e) => setForm({ ...form, pickup_enabled: e.target.checked })} /> Permitir retirada</label>
        </div>
        <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
          <div>
            <h3 className="text-lg font-black">Impressão automática de pedidos</h3>
            <p className="text-sm text-startt-muted">Quando ativado, o painel tenta abrir a nota térmica 80mm automaticamente ao receber novo pedido. Se o navegador bloquear, use o botão manual em Pedidos.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => saveAutoPrint(true)} className={`min-h-11 rounded-xl px-4 font-black ${autoPrintOrders ? "bg-startt-green text-white shadow-lg shadow-startt-green/20" : "border border-black/10 bg-white"}`}>Ativado</button>
            <button type="button" onClick={() => saveAutoPrint(false)} className={`min-h-11 rounded-xl px-4 font-black ${!autoPrintOrders ? "bg-startt-ink text-white" : "border border-black/10 bg-white"}`}>Desativado</button>
          </div>
        </section>
        <button disabled={saving} onClick={save} className="w-fit rounded-xl bg-startt-green px-4 py-3 font-black text-white shadow-lg shadow-startt-green/20 disabled:opacity-60">{saving ? "Salvando..." : "Salvar configurações"}</button>
      </div>
    </CrudShell>
  );
}

function UsersManager({ company, users, plan, setDbState }: { company: Company; users: User[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { name: "", email: "", password: "", role: "atendente" as UserRole };
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  function add() { if (saving) return; if (!form.name || !form.email || form.password.length < 6) { notify("error", "Informe nome, e-mail e senha com pelo menos 6 caracteres."); return; } if (!company.is_registration_enabled) { notify("error", "Cadastro/acesso temporariamente desativado."); return; } if (plan && users.length >= plan.max_users) { notify("error", "Limite de usuários do plano atingido. Entre em contato com a Startt Facilities."); return; } runSave(setSaving, () => { setDbState((current) => ({ ...current, users: [{ id: id("usr"), company_id: company.id, name: form.name, email: form.email, password: form.password, role: form.role, is_active: true, created_at: new Date().toISOString() }, ...current.users] })); setForm(blank); setFormOpen(false); }, "Usuário criado com sucesso."); }
  function toggle(user: User) { runSave(setSaving, () => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id && item.company_id === company.id ? { ...item, is_active: !item.is_active } : item) })), user.is_active ? "Usuário bloqueado com sucesso." : "Usuário desbloqueado com sucesso."); }
  function reset(user: User) { if (!confirm(`Redefinir senha de ${user.name}?`)) return; const password = prompt("Nova senha"); if (password) runSave(setSaving, () => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id && item.company_id === company.id ? { ...item, password } : item) })), "Senha redefinida com sucesso."); }
  return <CrudShell title="Usuários" description="Usuários internos e funções por empresa."><div className="flex justify-end"><button onClick={() => setFormOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo usuário</button></div><FormDrawer open={formOpen} title="Novo usuário" description="Convide ou crie acessos internos com função por operação." onClose={() => setFormOpen(false)}><div className="grid gap-3"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="E-mail" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input placeholder="Senha" value={form.password} onChange={(value) => setForm({ ...form, password: value })} /><Select value={form.role} onChange={(value) => setForm({ ...form, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><button onClick={add} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Criar usuário</button></div></FormDrawer><Table headers={["Nome", "E-mail", "Função", "Status", "Ações"]} rows={users.map((user) => [user.name, user.email, user.role, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex gap-2"><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => reset(user)}>Redefinir senha</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => toggle(user)}>Ativar/bloquear</button></div>])} /></CrudShell>;
}

function MasterApp({ db, setDbState, screen, login }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; screen: MasterScreen; login: boolean }) {
  const [session, setSession] = useState(() => localStorage.getItem(MASTER_SESSION_KEY));
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [masterError, setMasterError] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  function doLogin(event: React.FormEvent) { event.preventDefault(); const found = db.master_users.find((user) => user.email === credentials.email && user.password === credentials.password && user.is_active); if (!found) { setMasterError("Login master inválido ou bloqueado."); return; } setMasterError(""); localStorage.setItem(MASTER_SESSION_KEY, found.id); setSession(found.id); window.history.pushState({}, "", "/master"); }
  if (!session) return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(242,106,27,.16),transparent_34rem),#f7f4ef] p-4"><form onSubmit={doLogin} className="grid w-[min(460px,100%)] gap-4 rounded-3xl border border-black/10 bg-white p-6 shadow-2xl"><LogoTitle title="Admin Master" subtitle="Produto Startt Delivery" /><p className="text-sm leading-6 text-startt-muted">Acesse seu painel para gerenciar empresas, planos e usuários com segurança.</p><Input placeholder="E-mail" value={credentials.email} onChange={(email) => setCredentials({ ...credentials, email })} /><PasswordField placeholder="Senha" value={credentials.password} onChange={(password) => setCredentials({ ...credentials, password })} visible={showMasterPassword} onToggle={() => setShowMasterPassword((value) => !value)} />{masterError && <p className="rounded-lg bg-startt-red/10 p-3 text-sm font-bold text-startt-red">{masterError}</p>}<button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-startt-green px-4 font-black text-white"><ShieldCheck size={18} /> Entrar</button></form></main>;
  return <main className="min-h-screen bg-startt-paper"><header className="sticky top-0 z-30 border-b border-black/10 bg-startt-paper/95 px-4 py-3"><div className="mx-auto flex w-[min(1280px,100%)] items-center justify-between"><LogoTitle title="Admin Master" subtitle="Controle geral do SaaS" /><button onClick={() => { localStorage.removeItem(MASTER_SESSION_KEY); setSession(null); }} className="rounded-lg border bg-white px-4 py-3 font-black">Sair</button></div></header><section className="mx-auto grid w-[min(1280px,calc(100%-32px))] gap-6 py-6 lg:grid-cols-[260px_1fr]"><aside className="grid gap-2 self-start rounded-lg border border-black/10 bg-white p-3">{(["dashboard", "empresas", "usuarios", "planos", "configuracoes"] as MasterScreen[]).map((item) => <a key={item} href={`/master/${item === "dashboard" ? "" : item}`} className={`rounded-lg px-3 py-3 font-black ${screen === item || (!screen && item === "dashboard") ? "bg-startt-green text-white" : "bg-startt-soft"}`}>{item}</a>)}</aside><MasterContent screen={screen || "dashboard"} db={db} setDbState={setDbState} /></section></main>;
}

function MasterContent({ screen, db, setDbState }: { screen: MasterScreen; db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  if (screen === "empresas") return <MasterCompanies db={db} setDbState={setDbState} />;
  if (screen === "usuarios") return <section className="grid gap-5"><MasterUsers db={db} setDbState={setDbState} /><MasterUserControls db={db} setDbState={setDbState} /></section>;
  if (screen === "planos") return <MasterPlans db={db} setDbState={setDbState} />;
  if (screen === "configuracoes") return <CrudShell title="Configurações SaaS" description="Configurações globais preparadas para evolução."><Panel title="Ambiente">Startt Delivery — produzido por Startt Facilities</Panel></CrudShell>;
  const mrr = db.companies.filter((company) => ["active", "trialing"].includes(company.subscription_status)).reduce((sum, company) => sum + company.monthly_price, 0);
  return <section className="grid gap-5"><AdminHero title="Dashboard geral" description="Métricas gerais do SaaS Startt Delivery." /><div className="grid gap-4 md:grid-cols-4"><Metric label="Total de empresas" value={String(db.companies.length)} icon={<Building2 />} /><Metric label="Empresas ativas" value={String(db.companies.filter((item) => item.status === "active").length)} icon={<Check />} /><Metric label="Empresas trial" value={String(db.companies.filter((item) => item.status === "trial").length)} icon={<Sparkles />} /><Metric label="Inadimplentes" value={String(db.companies.filter((item) => item.subscription_status === "overdue").length)} icon={<CreditCard />} /><Metric label="Bloqueadas" value={String(db.companies.filter((item) => item.status === "blocked").length)} icon={<ShieldCheck />} /><Metric label="Pedidos no sistema" value={String(db.orders.length)} icon={<ClipboardList />} /><Metric label="MRR previsto" value={money(mrr)} icon={<CreditCard />} /></div><Panel title="Últimos restaurantes cadastrados">{db.companies.slice(-5).map((company) => <div key={company.id} className="flex justify-between border-b py-2"><span>{company.name}</span><b>{company.status} • {company.subscription_status}</b></div>)}</Panel></section>;
}

function MasterCompanies({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const firstPlan = db.plans.find((plan) => plan.is_active) || db.plans[0];
  const emptyForm = { id: "", name: "", slug: "", whatsapp: "", address: "", status: "trial" as CompanyStatus, plan_id: firstPlan?.id || "", primary_color: "#116a4b", monthly_price: String(firstPlan?.monthly_price || 49.9), due_day: "10", next_due_date: todayInput(), subscription_status: "trialing" as SubscriptionStatus, is_registration_enabled: true, admin_email: "", admin_password: "", payment_notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessForm, setAccessForm] = useState({ company_id: "", user_id: "", name: "", email: "", password: "", confirm_password: "", role: "dono" as UserRole, is_active: true });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantForm, setAssistantForm] = useState({ company_id: "", assistant_enabled: false, assistant_status: "inactive" as AssistantStatus, assistant_plan: "mvp", assistant_trial_until: "", assistant_notes: "" });
  const [showAccessPassword, setShowAccessPassword] = useState(false);

  function selectedPlan(planId = form.plan_id) {
    return db.plans.find((plan) => plan.id === planId) || firstPlan;
  }

  function primaryUser(companyId: string) {
    return db.users.find((user) => user.company_id === companyId && user.role === "dono") || db.users.find((user) => user.company_id === companyId);
  }

  function startCreate() {
    setForm(emptyForm);
    setFormOpen(true);
  }

  function startEdit(company: Company) {
    setForm({
      id: company.id,
      name: company.name,
      slug: company.slug,
      whatsapp: company.whatsapp,
      address: company.address,
      status: company.status,
      plan_id: company.plan_id,
      primary_color: company.primary_color,
      monthly_price: String(company.monthly_price),
      due_day: String(company.due_day),
      next_due_date: company.next_due_date,
      subscription_status: company.subscription_status,
      is_registration_enabled: company.is_registration_enabled,
      admin_email: "",
      admin_password: "",
      payment_notes: company.payment_notes,
    });
    setFormOpen(true);
  }

  function openAccess(company: Company) {
    const user = primaryUser(company.id);
    setAccessForm({ company_id: company.id, user_id: user?.id || "", name: user?.name || "Admin", email: user?.email || "", password: "", confirm_password: "", role: user?.role || "dono", is_active: user?.is_active ?? true });
    setShowAccessPassword(false);
    setAccessOpen(true);
  }

  function openAssistant(company: Company) {
    setAssistantForm({
      company_id: company.id,
      assistant_enabled: company.assistant_enabled ?? false,
      assistant_status: company.assistant_status || "inactive",
      assistant_plan: company.assistant_plan || "mvp",
      assistant_trial_until: company.assistant_trial_until?.slice(0, 10) || "",
      assistant_notes: company.assistant_notes || "",
    });
    setAssistantOpen(true);
  }

  function saveAssistant(event: React.FormEvent) {
    event.preventDefault();
    const trialUntil = assistantForm.assistant_trial_until ? `${assistantForm.assistant_trial_until}T23:59:59.000Z` : "";
    setDbState((current) => ({
      ...current,
      companies: current.companies.map((company) => company.id === assistantForm.company_id ? {
        ...company,
        assistant_enabled: assistantForm.assistant_enabled,
        assistant_status: assistantForm.assistant_status,
        assistant_plan: assistantForm.assistant_plan,
        assistant_trial_until: trialUntil,
        assistant_notes: assistantForm.assistant_notes,
        updated_at: new Date().toISOString(),
      } : company),
    }));
    setAssistantOpen(false);
    notify("success", "Configuração do Assistente Startt atualizada.");
  }

  function saveAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!accessForm.email.trim()) {
      notify("error", "Informe o login/e-mail da lancheria.");
      return;
    }
    if (!accessForm.user_id && !accessForm.password) {
      notify("error", "Defina uma senha inicial para a lancheria.");
      return;
    }
    if (accessForm.password || accessForm.confirm_password) {
      if (accessForm.password.length < 6) {
        notify("error", "A nova senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (accessForm.password !== accessForm.confirm_password) {
        notify("error", "A confirmação da senha não confere.");
        return;
      }
    }
    const created = new Date().toISOString();
    const user: User = { id: accessForm.user_id || id("usr"), company_id: accessForm.company_id, name: accessForm.name || "Admin", email: accessForm.email.trim(), password: accessForm.password || primaryUser(accessForm.company_id)?.password || "", role: accessForm.role, is_active: accessForm.is_active, created_at: primaryUser(accessForm.company_id)?.created_at || created };
    setDbState((current) => ({ ...current, users: accessForm.user_id ? current.users.map((item) => item.id === accessForm.user_id && item.company_id === accessForm.company_id ? user : item) : [user, ...current.users] }));
    setAccessOpen(false);
    notify("success", "Acesso da lancheria atualizado com sucesso.");
  }

  function saveCompany(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.slug || !form.whatsapp || !form.address || !form.plan_id || !form.primary_color) {
      notify("error", "Preencha nome, slug, WhatsApp, endereço, plano e cor principal.");
      return;
    }
    if (!isValidSlug(form.slug)) {
      notify("error", "Use um slug simples, com letras minúsculas, números e hífen. Exemplo: pizzariadojoao.");
      return;
    }
    if (!positiveNumber(form.monthly_price)) {
      notify("error", "Informe um valor mensal válido.");
      return;
    }
    if (!form.id && form.admin_email && form.admin_password.length < 6) {
      notify("error", "Informe uma senha inicial com pelo menos 6 caracteres para o admin da lancheria.");
      return;
    }
    const plan = selectedPlan();
    const created = new Date().toISOString();
    const companyId = form.id || id("cmp");
    const previous = db.companies.find((item) => item.id === form.id);
    const company: Company = {
      id: companyId,
      name: form.name,
      slug: form.slug,
      logo_url: previous?.logo_url || "",
      banner_url: previous?.banner_url || previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80",
      whatsapp: form.whatsapp,
      address: form.address,
      hero_image: previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80",
      primary_color: form.primary_color,
      minimum_order: previous?.minimum_order || 25,
      estimated_delivery_time: previous?.estimated_delivery_time || "35-45 min",
      is_open: previous?.is_open ?? true,
      delivery_enabled: previous?.delivery_enabled ?? true,
      pickup_enabled: previous?.pickup_enabled ?? true,
      status: form.status,
      plan: plan?.name || "Start",
      is_registration_enabled: form.is_registration_enabled,
      plan_id: form.plan_id,
      subscription_status: form.subscription_status,
      monthly_price: parseMoney(form.monthly_price),
      due_day: Number(form.due_day),
      next_due_date: form.next_due_date,
      last_payment_date: previous?.last_payment_date || "",
      payment_notes: form.payment_notes,
      assistant_enabled: previous?.assistant_enabled ?? false,
      assistant_status: previous?.assistant_status || "inactive",
      assistant_trial_until: previous?.assistant_trial_until || "",
      assistant_notes: previous?.assistant_notes || "",
      assistant_plan: previous?.assistant_plan || "mvp",
      footer_message: previous?.footer_message || "produzido por Startt Facilities",
      opening_hours: previous?.opening_hours || "Aberto hoje",
      created_at: previous?.created_at || created,
      updated_at: created,
    };
    setDbState((current) => ({
      ...current,
      companies: form.id ? current.companies.map((item) => item.id === form.id ? company : item) : [company, ...current.companies],
      settings: form.id ? current.settings : [{ id: id("set"), company_id: companyId, critical_locked: false, pix_enabled: false, pix_key: "" }, ...current.settings],
      print_settings: form.id ? current.print_settings : [{ company_id: companyId, auto_print_orders: false, auto_print_cash_sales: false, printer_name: "", qz_tray_enabled: false, qz_printer_name: "", paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" }, ...current.print_settings],
      users: !form.id && form.admin_email ? [{ id: id("usr"), company_id: companyId, name: "Admin inicial", email: form.admin_email, password: form.admin_password, role: "dono", is_active: true, created_at: created }, ...current.users] : current.users,
    }));
    setFormOpen(false);
    notify("success", form.id ? "Empresa atualizada com sucesso." : "Empresa criada com sucesso.");
  }

  function updateCompany(companyId: string, patch: Partial<Company>) {
    setDbState((current) => ({ ...current, companies: current.companies.map((company) => company.id === companyId ? { ...company, ...patch, updated_at: new Date().toISOString() } : company) }));
    notify("success", "Empresa atualizada.");
  }

  async function deleteCompany(company: Company) {
    if (!confirm(`Excluir ${company.name} e TODOS os dados vinculados?`)) return;
    try {
      await deleteCompanyCascade(company.id);
      setDbState((current) => ({ ...current, companies: current.companies.filter((item) => item.id !== company.id), users: current.users.filter((item) => item.company_id !== company.id), categories: current.categories.filter((item) => item.company_id !== company.id), products: current.products.filter((item) => item.company_id !== company.id), orders: current.orders.filter((item) => item.company_id !== company.id), order_items: current.order_items.filter((item) => item.company_id !== company.id), customers: current.customers.filter((item) => item.company_id !== company.id), voucher_brands: current.voucher_brands.filter((item) => item.company_id !== company.id), delivery_zones: current.delivery_zones.filter((item) => item.company_id !== company.id), coupons: current.coupons.filter((item) => item.company_id !== company.id), settings: current.settings.filter((item) => item.company_id !== company.id), cash_sales: current.cash_sales.filter((item) => item.company_id !== company.id), print_settings: current.print_settings.filter((item) => item.company_id !== company.id), reports: current.reports.filter((item) => item.company_id !== company.id), inventory_items: current.inventory_items.filter((item) => item.company_id !== company.id) }));
      notify("success", "Empresa e dados vinculados foram excluídos.");
    } catch (error) {
      const message = readableError(error);
      console.error("Falha ao excluir empresa no Supabase.", { companyId: company.id, companyName: company.name, error });
      notify("error", `Empresa não foi excluída: ${message}`);
    }
  }

  return (
    <CrudShell title="Empresas" description="CRUD completo, controle de acesso, financeiro e Assistente Startt por empresa. O mesmo login da lancheria no Delivery libera o app desktop quando o Assistente estiver ativo.">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={startCreate} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Nova empresa</button>
      </div>

      <FormDrawer open={formOpen} title={form.id ? "Editar empresa" : "Nova empresa"} description="Controle dados comerciais, plano, assinatura e usuário inicial da lancheria." onClose={() => setFormOpen(false)}>
        <form onSubmit={saveCompany} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><HelpText>Nome que aparece no cardápio e no painel da loja.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} /><HelpText>Link público. Ex: starttdelivery.com.br/nomedaloja</HelpText></label>
            <label className="grid gap-1"><Input placeholder="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} /><HelpText>Número que recebe pedidos e contatos.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><HelpText>Endereço exibido no cardápio público.</HelpText></label>
            <label className="grid gap-1"><Select value={form.status} onChange={(value) => setForm({ ...form, status: value as CompanyStatus })}><option>trial</option><option>active</option><option>blocked</option><option>canceled</option></Select><HelpText>Bloqueado impede acesso e cancelado suspende a loja.</HelpText></label>
            <label className="grid gap-1"><Select value={form.plan_id} onChange={(value) => { const plan = selectedPlan(value); setForm({ ...form, plan_id: value, monthly_price: String(plan?.monthly_price || form.monthly_price) }); }}>{db.plans.filter((plan) => plan.is_active || plan.id === form.plan_id).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select><HelpText>Plano define limites de produtos, usuários, cupons, relatórios e impressão.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Cor principal" value={form.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} /><HelpText>Cor da identidade da lancheria no cardápio.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Valor mensal" value={form.monthly_price} onChange={(value) => setForm({ ...form, monthly_price: value })} /><HelpText>Mensalidade usada no controle financeiro do SaaS.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Dia vencimento" value={form.due_day} onChange={(value) => setForm({ ...form, due_day: value })} /><HelpText>Dia do mês para acompanhar cobranças.</HelpText></label>
            <label className="grid gap-1"><Input type="date" placeholder="Próxima data" value={form.next_due_date} onChange={(value) => setForm({ ...form, next_due_date: value })} /><HelpText>Próximo vencimento da assinatura.</HelpText></label>
            <label className="grid gap-1"><Select value={form.subscription_status} onChange={(value) => setForm({ ...form, subscription_status: value as SubscriptionStatus })}><option>trialing</option><option>active</option><option>overdue</option><option>canceled</option></Select><HelpText>Status financeiro usado no painel master.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Admin inicial opcional" value={form.admin_email} onChange={(value) => setForm({ ...form, admin_email: value })} /><HelpText>E-mail do primeiro acesso da lancheria. Também será o login do Startt Assistente se a empresa estiver liberada.</HelpText></label>
            <label className="grid gap-1"><Input placeholder="Senha inicial do admin" type="password" value={form.admin_password} onChange={(value) => setForm({ ...form, admin_password: value })} /><HelpText>Senha temporária para o primeiro login.</HelpText></label>
          </div>
          <label className="grid gap-1"><Input placeholder="Observações financeiras" value={form.payment_notes} onChange={(value) => setForm({ ...form, payment_notes: value })} /><HelpText>Anotações internas sobre pagamento, negociação ou bloqueio.</HelpText></label>
          <label className="flex items-center gap-2 rounded-2xl bg-startt-paper p-4 font-bold"><input type="checkbox" checked={form.is_registration_enabled} onChange={(event) => setForm({ ...form, is_registration_enabled: event.target.checked })} /> Cadastro/acesso habilitado</label>
          <button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20">{form.id ? "Salvar alterações" : "Criar empresa"}</button>
        </form>
      </FormDrawer>

      <FormDrawer open={accessOpen} title="Gerenciar acesso" description="Edite o login e resete a senha da lancheria sem perder o vínculo com a empresa." onClose={() => setAccessOpen(false)}>
        <form onSubmit={saveAccess} className="grid gap-4">
          <Input placeholder="Nome do usuário" value={accessForm.name} onChange={(value) => setAccessForm({ ...accessForm, name: value })} />
          <Input placeholder="Login/e-mail" value={accessForm.email} onChange={(value) => setAccessForm({ ...accessForm, email: value })} />
          <HelpText>Este login acessa a empresa vinculada no Delivery e no Startt Assistente, quando a lancheria estiver liberada.</HelpText>
          <Select value={accessForm.role} onChange={(value) => setAccessForm({ ...accessForm, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select>
          <div className="grid gap-2">
            <label className="text-sm font-bold">Nova senha</label>
            <div className="flex min-h-12 overflow-hidden rounded-xl border border-startt-border bg-white shadow-sm focus-within:border-startt-green focus-within:shadow-input">
              <input className="min-w-0 flex-1 px-3 text-sm outline-none" type={showAccessPassword ? "text" : "password"} placeholder="Deixe vazio para manter" value={accessForm.password} onChange={(event) => setAccessForm({ ...accessForm, password: event.target.value })} />
              <button type="button" className="grid w-12 place-items-center text-startt-muted" onClick={() => setShowAccessPassword((value) => !value)}>{showAccessPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <input className="min-h-12 rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" type={showAccessPassword ? "text" : "password"} placeholder="Confirmar nova senha" value={accessForm.confirm_password} onChange={(event) => setAccessForm({ ...accessForm, confirm_password: event.target.value })} />
          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-startt-paper px-4 font-bold"><input type="checkbox" checked={accessForm.is_active} onChange={(event) => setAccessForm({ ...accessForm, is_active: event.target.checked })} /> Usuário ativo</label>
          <button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Salvar acesso</button>
        </form>
      </FormDrawer>

      <FormDrawer open={assistantOpen} title="Assistente Startt" description="Libere, bloqueie ou acompanhe o Assistente da lancheria pelo master." onClose={() => setAssistantOpen(false)}>
        <form onSubmit={saveAssistant} className="grid gap-4">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-startt-paper px-4 font-bold"><input type="checkbox" checked={assistantForm.assistant_enabled} onChange={(event) => setAssistantForm({ ...assistantForm, assistant_enabled: event.target.checked })} /> Assistente Startt ativo para esta lancheria</label>
          <HelpText>Quando ativo, usuários vinculados a esta empresa podem entrar no app desktop com o mesmo e-mail e senha do Startt Delivery.</HelpText>
          <label className="grid gap-1"><Select value={assistantForm.assistant_status} onChange={(value) => setAssistantForm({ ...assistantForm, assistant_status: value as AssistantStatus })}><option value="inactive">inactive</option><option value="active">active</option><option value="trial">trial</option><option value="blocked">blocked</option></Select><HelpText>Status active libera o uso. Trial libera durante o teste. Blocked e inactive bloqueiam o app desktop.</HelpText></label>
          <label className="grid gap-1"><Input placeholder="Plano do assistente" value={assistantForm.assistant_plan} onChange={(value) => setAssistantForm({ ...assistantForm, assistant_plan: value })} /><HelpText>Exemplo: mvp, basico, pro ou o nome comercial combinado com a lancheria.</HelpText></label>
          <label className="grid gap-1"><Input type="date" placeholder="Fim do teste" value={assistantForm.assistant_trial_until} onChange={(value) => setAssistantForm({ ...assistantForm, assistant_trial_until: value })} /><HelpText>Data final do período de teste. Pode ficar em branco quando não houver trial.</HelpText></label>
          <label className="grid gap-1"><textarea className="min-h-28 rounded-xl border border-startt-border bg-white px-3 py-3 text-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" placeholder="Observação interna do Assistente" value={assistantForm.assistant_notes} onChange={(event) => setAssistantForm({ ...assistantForm, assistant_notes: event.target.value })} /><HelpText>Use para registrar cobrança, suporte, teste liberado, bloqueio ou histórico comercial.</HelpText></label>
          <button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Salvar Assistente</button>
        </form>
      </FormDrawer>

      <div className="grid gap-4">
        <div className="grid gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-card lg:grid-cols-4">
          <HelpText>Gerenciar acesso: cria ou altera o login único da lancheria para Delivery e Assistente.</HelpText>
          <HelpText>Assistente: controla se a lancheria pode usar o Startt Assistente no Windows.</HelpText>
          <HelpText>Status financeiro: indica se a assinatura está ativa, em teste, inadimplente ou cancelada.</HelpText>
          <HelpText>Plano: define assinatura, valor mensal e recursos liberados.</HelpText>
        </div>

        {db.companies.length ? db.companies.map((company) => {
          const planName = db.plans.find((plan) => plan.id === company.plan_id)?.name || company.plan;
          const assistantActive = company.assistant_enabled && ["active", "trial"].includes(company.assistant_status || "");
          const companyBadge = company.status === "active" ? "bg-emerald-100 text-emerald-800" : company.status === "trial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
          const financeBadge = company.subscription_status === "active" ? "bg-emerald-100 text-emerald-800" : company.subscription_status === "trialing" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
          const assistantBadge = assistantActive ? "bg-startt-green text-white" : company.assistant_status === "blocked" ? "bg-startt-red text-white" : "bg-startt-paper text-startt-muted";

          return (
            <article key={company.id} className="grid gap-4 rounded-3xl border border-black/10 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-xl md:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.15fr)_minmax(0,1.2fr)_auto] lg:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  {company.logo_url ? <img className="h-14 w-14 rounded-2xl object-cover shadow-sm" src={companyLogoUrl(company)} alt={company.name} /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-startt-green font-black text-white shadow-sm">S</span>}
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-startt-ink">{company.name}</h2>
                    <a className="mt-1 block truncate text-sm font-bold text-startt-green" href={`/${company.slug}`} target="_blank" rel="noreferrer">starttdelivery.com.br/{company.slug}</a>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${companyBadge}`}>{company.status}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${assistantBadge}`}>Assistente {company.assistant_enabled ? company.assistant_status || "active" : "inactive"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-startt-soft p-3"><span className="text-[11px] font-black uppercase text-startt-muted">Plano</span><strong className="mt-1 block text-sm">{planName}</strong></div>
                  <div className="rounded-2xl bg-startt-soft p-3"><span className="text-[11px] font-black uppercase text-startt-muted">Mensal</span><strong className="mt-1 block text-sm">{money(company.monthly_price)}</strong></div>
                  <div className="rounded-2xl bg-startt-soft p-3"><span className="text-[11px] font-black uppercase text-startt-muted">Vencimento</span><strong className="mt-1 block text-sm">Dia {company.due_day}</strong></div>
                  <div className="rounded-2xl bg-startt-soft p-3"><span className="text-[11px] font-black uppercase text-startt-muted">Financeiro</span><strong className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs ${financeBadge}`}>{company.subscription_status}</strong></div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button className="min-h-11 rounded-xl bg-startt-green px-3 font-black text-white" onClick={() => startEdit(company)}>Editar</button>
                  <button className="min-h-11 rounded-xl border border-startt-border bg-white px-3 font-black" onClick={() => openAccess(company)}>Acesso</button>
                  <button className="min-h-11 rounded-xl border border-startt-border bg-white px-3 font-black" onClick={() => openAssistant(company)}>Assistente</button>
                  <details className="relative">
                    <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-xl border border-startt-border bg-white px-3 font-black">...</summary>
                    <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-2xl border border-black/10 bg-white p-2 shadow-drawer">
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { status: company.status === "blocked" ? "active" : "blocked" })}>{company.status === "blocked" ? "Desbloquear empresa" : "Bloquear empresa"}</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { assistant_enabled: true, assistant_status: "active", assistant_notes: "Assistente liberado pelo Master." })}>Liberar assistente</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { assistant_enabled: false, assistant_status: "blocked", assistant_notes: "Assistente bloqueado pelo Master." })}>Bloquear assistente</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { subscription_status: "active", status: company.status === "blocked" ? "active" : company.status, last_payment_date: todayInput(), payment_notes: "Marcado como pago pelo Master." })}>Marcar pago</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { subscription_status: "overdue", payment_notes: "Marcado como inadimplente pelo Master." })}>Inadimplente</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { status: "canceled", subscription_status: "canceled" })}>Cancelar</button>
                      <button className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" onClick={() => updateCompany(company.id, { status: "active", subscription_status: "active" })}>Reativar</button>
                      <a className="rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-startt-soft" href={`/${company.slug}/admin`}>Simular painel</a>
                      <button className="rounded-xl bg-startt-red px-3 py-2 text-left text-sm font-black text-white" onClick={() => deleteCompany(company)}>Excluir empresa</button>
                    </div>
                  </details>
                </div>
              </div>
            </article>
          );
        }) : <div className="rounded-3xl border border-black/10 bg-white p-8 text-center text-startt-muted shadow-card">Nenhuma empresa cadastrada ainda.</div>}
      </div>
    </CrudShell>
  );
}

function LegacyMasterCompanies({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const firstPlan = db.plans.find((plan) => plan.is_active) || db.plans[0];
  const emptyForm = { id: "", name: "", slug: "", whatsapp: "", address: "", status: "trial" as CompanyStatus, plan_id: firstPlan?.id || "", primary_color: "#116a4b", monthly_price: String(firstPlan?.monthly_price || 49.9), due_day: "10", next_due_date: todayInput(), subscription_status: "trialing" as SubscriptionStatus, is_registration_enabled: true, admin_email: "", admin_password: "", payment_notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessForm, setAccessForm] = useState({ company_id: "", user_id: "", name: "", email: "", password: "", confirm_password: "", role: "dono" as UserRole, is_active: true });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantForm, setAssistantForm] = useState({ company_id: "", assistant_enabled: false, assistant_status: "inactive" as AssistantStatus, assistant_plan: "mvp", assistant_trial_until: "", assistant_notes: "" });
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  function selectedPlan(planId = form.plan_id) { return db.plans.find((plan) => plan.id === planId) || firstPlan; }
  function primaryUser(companyId: string) { return db.users.find((user) => user.company_id === companyId && user.role === "dono") || db.users.find((user) => user.company_id === companyId); }
  function startCreate() { setForm(emptyForm); setFormOpen(true); }
  function startEdit(company: Company) { setForm({ id: company.id, name: company.name, slug: company.slug, whatsapp: company.whatsapp, address: company.address, status: company.status, plan_id: company.plan_id, primary_color: company.primary_color, monthly_price: String(company.monthly_price), due_day: String(company.due_day), next_due_date: company.next_due_date, subscription_status: company.subscription_status, is_registration_enabled: company.is_registration_enabled, admin_email: "", admin_password: "", payment_notes: company.payment_notes }); setFormOpen(true); }
  function openAccess(company: Company) {
    const user = primaryUser(company.id);
    setAccessForm({ company_id: company.id, user_id: user?.id || "", name: user?.name || "Admin", email: user?.email || "", password: "", confirm_password: "", role: user?.role || "dono", is_active: user?.is_active ?? true });
    setShowAccessPassword(false);
    setAccessOpen(true);
  }
  function openAssistant(company: Company) {
    setAssistantForm({
      company_id: company.id,
      assistant_enabled: company.assistant_enabled ?? false,
      assistant_status: company.assistant_status || "inactive",
      assistant_plan: company.assistant_plan || "mvp",
      assistant_trial_until: company.assistant_trial_until?.slice(0, 10) || "",
      assistant_notes: company.assistant_notes || "",
    });
    setAssistantOpen(true);
  }
  function saveAssistant(event: React.FormEvent) {
    event.preventDefault();
    const trialUntil = assistantForm.assistant_trial_until ? `${assistantForm.assistant_trial_until}T23:59:59.000Z` : "";
    setDbState((current) => ({
      ...current,
      companies: current.companies.map((company) => company.id === assistantForm.company_id ? {
        ...company,
        assistant_enabled: assistantForm.assistant_enabled,
        assistant_status: assistantForm.assistant_status,
        assistant_plan: assistantForm.assistant_plan,
        assistant_trial_until: trialUntil,
        assistant_notes: assistantForm.assistant_notes,
        updated_at: new Date().toISOString(),
      } : company),
    }));
    setAssistantOpen(false);
    notify("success", "Configuração do Assistente Startt atualizada.");
  }
  function saveAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!accessForm.email.trim()) {
      notify("error", "Informe o login/e-mail da lancheria.");
      return;
    }
    if (!accessForm.user_id && !accessForm.password) {
      notify("error", "Defina uma senha inicial para a lancheria.");
      return;
    }
    if (accessForm.password || accessForm.confirm_password) {
      if (accessForm.password.length < 6) {
        notify("error", "A nova senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (accessForm.password !== accessForm.confirm_password) {
        notify("error", "A confirmação da senha não confere.");
        return;
      }
    }
    const created = new Date().toISOString();
    const user: User = { id: accessForm.user_id || id("usr"), company_id: accessForm.company_id, name: accessForm.name || "Admin", email: accessForm.email.trim(), password: accessForm.password || primaryUser(accessForm.company_id)?.password || "", role: accessForm.role, is_active: accessForm.is_active, created_at: primaryUser(accessForm.company_id)?.created_at || created };
    setDbState((current) => ({ ...current, users: accessForm.user_id ? current.users.map((item) => item.id === accessForm.user_id && item.company_id === accessForm.company_id ? user : item) : [user, ...current.users] }));
    setAccessOpen(false);
    notify("success", "Acesso da lancheria atualizado com sucesso.");
  }
  function saveCompany(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.slug || !form.whatsapp || !form.address || !form.plan_id || !form.primary_color) {
      notify("error", "Preencha nome, slug, WhatsApp, endereço, plano e cor principal.");
      return;
    }
    if (!isValidSlug(form.slug)) {
      notify("error", "Use um slug simples, com letras minúsculas, números e hífen. Exemplo: pizzariadojoao.");
      return;
    }
    if (!positiveNumber(form.monthly_price)) {
      notify("error", "Informe um valor mensal válido.");
      return;
    }
    if (!form.id && form.admin_email && form.admin_password.length < 6) {
      notify("error", "Informe uma senha inicial com pelo menos 6 caracteres para o admin da lancheria.");
      return;
    }
    const plan = selectedPlan();
    const created = new Date().toISOString();
    const companyId = form.id || id("cmp");
    const previous = db.companies.find((item) => item.id === form.id);
    const company: Company = { id: companyId, name: form.name, slug: form.slug, logo_url: previous?.logo_url || "", banner_url: previous?.banner_url || previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80", whatsapp: form.whatsapp, address: form.address, hero_image: previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80", primary_color: form.primary_color, minimum_order: previous?.minimum_order || 25, estimated_delivery_time: previous?.estimated_delivery_time || "35-45 min", is_open: previous?.is_open ?? true, delivery_enabled: previous?.delivery_enabled ?? true, pickup_enabled: previous?.pickup_enabled ?? true, status: form.status, plan: plan?.name || "Start", is_registration_enabled: form.is_registration_enabled, plan_id: form.plan_id, subscription_status: form.subscription_status, monthly_price: parseMoney(form.monthly_price), due_day: Number(form.due_day), next_due_date: form.next_due_date, last_payment_date: previous?.last_payment_date || "", payment_notes: form.payment_notes, assistant_enabled: previous?.assistant_enabled ?? false, assistant_status: previous?.assistant_status || "inactive", assistant_trial_until: previous?.assistant_trial_until || "", assistant_notes: previous?.assistant_notes || "", assistant_plan: previous?.assistant_plan || "mvp", footer_message: previous?.footer_message || "produzido por Startt Facilities", opening_hours: previous?.opening_hours || "Aberto hoje", created_at: previous?.created_at || created, updated_at: created };
    setDbState((current) => ({ ...current, companies: form.id ? current.companies.map((item) => item.id === form.id ? company : item) : [company, ...current.companies], settings: form.id ? current.settings : [{ id: id("set"), company_id: companyId, critical_locked: false, pix_enabled: false, pix_key: "" }, ...current.settings], print_settings: form.id ? current.print_settings : [{ company_id: companyId, auto_print_orders: false, auto_print_cash_sales: false, printer_name: "", qz_tray_enabled: false, qz_printer_name: "", paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" }, ...current.print_settings], users: !form.id && form.admin_email ? [{ id: id("usr"), company_id: companyId, name: "Admin inicial", email: form.admin_email, password: form.admin_password, role: "dono", is_active: true, created_at: created }, ...current.users] : current.users }));
    setFormOpen(false);
    notify("success", form.id ? "Empresa atualizada com sucesso." : "Empresa criada com sucesso.");
  }
  function updateCompany(companyId: string, patch: Partial<Company>) { setDbState((current) => ({ ...current, companies: current.companies.map((company) => company.id === companyId ? { ...company, ...patch } : company) })); notify("success", "Empresa atualizada."); }
  function deleteCompany(company: Company) { if (!confirm(`Excluir ${company.name} e TODOS os dados vinculados?`)) return; setDbState((current) => ({ ...current, companies: current.companies.filter((item) => item.id !== company.id), users: current.users.filter((item) => item.company_id !== company.id), categories: current.categories.filter((item) => item.company_id !== company.id), products: current.products.filter((item) => item.company_id !== company.id), orders: current.orders.filter((item) => item.company_id !== company.id), order_items: current.order_items.filter((item) => item.company_id !== company.id), customers: current.customers.filter((item) => item.company_id !== company.id), voucher_brands: current.voucher_brands.filter((item) => item.company_id !== company.id), delivery_zones: current.delivery_zones.filter((item) => item.company_id !== company.id), coupons: current.coupons.filter((item) => item.company_id !== company.id), settings: current.settings.filter((item) => item.company_id !== company.id), cash_sales: current.cash_sales.filter((item) => item.company_id !== company.id), print_settings: current.print_settings.filter((item) => item.company_id !== company.id), reports: current.reports.filter((item) => item.company_id !== company.id), inventory_items: current.inventory_items.filter((item) => item.company_id !== company.id) })); notify("success", "Empresa e dados vinculados foram excluídos."); }
  return <CrudShell title="Empresas" description="CRUD completo, controle de acesso e financeiro por empresa. Use o slug para definir o link público e o plano para liberar recursos."><div className="flex flex-wrap justify-end gap-2"><button onClick={startCreate} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Nova empresa</button></div><FormDrawer open={formOpen} title={form.id ? "Editar empresa" : "Nova empresa"} description="Controle dados comerciais, plano, assinatura e usuário inicial da lancheria." onClose={() => setFormOpen(false)}><form onSubmit={saveCompany} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><HelpText>Nome que aparece no cardápio e no painel da loja.</HelpText></label><label className="grid gap-1"><Input placeholder="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} /><HelpText>Link público. Ex: starttdelivery.com.br/nomedaloja</HelpText></label><label className="grid gap-1"><Input placeholder="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} /><HelpText>Número que recebe pedidos e contatos.</HelpText></label><label className="grid gap-1"><Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><HelpText>Endereço exibido no cardápio público.</HelpText></label><label className="grid gap-1"><Select value={form.status} onChange={(value) => setForm({ ...form, status: value as CompanyStatus })}><option>trial</option><option>active</option><option>blocked</option><option>canceled</option></Select><HelpText>Bloqueado impede acesso e cancelado suspende a loja.</HelpText></label><label className="grid gap-1"><Select value={form.plan_id} onChange={(value) => { const plan = selectedPlan(value); setForm({ ...form, plan_id: value, monthly_price: String(plan?.monthly_price || form.monthly_price) }); }}>{db.plans.filter((plan) => plan.is_active || plan.id === form.plan_id).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select><HelpText>Plano define limites de produtos, usuários, cupons, relatórios e impressão.</HelpText></label><label className="grid gap-1"><Input placeholder="Cor principal" value={form.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} /><HelpText>Cor da identidade da lancheria no cardápio.</HelpText></label><label className="grid gap-1"><Input placeholder="Valor mensal" value={form.monthly_price} onChange={(value) => setForm({ ...form, monthly_price: value })} /><HelpText>Mensalidade usada no controle financeiro do SaaS.</HelpText></label><label className="grid gap-1"><Input placeholder="Dia vencimento" value={form.due_day} onChange={(value) => setForm({ ...form, due_day: value })} /><HelpText>Dia do mês para acompanhar cobranças.</HelpText></label><label className="grid gap-1"><Input type="date" placeholder="Próxima data" value={form.next_due_date} onChange={(value) => setForm({ ...form, next_due_date: value })} /><HelpText>Próximo vencimento da assinatura.</HelpText></label><label className="grid gap-1"><Select value={form.subscription_status} onChange={(value) => setForm({ ...form, subscription_status: value as SubscriptionStatus })}><option>trialing</option><option>active</option><option>overdue</option><option>canceled</option></Select><HelpText>Status financeiro usado no painel master.</HelpText></label><label className="grid gap-1"><Input placeholder="Admin inicial opcional" value={form.admin_email} onChange={(value) => setForm({ ...form, admin_email: value })} /><HelpText>E-mail do primeiro acesso da lancheria.</HelpText></label><label className="grid gap-1"><Input placeholder="Senha inicial do admin" type="password" value={form.admin_password} onChange={(value) => setForm({ ...form, admin_password: value })} /><HelpText>Senha temporária para o primeiro login.</HelpText></label></div><label className="grid gap-1"><Input placeholder="Observações financeiras" value={form.payment_notes} onChange={(value) => setForm({ ...form, payment_notes: value })} /><HelpText>Anotações internas sobre pagamento, negociação ou bloqueio.</HelpText></label><label className="flex items-center gap-2 rounded-2xl bg-startt-paper p-4 font-bold"><input type="checkbox" checked={form.is_registration_enabled} onChange={(event) => setForm({ ...form, is_registration_enabled: event.target.checked })} /> Cadastro/acesso habilitado</label><button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20">{form.id ? "Salvar alterações" : "Criar empresa"}</button></form></FormDrawer><FormDrawer open={accessOpen} title="Gerenciar acesso" description="Edite o login e resete a senha da lancheria sem perder o vínculo com a empresa." onClose={() => setAccessOpen(false)}><form onSubmit={saveAccess} className="grid gap-4"><Input placeholder="Nome do usuário" value={accessForm.name} onChange={(value) => setAccessForm({ ...accessForm, name: value })} /><Input placeholder="Login/e-mail" value={accessForm.email} onChange={(value) => setAccessForm({ ...accessForm, email: value })} /><HelpText>Este login só acessa a empresa vinculada a ele.</HelpText><Select value={accessForm.role} onChange={(value) => setAccessForm({ ...accessForm, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><div className="grid gap-2"><label className="text-sm font-bold">Nova senha</label><div className="flex min-h-12 overflow-hidden rounded-xl border border-startt-border bg-white shadow-sm focus-within:border-startt-green focus-within:shadow-input"><input className="min-w-0 flex-1 px-3 text-sm outline-none" type={showAccessPassword ? "text" : "password"} placeholder="Deixe vazio para manter" value={accessForm.password} onChange={(event) => setAccessForm({ ...accessForm, password: event.target.value })} /><button type="button" className="grid w-12 place-items-center text-startt-muted" onClick={() => setShowAccessPassword((value) => !value)}>{showAccessPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div><input className="min-h-12 rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" type={showAccessPassword ? "text" : "password"} placeholder="Confirmar nova senha" value={accessForm.confirm_password} onChange={(event) => setAccessForm({ ...accessForm, confirm_password: event.target.value })} /><label className="flex min-h-12 items-center gap-2 rounded-2xl bg-startt-paper px-4 font-bold"><input type="checkbox" checked={accessForm.is_active} onChange={(event) => setAccessForm({ ...accessForm, is_active: event.target.checked })} /> Usuário ativo</label><button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Salvar acesso</button></form></FormDrawer><Table headers={["Empresa", "Slug", "Plano", "Assinatura", "Mensal", "Vencimento", "Ações"]} rows={db.companies.map((company) => [<div key={company.id} className="flex items-center gap-3">{company.logo_url ? <img className="h-10 w-10 rounded-xl object-cover" src={companyLogoUrl(company)} alt={company.name} /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-startt-green font-black text-white">S</span>}<span className="font-black">{company.name}</span></div>, `/${company.slug}`, db.plans.find((plan) => plan.id === company.plan_id)?.name || company.plan, company.subscription_status, money(company.monthly_price), `${company.due_day} • ${company.next_due_date}`, <div key={company.id} className="flex flex-wrap gap-2"><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => startEdit(company)}>Editar</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => openAccess(company)}>Gerenciar acesso</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: company.status === "blocked" ? "active" : "blocked" })}>{company.status === "blocked" ? "Desbloquear" : "Bloquear"}</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { subscription_status: "active", status: company.status === "blocked" ? "active" : company.status, last_payment_date: todayInput(), payment_notes: "Marcado como pago pelo Master." })}>Marcar pago</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { subscription_status: "overdue", payment_notes: "Marcado como inadimplente pelo Master." })}>Inadimplente</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: "canceled", subscription_status: "canceled" })}>Cancelar</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: "active", subscription_status: "active" })}>Reativar</button><a className="rounded-xl border px-3 py-2 font-bold" href={`/${company.slug}/admin`}>Simular</a><button className="rounded-xl bg-startt-red px-3 py-2 font-bold text-white" onClick={() => deleteCompany(company)}>Excluir</button></div>])} /></CrudShell>;
}

function MasterUsers({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [companyId, setCompanyId] = useState("todos");
  const [form, setForm] = useState({ company_id: db.companies[0]?.id || "", name: "", email: "", password: "", role: "dono" as UserRole });
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetForm, setResetForm] = useState({ email: "", password: "", confirm_password: "", role: "dono" as UserRole, is_active: true });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const users = db.users.filter((user) => companyId === "todos" || user.company_id === companyId);
  function addUser() { if (!form.email || !form.company_id || form.password.length < 6) { notify("error", "Informe empresa, e-mail e senha com pelo menos 6 caracteres."); return; } setDbState((current) => ({ ...current, users: [{ id: id("usr"), company_id: form.company_id, name: form.name || "Admin", email: form.email, password: form.password, role: form.role, is_active: true, created_at: new Date().toISOString() }, ...current.users] })); setForm({ ...form, name: "", email: "", password: "" }); notify("success", "Usuário criado com sucesso."); }
  function openReset(user: User) { setResetUser(user); setResetForm({ email: user.email, password: "", confirm_password: "", role: user.role, is_active: user.is_active }); setShowResetPassword(false); }
  function saveReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    if (!resetForm.email.trim()) { notify("error", "Informe o login/e-mail."); return; }
    if (resetForm.password || resetForm.confirm_password) {
      if (resetForm.password.length < 6) { notify("error", "A nova senha precisa ter pelo menos 6 caracteres."); return; }
      if (resetForm.password !== resetForm.confirm_password) { notify("error", "A confirmação da senha não confere."); return; }
    }
    setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === resetUser.id ? { ...item, email: resetForm.email.trim(), password: resetForm.password || item.password, role: resetForm.role, is_active: resetForm.is_active } : item) }));
    setResetUser(null);
    notify("success", "Login/senha da lancheria atualizados.");
  }
  return <CrudShell title="Usuários" description="Usuários de todas as empresas, com filtro, criação, bloqueio e redefinição de senha."><div className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-6"><Select value={form.company_id} onChange={(value) => setForm({ ...form, company_id: value })}>{db.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="E-mail" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input placeholder="Senha" value={form.password} onChange={(value) => setForm({ ...form, password: value })} /><Select value={form.role} onChange={(value) => setForm({ ...form, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><button onClick={addUser} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Criar usuário</button></div><Select value={companyId} onChange={setCompanyId}><option value="todos">Todas as empresas</option>{db.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select><FormDrawer open={Boolean(resetUser)} title="Editar login e senha" description={resetUser ? `Empresa: ${db.companies.find((company) => company.id === resetUser.company_id)?.name || "-"}` : "Acesso da lancheria"} onClose={() => setResetUser(null)}><form onSubmit={saveReset} className="grid gap-4"><Input placeholder="Login/e-mail" value={resetForm.email} onChange={(value) => setResetForm({ ...resetForm, email: value })} /><Select value={resetForm.role} onChange={(value) => setResetForm({ ...resetForm, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><div className="flex min-h-12 overflow-hidden rounded-xl border border-startt-border bg-white shadow-sm"><input className="min-w-0 flex-1 px-3 text-sm outline-none" type={showResetPassword ? "text" : "password"} placeholder="Nova senha" value={resetForm.password} onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })} /><button type="button" className="grid w-12 place-items-center text-startt-muted" onClick={() => setShowResetPassword((value) => !value)}>{showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><input className="min-h-12 rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" type={showResetPassword ? "text" : "password"} placeholder="Confirmar nova senha" value={resetForm.confirm_password} onChange={(event) => setResetForm({ ...resetForm, confirm_password: event.target.value })} /><label className="flex min-h-12 items-center gap-2 rounded-2xl bg-startt-paper px-4 font-bold"><input type="checkbox" checked={resetForm.is_active} onChange={(event) => setResetForm({ ...resetForm, is_active: event.target.checked })} /> Usuário ativo</label><button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">Salvar acesso</button></form></FormDrawer><Table headers={["Nome", "E-mail", "Empresa", "Função", "Status", "Ações"]} rows={users.map((user) => [user.name, user.email, db.companies.find((c) => c.id === user.company_id)?.name || "-", user.role, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, is_active: !item.is_active } : item) }))}>Ativar/bloquear</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => openReset(user)}>Editar login/senha</button></div>])} /></CrudShell>;
}

function MasterPlans({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", monthly_price: "", max_products: "30", max_users: "3", allow_reports: false, allow_printing: false, allow_coupons: false, is_active: true };
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  function create() { setForm(blank); setFormOpen(true); }
  function edit(plan: Plan) { setForm({ id: plan.id, name: plan.name, monthly_price: String(plan.monthly_price), max_products: String(plan.max_products), max_users: String(plan.max_users), allow_reports: plan.allow_reports, allow_printing: plan.allow_printing, allow_coupons: plan.allow_coupons, is_active: plan.is_active }); setFormOpen(true); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !positiveNumber(form.monthly_price) || !positiveNumber(form.max_products) || !positiveNumber(form.max_users)) {
      notify("error", "Informe nome, preço e limites válidos para o plano.");
      return;
    }
    const plan: Plan = { id: form.id || id("plan"), name: form.name, monthly_price: parseMoney(form.monthly_price), max_products: Number(form.max_products), max_users: Number(form.max_users), allow_reports: form.allow_reports, allow_printing: form.allow_printing, allow_coupons: form.allow_coupons, is_active: form.is_active };
    setDbState((current) => ({ ...current, plans: form.id ? current.plans.map((item) => item.id === form.id ? plan : item) : [plan, ...current.plans] }));
    setForm(blank);
    setFormOpen(false);
    notify("success", form.id ? "Plano atualizado com sucesso." : "Plano criado com sucesso.");
  }
  function remove(plan: Plan) {
    if (db.companies.some((company) => company.plan_id === plan.id)) { notify("error", "Plano em uso não pode ser excluído."); return; }
    if (!confirm(`Excluir plano ${plan.name}?`)) return;
    setDbState((current) => ({ ...current, plans: current.plans.filter((item) => item.id !== plan.id) }));
    notify("success", "Plano excluído com sucesso.");
  }
  return <CrudShell title="Planos" description="Criar, editar, desativar e excluir planos não usados."><div className="flex justify-end"><button onClick={create} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo plano</button></div><FormDrawer open={formOpen} title={form.id ? "Editar plano" : "Novo plano"} description="Defina limites comerciais e recursos liberados por assinatura." onClose={() => setFormOpen(false)}><form onSubmit={save} className="grid gap-3"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="Preço mensal" value={form.monthly_price} onChange={(value) => setForm({ ...form, monthly_price: value })} /><div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Máx. produtos" value={form.max_products} onChange={(value) => setForm({ ...form, max_products: value })} /><Input placeholder="Máx. usuários" value={form.max_users} onChange={(value) => setForm({ ...form, max_users: value })} /></div><div className="grid gap-3 rounded-2xl bg-startt-paper p-4"><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_reports} onChange={(event) => setForm({ ...form, allow_reports: event.target.checked })} /> Relatórios</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_printing} onChange={(event) => setForm({ ...form, allow_printing: event.target.checked })} /> Impressão</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_coupons} onChange={(event) => setForm({ ...form, allow_coupons: event.target.checked })} /> Cupons</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Ativo</label></div><button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white">{form.id ? "Salvar plano" : "Criar plano"}</button></form></FormDrawer><Table headers={["Plano", "Preço", "Produtos", "Usuários", "Recursos", "Status", "Ações"]} rows={db.plans.map((plan) => [plan.name, money(plan.monthly_price), String(plan.max_products), String(plan.max_users), `${plan.allow_reports ? "Relatórios " : ""}${plan.allow_printing ? "Impressão " : ""}${plan.allow_coupons ? "Cupons" : ""}` || "Básico", plan.is_active ? "Ativo" : "Inativo", <div key={plan.id} className="flex gap-2"><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => edit(plan)}>Editar</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, plans: current.plans.map((item) => item.id === plan.id ? { ...item, is_active: !item.is_active } : item) }))}>Ativar/desativar</button><button className="rounded-xl bg-startt-red px-3 py-2 font-bold text-white" onClick={() => remove(plan)}>Excluir</button></div>])} /></CrudShell>;
}

function MasterUserControls({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  function updateMaster(userId: string, patch: Partial<MockDatabaseState["master_users"][number]>) {
    setDbState((current) => ({ ...current, master_users: current.master_users.map((user) => user.id === userId ? { ...user, ...patch } : user) }));
    notify("success", "Usuário master atualizado com sucesso.");
  }
  function resetMaster(userId: string) {
    if (!confirm("Redefinir senha deste usuário master?")) return;
    const password = prompt("Nova senha");
    if (!password) return;
    updateMaster(userId, { password });
  }
  return <CrudShell title="Acessos Master" description="Controle de login, senha e bloqueio dos usuários master."><Table headers={["Nome", "E-mail", "Status", "Ações"]} rows={db.master_users.map((user) => [user.name, <Input key={`${user.id}-email`} value={user.email} placeholder="E-mail" onChange={(email) => updateMaster(user.id, { email })} />, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => resetMaster(user.id)}>Redefinir senha</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => updateMaster(user.id, { is_active: !user.is_active })}>{user.is_active ? "Bloquear" : "Desbloquear"}</button></div>])} /></CrudShell>;
}

function ProductCard({ product, category, onOpen, onAdd }: { product: Product; category: string; onOpen: () => void; onAdd: () => void }) {
  const hasImage = Boolean(product.image?.trim());
  return (
    <article onClick={onOpen} className="sd-card-lift grid cursor-pointer overflow-hidden rounded-3xl border border-black/10 bg-white p-3 shadow-sm sm:grid-cols-[132px_1fr] sm:p-4">
      <div className="relative h-36 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#FF6A00,#1A1A1A)] shadow-sm sm:h-full sm:min-h-40">
        {hasImage ? (
          <img className="h-full w-full object-cover" src={product.image} alt={product.name} onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/92"><Utensils size={34} /><span className="sr-only">Produto sem foto</span></div>
        )}
        {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-xs font-black text-startt-green shadow-sm">{product.badge}</span>}
      </div>
      <div className="grid gap-4 p-2 sm:pl-4">
        <div>
          <span className="text-xs font-black uppercase text-startt-muted">{category}</span>
          <h3 className="mt-1 text-xl font-black leading-tight tracking-normal text-startt-ink">{product.name}</h3>
          {product.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-startt-muted">{product.description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="font-display text-2xl font-black text-startt-green">{money(product.price)}</strong>
          <button onClick={(event) => { event.stopPropagation(); onAdd(); }} aria-label={`Adicionar ${product.name}`} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-startt-green px-4 text-sm font-black text-white shadow-lg shadow-startt-green/20"><Plus size={17} /> Adicionar</button>
        </div>
      </div>
    </article>
  );
}

function ProductModal({ product, category, onClose, onAdd }: { product: Product; category: string; onClose: () => void; onAdd: () => void }) {
  const hasImage = Boolean(product.image?.trim());
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar produto" />
      <section className="relative grid max-h-[92vh] w-[min(720px,100%)] overflow-hidden rounded-lg bg-white shadow-2xl animate-in zoom-in-95 duration-200 md:grid-cols-[280px_1fr]">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-lg bg-white/95 shadow" aria-label="Fechar"><X size={20} /></button>
        {hasImage ? <img className="h-64 w-full object-cover md:h-full" src={product.image} alt={product.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="grid h-64 w-full place-items-center bg-[linear-gradient(135deg,#FF6A00,#1A1A1A)] text-white md:h-full"><Utensils size={52} /></div>}
        <div className="grid gap-4 overflow-auto p-5">
          <div>
            <span className="text-xs font-black uppercase text-startt-green">{category}</span>
            <h2 className="mt-1 text-3xl font-black">{product.name}</h2>
            <p className="mt-3 leading-7 text-startt-muted">{product.description}</p>
          </div>
          <Panel title="Ingredientes">
            <p className="text-sm leading-6 text-startt-muted">{product.ingredients || "Ingredientes não informados."}</p>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-startt-muted">Preparo: {product.preparation_time} min</span>
            <strong className="text-2xl">{money(product.price)}</strong>
          </div>
          <button onClick={onAdd} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-startt-green px-4 font-black text-white"><Plus size={18} /> Adicionar ao carrinho</button>
        </div>
      </section>
    </div>
  );
}

function CompanyInfoModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const whatsappMessage = encodeURIComponent(`Olá, ${company.name}! Vim pelo Startt Delivery.`);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar informações" />
      <section className="relative grid max-h-[92vh] w-[min(520px,100%)] gap-4 overflow-auto rounded-lg bg-white p-6 text-center shadow-2xl animate-in">
        <button onClick={onClose} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg bg-startt-soft" aria-label="Fechar"><X size={20} /></button>
        {company.logo_url ? <img className="mx-auto h-20 w-20 rounded-lg object-cover" src={companyLogoUrl(company)} alt={company.name} /> : <span className="mx-auto grid h-20 w-20 place-items-center rounded-lg bg-startt-green text-4xl font-black text-white">S</span>}
        <div>
          <h2 className="text-3xl font-black">{company.name}</h2>
          <p className="mt-1 text-sm font-bold text-startt-muted">Produzido por: Startt Facilities</p>
        </div>
        <div className="grid gap-2 text-left text-sm text-startt-muted">
          <p><b className="text-startt-ink">Endereço:</b> {company.address}</p>
          <p><b className="text-startt-ink">WhatsApp:</b> {company.whatsapp}</p>
          <p><b className="text-startt-ink">Status:</b> {company.is_open ? "Aberto" : "Fechado"}</p>
          <p><b className="text-startt-ink">Horário:</b> {company.opening_hours}</p>
        </div>
        <a href={`https://wa.me/${company.whatsapp}?text=${whatsappMessage}`} target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-startt-green px-4 font-black text-white">Falar no WhatsApp</a>
      </section>
    </div>
  );
}

function CrudShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5"><div><h1 className="text-2xl font-black tracking-tight md:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-startt-muted">{description}</p></div>{children}</section>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-4 rounded-3xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">{title}</h2>{children}</section>; }
function HelpText({ children }: { children: React.ReactNode }) { return <p className="text-xs font-bold leading-5 text-startt-muted">{children}</p>; }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <input type={type} className="min-h-12 w-full rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />; }
function PasswordField({ value, onChange, placeholder, visible, onToggle }: { value: string; onChange: (value: string) => void; placeholder: string; visible: boolean; onToggle: () => void }) { return <div className="flex min-h-12 overflow-hidden rounded-xl border border-startt-border bg-white shadow-sm focus-within:border-startt-green focus-within:shadow-input"><input className="min-w-0 flex-1 px-3 text-sm outline-none" type={visible ? "text" : "password"} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /><button type="button" className="grid w-12 place-items-center text-startt-muted" onClick={onToggle} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>; }
function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <select className="min-h-12 w-full rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>; }
function Toggle({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) { return <button disabled={disabled} onClick={onClick} className={`min-h-12 rounded-xl border px-3 font-black disabled:opacity-40 ${active ? "border-startt-green bg-startt-green text-white shadow-lg shadow-startt-green/20" : "border-startt-border bg-white"}`}>{children}</button>; }
function Table({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-card">
      <div className="grid gap-3 p-3 md:hidden">
        {rows.length ? rows.map((row, i) => (
          <article key={i} className="grid gap-3 rounded-2xl border border-black/10 bg-startt-paper p-3">
            {row.map((cell, j) => (
              <div key={j} className={j === row.length - 1 ? "grid gap-2" : "grid gap-1"}>
                <span className="text-[11px] font-black uppercase text-startt-muted">{headers[j]}</span>
                <div className="min-w-0 text-sm font-bold text-startt-ink">{cell}</div>
              </div>
            ))}
          </article>
        )) : <div className="p-6 text-center text-startt-muted">Nenhum registro encontrado ainda.</div>}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-startt-soft text-xs uppercase text-startt-muted"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map((row, i) => <tr key={i} className="sd-tr border-t border-black/10">{row.map((cell, j) => <td key={j} className="p-4 align-middle">{cell}</td>)}</tr>) : <tr className="border-t border-black/10"><td className="p-8 text-center text-startt-muted" colSpan={headers.length}>Nenhum registro encontrado ainda.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="flex flex-wrap gap-2"><button className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black shadow-sm" onClick={onEdit}>Editar</button><button className="rounded-xl bg-startt-red px-3 py-2 text-sm font-black text-white shadow-sm" onClick={onDelete}>Excluir</button></div>; }
function InlineAdd({ value, setValue, onAdd, placeholder }: { value: string; setValue: (value: string) => void; onAdd: () => void; placeholder: string }) { return <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 shadow-card sm:flex-row"><Input value={value} onChange={setValue} placeholder={placeholder} /><button onClick={onAdd} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20">Cadastrar</button></div>; }
function FormDrawer({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-[70] ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} aria-label="Fechar formulário" />
      <aside className={`absolute bottom-0 right-0 grid h-[94vh] w-full grid-rows-[auto_1fr] rounded-t-3xl bg-white shadow-drawer transition-transform duration-300 ease-spring sm:top-0 sm:h-full sm:w-[min(620px,100%)] sm:rounded-none ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"}`}>
        <header className="flex items-start justify-between gap-4 border-b border-black/10 p-5">
          <div>
            <span className="text-xs font-black uppercase text-startt-green">Formulário</span>
            <h2 className="mt-1 text-2xl font-black">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-startt-muted">{description}</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-startt-soft" aria-label="Fechar"><X size={20} /></button>
        </header>
        <div className="mobile-safe-bottom overflow-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
function MenuChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`min-h-11 min-w-fit rounded-2xl border px-5 text-sm font-bold shadow-sm transition ${active ? "border-startt-green bg-startt-green text-white shadow-lg shadow-startt-green/20" : "border-black/10 bg-white text-startt-ink hover:border-startt-green/40"}`}>{children}</button>;
}
function FormModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/55 p-4 backdrop-blur-sm animate-fade">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar" />
      <section className="relative max-h-[92vh] w-[min(560px,100%)] overflow-auto rounded-3xl bg-white p-6 shadow-drawer animate-in">
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl hover:bg-startt-soft" aria-label="Fechar"><X size={18} /></button>
        <h2 className="mb-5 text-center text-2xl font-black">{title}</h2>
        {children}
      </section>
    </div>
  );
}
function QuickLink({ href, title, text, icon }: { href: string; title: string; text: string; icon: React.ReactNode }) {
  return <a href={href} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card-hover"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-startt-rose text-startt-green">{icon}</span><span><strong className="block">{title}</strong><small className="text-startt-muted">{text}</small></span></a>;
}
function ImageUpload({ label, value, storage, onChange }: { label: string; value: string; storage?: { companyId: string; kind: string }; onChange: (value: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function applyFile(file?: File) {
    if (!file) return;
    try {
      setUploading(true);
      const uploadedUrl = storage ? await uploadPublicImage(storage.companyId, storage.kind, file) : "";
      onChange(uploadedUrl || await readImageAsDataUrl(file));
      notify("success", uploadedUrl ? "Imagem enviada para o storage e salva." : "Imagem carregada com preview local.");
    } catch {
      notify("error", "Envie um arquivo de imagem válido.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="grid gap-3">
      <span className="text-sm font-black text-startt-ink">{label}</span>
      <label
        className={`grid cursor-pointer gap-3 rounded-2xl border border-dashed p-4 transition ${dragging ? "drop-zone-active border-startt-green bg-startt-soft" : "border-startt-border bg-startt-paper"}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void applyFile(event.dataTransfer.files[0]); }}
      >
        <input className="hidden" type="file" accept="image/*" onChange={(event) => void applyFile(event.target.files?.[0])} />
        <div className="grid gap-3 sm:grid-cols-[120px_1fr] sm:items-center">
          <img className="h-32 w-full rounded-xl object-cover sm:h-24" src={value || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"} alt="" onError={(event) => { event.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"; }} />
          <div className="grid gap-1 text-sm text-startt-muted">
            <strong className="inline-flex items-center gap-2 text-startt-ink"><UploadCloud size={18} /> {uploading ? "Enviando..." : "Arraste uma imagem ou toque para escolher"}</strong>
            <span>{storage ? "Envia para o storage público do Supabase e salva a URL no banco." : "Funciona com galeria do celular, drag and drop no desktop e salva como Base64 no modo local."}</span>
          </div>
        </div>
      </label>
      <Input placeholder="Ou cole uma URL de imagem" value={value} onChange={onChange} />
    </div>
  );
}
function Totals({ subtotal, discount, deliveryFee, total }: { subtotal: number; discount: number; deliveryFee: number; total: number }) { return <div className="grid gap-1 text-sm"><span className="flex justify-between">Subtotal <b>{money(subtotal)}</b></span><span className="flex justify-between">Desconto <b>-{money(discount)}</b></span><span className="flex justify-between">Entrega <b>{money(deliveryFee)}</b></span><strong className="flex justify-between text-base">Total <b>{money(total)}</b></strong></div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="group grid min-h-40 content-between rounded-3xl border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-startt-rose text-startt-green transition group-hover:scale-105">{icon}</span><div><small className="font-bold uppercase text-startt-muted">{label}</small><strong className="mt-2 block text-3xl font-black tracking-tight">{value}</strong></div></article>; }
function AdminHero({ company, title, description }: { company?: Company; title: string; description: string }) { return <div className="relative isolate flex min-h-72 items-end overflow-hidden rounded-3xl p-6 text-white shadow-card"><img className="absolute inset-0 -z-20 h-full w-full object-cover" src={company ? companyHeroUrl(company) : "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80"} alt="" /><div className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(20,17,15,.92),rgba(20,17,15,.58),rgba(242,106,27,.22))]" /><div className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black backdrop-blur">{company?.slug || "master"}</div><div><span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-sm font-black uppercase text-startt-yellow backdrop-blur"><Building2 size={16} /> Startt Facilities</span><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{title}</h1><p className="mt-3 max-w-2xl text-white/86">{description}</p></div></div>; }
function LogoTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-startt-ink text-2xl font-black text-white shadow-card"><span className="accent-text">S</span></span><span><strong className="block leading-tight tracking-tight">{title}</strong><small className="block text-startt-muted">{subtitle}</small></span></div>; }
function InstantRouteShell() { return <main className="min-h-screen bg-startt-paper" />; }
function CompanyLoadingScreen() { return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(255,106,0,.14),transparent_34rem),#f7f4ef] px-4 py-10"><section className="grid w-[min(460px,100%)] gap-6 rounded-3xl border border-black/10 bg-white/92 p-6 text-center shadow-2xl shadow-black/10 backdrop-blur"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-startt-ink text-4xl font-black text-white shadow-card"><span className="accent-text">S</span></div><div className="grid gap-2"><p className="text-xs font-black uppercase tracking-[.18em] text-startt-green">Startt Delivery</p><h1 className="text-2xl font-black tracking-normal text-startt-ink">Abrindo cardápio</h1></div><div className="grid gap-3 text-left"><div className="h-4 w-2/3 animate-pulse rounded-full bg-black/10" /><div className="grid grid-cols-[76px_1fr] gap-3 rounded-2xl border border-black/5 bg-startt-paper p-3"><div className="h-20 animate-pulse rounded-2xl bg-[linear-gradient(135deg,rgba(255,106,0,.28),rgba(10,10,10,.14))]" /><div className="grid content-center gap-3"><div className="h-3 w-full animate-pulse rounded-full bg-black/10" /><div className="h-3 w-4/5 animate-pulse rounded-full bg-black/10" /><div className="h-8 w-28 animate-pulse rounded-xl bg-startt-green/20" /></div></div><div className="h-3 w-full animate-pulse rounded-full bg-black/10" /><div className="h-3 w-5/6 animate-pulse rounded-full bg-black/10" /></div></section></main>; }
function StatusCard({ company }: { company: Company }) { return <div className="premium-surface flex gap-3 rounded-2xl p-4"><span className={`mt-1 h-3 w-3 rounded-full ${company.is_open ? "bg-startt-green status-open" : "bg-startt-red"}`} /><div><strong className="block">{company.is_open ? "Loja aberta" : "Loja fechada"}</strong><span className="text-sm leading-6 text-startt-muted">{company.address}</span></div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`flex min-h-11 min-w-fit items-center justify-between gap-3 rounded-2xl px-4 text-sm font-extrabold transition ${active ? "bg-startt-ink text-white shadow-card" : "bg-white text-startt-ink shadow-sm hover:bg-startt-rose"}`}>{children}<ChevronRight size={16} /></button>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center content-center gap-2 text-center text-startt-muted"><ShoppingBag size={32} /><strong className="text-startt-ink">{text}</strong></div>; }
function DateFilters({ start, end, setStart, setEnd, onPdf }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void; onPdf: () => void }) { return <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3"><Input type="date" placeholder="" value={start} onChange={setStart} /><Input type="date" placeholder="" value={end} onChange={setEnd} /><button onClick={onPdf} className="rounded-lg bg-startt-green px-4 font-black text-white">Emitir PDF do relatório</button></div>; }
function Footer() { return <footer className="border-t border-black/10 px-4 py-6 text-center text-sm font-bold text-startt-muted">Startt Delivery — produzido por Startt Facilities</footer>; }
function NotFound({ message }: { message: string }) { return <main className="grid min-h-screen place-items-center bg-startt-paper p-4"><section className="rounded-lg border bg-white p-6 text-center shadow-xl"><h1 className="text-3xl font-black">{message}</h1><a href="/" className="mt-5 inline-flex rounded-lg bg-startt-green px-4 py-3 font-black text-white">Voltar</a></section></main>; }
function Suspended({ company, publicView = false, message }: { company: Company; publicView?: boolean; message?: string }) { return <main className="grid min-h-screen place-items-center bg-startt-paper p-4"><section className="max-w-lg rounded-lg border bg-white p-6 text-center shadow-xl"><h1 className="text-3xl font-black">Acesso suspenso</h1><p className="mt-3 text-startt-muted">{message || `${company.name} está com acesso suspenso. Entre em contato com a Startt Facilities.`} {publicView ? "O cardápio está temporariamente indisponível." : ""}</p></section></main>; }
function categoryName(id: string, categories: Category[]) { return categories.find((item) => item.id === id)?.name || "-"; }
function categoryEmoji(category?: Category | null) { return category?.emoji?.trim() || "🍽️"; }
function categoryLabel(category?: Category | null) { return `${categoryEmoji(category)} ${category?.name || "Categoria"}`; }
function customerName(id: string, customers: Customer[]) { return customers.find((item) => item.id === id)?.name || "Cliente"; }
function groupSum<T extends Record<string, unknown>>(items: T[], key: keyof T) { return items.reduce<Record<string, number>>((acc, item) => { const value = String(item[key]); acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function sumByDay(items: Array<{ date: string; total: number }>) { return items.reduce<Record<string, number>>((acc, item) => { const day = item.date.slice(0, 10); acc[day] = (acc[day] || 0) + item.total; return acc; }, {}); }

createRoot(document.getElementById("root")!).render(<App />);
