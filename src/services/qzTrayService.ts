import qz from "qz-tray";
import { Company, Order, OrderItem, PrintSettings } from "../data/mockDatabase";

export type QzConnectionStatus = "connected" | "disconnected";

export type QzOrderPrintPayload = {
  company: Company;
  order: Order;
  items: OrderItem[];
  settings?: PrintSettings;
};

const QZ_DOWNLOAD_URL = "https://qz.io/download/";
const encoder = new TextEncoder();
let securityConfigured = false;

function normalizeText(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7EÀ-ÿ]/g, "").trim();
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function displayOrderNumber(order: Order) {
  return order.order_number ? String(order.order_number).padStart(5, "0") : order.id;
}

function line(value = "") {
  return `${normalizeText(value)}\n`;
}

function separator() {
  return "------------------------------------------\n";
}

function twoColumns(left: string, right: string, width = 42) {
  const cleanLeft = normalizeText(left);
  const cleanRight = normalizeText(right);
  const leftWidth = Math.max(1, width - cleanRight.length);
  return `${cleanLeft.slice(0, leftWidth).padEnd(leftWidth, " ")}${cleanRight}\n`;
}

function center(value: string, width = 42) {
  const clean = normalizeText(value).slice(0, width);
  const left = Math.max(0, Math.floor((width - clean.length) / 2));
  return `${" ".repeat(left)}${clean}\n`;
}

function wrap(value: string, width = 42) {
  const clean = normalizeText(value);
  const parts: string[] = [];
  let remaining = clean;
  while (remaining.length > width) {
    const slice = remaining.slice(0, width);
    const breakAt = slice.lastIndexOf(" ");
    const index = breakAt > 18 ? breakAt : width;
    parts.push(remaining.slice(0, index));
    remaining = remaining.slice(index).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.map((part) => line(part)).join("");
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/connect|websocket|refused|Unable to establish|Failed to fetch|network/i.test(message)) {
    return "QZ Tray não conectado. Abra o QZ Tray no Windows e clique em Conectar novamente.";
  }
  if (/printer|not found|cannot find/i.test(message)) {
    return "Impressora não encontrada. Confira se ela aparece no Windows e busque impressoras novamente.";
  }
  if (/certificate|signature|sign/i.test(message)) {
    return "QZ Tray recusou a assinatura. Em produção, configure assinatura segura no servidor.";
  }
  return message || "Não foi possível comunicar com o QZ Tray.";
}

function configureSecurity() {
  if (securityConfigured) return;
  securityConfigured = true;

  const certificateUrl = import.meta.env.VITE_QZ_CERTIFICATE_URL as string | undefined;
  const signingUrl = import.meta.env.VITE_QZ_SIGN_URL as string | undefined;

  qz.security.setSignatureAlgorithm("SHA256");
  qz.security.setCertificatePromise(async () => {
    if (!certificateUrl) return "";
    const response = await fetch(certificateUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar o certificado público do QZ Tray.");
    return response.text();
  });
  qz.security.setSignaturePromise(async (dataToSign: string) => {
    if (!signingUrl) return "";
    const response = await fetch(signingUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: dataToSign }),
    });
    if (!response.ok) throw new Error("Não foi possível assinar a requisição do QZ Tray.");
    const payload = await response.json() as { signature?: string };
    return payload.signature || "";
  });
}

export function getQzDownloadUrl() {
  return QZ_DOWNLOAD_URL;
}

export function getSavedQzPrinter(companyId: string, userId: string) {
  try {
    return localStorage.getItem(`startt_qz_printer:${companyId}:${userId}`) || "";
  } catch {
    return "";
  }
}

export function saveQzPrinter(companyId: string, userId: string, printerName: string) {
  try {
    localStorage.setItem(`startt_qz_printer:${companyId}:${userId}`, printerName);
  } catch {
    // Preferimos não bloquear a operação se o navegador negar localStorage.
  }
}

export function getQzStatus(): QzConnectionStatus {
  try {
    return qz.websocket.isActive() ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}

export async function connectQzTray() {
  configureSecurity();
  try {
    if (!qz.websocket.isActive()) await qz.websocket.connect();
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function disconnectQzTray() {
  try {
    if (qz.websocket.isActive()) await qz.websocket.disconnect();
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function listQzPrinters() {
  try {
    await connectQzTray();
    const result = await qz.printers.find();
    return Array.isArray(result) ? result : result ? [result] : [];
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export function buildEscPosOrder(payload: QzOrderPrintPayload) {
  const { company, order, items, settings } = payload;
  const created = new Date(order.created_at);
  const date = created.toLocaleDateString("pt-BR");
  const time = created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const copies = Math.max(1, Math.min(4, settings?.copies || 1));
  const receipt =
    "\x1B\x40" +
    "\x1B\x61\x01" +
    "\x1B\x45\x01" +
    center(company.name.toUpperCase()) +
    "\x1B\x45\x00" +
    center("STARTT DELIVERY") +
    center(`PEDIDO #${displayOrderNumber(order)}`) +
    center(`${date} ${time}`) +
    "\x1B\x61\x00" +
    separator() +
    line("CLIENTE") +
    wrap(`Nome: ${order.customer_name || "Cliente"}`) +
    wrap(`Telefone: ${order.customer_phone || "-"}`) +
    wrap(`Endereco: ${order.customer_address || "Retirada"}`) +
    separator() +
    line("ITENS") +
    (items.length
      ? items.map((item) => `${line(`${item.quantity}x ${item.name}`)}${twoColumns(`  Unit. ${money(item.unit_price)}`, money(item.total))}`).join("")
      : line("Itens nao informados")) +
    (order.customer_note ? `${separator()}${line("OBSERVACOES")}${wrap(order.customer_note)}` : "") +
    separator() +
    twoColumns("Subtotal", money(order.subtotal)) +
    twoColumns("Entrega", money(order.delivery_fee)) +
    (order.discount ? twoColumns("Desconto", `-${money(order.discount)}`) : "") +
    "\x1B\x45\x01" +
    twoColumns("TOTAL", money(order.total)) +
    "\x1B\x45\x00" +
    separator() +
    line("PAGAMENTO") +
    wrap(order.payment_details || order.payment_method) +
    (order.payment_method === "Dinheiro" && (order.change_for || order.cash_change_for)
      ? `${twoColumns("Troco para", money(order.change_for || order.cash_change_for || 0))}${twoColumns("Troco", money(order.change_amount || order.calculated_change || 0))}`
      : "") +
    separator() +
    "\x1B\x61\x01" +
    wrap(settings?.footer_text || "Pedido gerado pelo Startt Delivery") +
    line("") +
    line("") +
    "\x1D\x56\x41\x10";

  return Array.from({ length: copies }, () => receipt).join("");
}

export async function printRawEscPos(printerName: string, escpos: string) {
  if (!printerName.trim()) throw new Error("Selecione uma impressora antes de imprimir.");
  try {
    await connectQzTray();
    const config = qz.configs.create(printerName, { encoding: "CP850", copies: 1, jobName: "Startt Delivery" });
    await qz.print(config, [{ type: "raw", format: "command", flavor: "plain", data: escpos }]);
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function printQzOrder(printerName: string, payload: QzOrderPrintPayload) {
  await printRawEscPos(printerName, buildEscPosOrder(payload));
}

export async function printQzTest(printerName: string, companyName: string) {
  const data =
    "\x1B\x40" +
    "\x1B\x61\x01" +
    "\x1B\x45\x01" +
    center(companyName.toUpperCase()) +
    "\x1B\x45\x00" +
    center("STARTT DELIVERY") +
    separator() +
    center("TESTE QZ TRAY 80MM") +
    center(new Date().toLocaleString("pt-BR")) +
    separator() +
    center("Impressao automatica configurada") +
    line("") +
    line("") +
    "\x1D\x56\x41\x10";
  await printRawEscPos(printerName, data);
}

export function qzInstallInstructions() {
  return "Instale o QZ Tray no Windows 10, mantenha o aplicativo aberto perto do relógio e volte ao painel Startt para conectar.";
}

export function encodeEscPosForDebug(payload: QzOrderPrintPayload) {
  return encoder.encode(buildEscPosOrder(payload));
}
