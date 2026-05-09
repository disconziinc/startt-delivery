import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Bike,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
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
  Sparkles,
  Star,
  Tags,
  TicketPercent,
  Trash2,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  CashSale,
  Category,
  Company,
  CompanyStatus,
  Coupon,
  createDatabaseApi,
  Customer,
  DeliveryZone,
  Fulfillment,
  MockDatabaseState,
  Order,
  OrderStatus,
  PaymentMethod,
  Plan,
  PrintSettings,
  Product,
  SubscriptionStatus,
  User,
  UserRole,
} from "./data/mockDatabase";
import {
  DATABASE_STORAGE_KEY,
  getInitialDatabaseSnapshot,
  loadDatabaseSnapshot,
  persistDatabaseSnapshot,
} from "./services/database";
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
  coupon: string;
  cash_change_for: string;
};
type AdminScreen =
  | "dashboard"
  | "caixa"
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
const SAVE_DELAY = 250;

const adminNav: Array<{ id: AdminScreen; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "caixa", label: "Caixa", icon: <CreditCard size={18} /> },
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

const roleAccess: Record<UserRole, AdminScreen[]> = {
  dono: adminNav.map((item) => item.id),
  gerente: adminNav.map((item) => item.id).filter((id) => !["usuarios", "configuracoes"].includes(id)),
  caixa: ["dashboard", "caixa", "pedidos"],
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

function notify(type: ToastType, message: string) {
  window.dispatchEvent(new CustomEvent("startt:toast", { detail: { type, message } }));
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function positiveNumber(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

function App() {
  const [dbState, setDbState] = useState<MockDatabaseState>(() => getInitialDatabaseSnapshot());
  const [databaseReady, setDatabaseReady] = useState(false);
  const db = useMemo(() => createDatabaseApi(dbState), [dbState]);
  const parts = window.location.pathname.split("/").filter(Boolean);
  const withToast = (node: React.ReactNode) => <><ToastHost />{node}</>;

  useEffect(() => {
    let alive = true;
    loadDatabaseSnapshot()
      .then((snapshot) => {
        if (!alive) return;
        setDbState(snapshot);
      })
      .finally(() => {
        if (alive) setDatabaseReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!databaseReady) return;
    void persistDatabaseSnapshot(dbState);
  }, [dbState, databaseReady]);

  useEffect(() => {
    function refreshFromStorage(event?: StorageEvent) {
      if (event && event.key !== DATABASE_STORAGE_KEY) return;
      loadDatabaseSnapshot().then(setDbState);
    }
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, []);

  if (parts[0] === "master") {
    return withToast(<MasterApp db={db} setDbState={setDbState} screen={(parts[1] as MasterScreen) || "dashboard"} login={parts[1] === "login"} />);
  }

  if (!parts[0]) return withToast(<CompanyDirectory companies={db.companies} />);

  const company = db.getCompanyBySlug(parts[0]);
  if (!company) return withToast(<NotFound message={`Não encontramos a empresa “/${parts[0]}”. Confira o link e tente novamente.`} />);

  if (parts[1] === "admin") {
    const screen = (parts[2] === "login" ? "dashboard" : parts[2] || "dashboard") as AdminScreen;
    return withToast(<CompanyAdmin db={db} setDbState={setDbState} company={company} screen={screen} login={parts[2] === "login"} />);
  }

  if (parts[1] === "checkout") {
    return withToast(<PublicMenu db={db} setDbState={setDbState} company={company} checkoutOnly />);
  }

  return withToast(<PublicMenu db={db} setDbState={setDbState} company={company} />);
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
          {company?.logo_url ? <img className="h-11 w-11 rounded-lg object-cover" src={company.logo_url} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-11 w-11 place-items-center rounded-lg bg-startt-green text-2xl font-black text-white">S</span>}
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

function CompanyDirectory({ companies }: { companies: Company[] }) {
  return (
    <main className="min-h-screen bg-startt-paper">
      <AppHeader />
      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 py-10">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-black uppercase text-startt-green"><Sparkles size={16} /> SaaS multiempresa</span>
          <h1 className="mt-2 text-5xl font-black leading-none md:text-7xl">Startt Delivery</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-startt-muted">Cardápio público por slug, admin por empresa e Admin Master para gestão do SaaS.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {companies.map((company) => (
            <a key={company.id} href={`/${company.slug}`} className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img className="h-44 w-full object-cover" src={company.hero_image} alt={company.name} />
              <div className="grid gap-2 p-5">
                <strong className="text-xl">{company.name}</strong>
                <span className="text-sm text-startt-muted">/{company.slug}</span>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-startt-green">Abrir cardápio <ChevronRight size={16} /></span>
              </div>
            </a>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
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
  const [checkout, setCheckout] = useState<CheckoutState>({ name: "", phone: "", cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "", payment_method: "Pix" as PaymentMethod, coupon: "", cash_change_for: "" });

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
  const cashChangeFor = Number(checkout.cash_change_for) || 0;
  const calculatedChange = checkout.payment_method === "Dinheiro" && cashChangeFor > 0 ? Math.max(0, cashChangeFor - total) : 0;
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { ...product, qty: 1 }];
    });
    setCartOpen(true);
    notify("success", `${product.name} adicionado ao pedido.`);
  }

  function finishOrder() {
    if (!cart.length) {
      notify("error", "Adicione pelo menos um produto antes de finalizar.");
      return;
    }
    if (!checkout.name.trim() || !checkout.phone.trim()) {
      notify("error", "Informe nome e telefone para finalizar o pedido.");
      return;
    }
    if (fulfillment === "delivery" && (!checkout.address.trim() || !zoneId)) {
      notify("error", "Informe endereço e bairro de entrega.");
      return;
    }
    const customerId = id("cus");
    const orderId = id("ord");
    const createdAt = new Date().toISOString();
    const orderNumber = nextOrderNumber(db.orders, company.id);
    const fullAddress = fulfillment === "delivery" ? `${checkout.address}, ${checkout.number}${checkout.complement ? ` - ${checkout.complement}` : ""} - ${checkout.neighborhood} - ${checkout.city}/${checkout.state} - CEP ${checkout.cep}` : "Retirada";
    setDbState((current) => ({
      ...current,
      customers: [
        ...current.customers,
        { id: customerId, company_id: company.id, name: checkout.name || "Cliente WhatsApp", phone: checkout.phone || "Não informado", address: fullAddress, total_spent: total, last_order_at: createdAt, created_at: createdAt },
      ],
      coupons: coupon ? current.coupons.map((item) => item.id === coupon.id && item.company_id === company.id ? { ...item, used_count: item.used_count + 1 } : item) : current.coupons,
      orders: [
        { id: orderId, order_number: orderNumber, company_id: company.id, customer_id: customerId, status: "novo", fulfillment, delivery_zone_id: fulfillment === "delivery" ? zoneId : undefined, subtotal, discount, delivery_fee: deliveryFee, total, payment_method: checkout.payment_method, cash_change_for: cashChangeFor, calculated_change: calculatedChange, created_at: createdAt },
        ...current.orders,
      ],
      order_items: [
        ...cart.map((item) => ({ id: id("oit"), company_id: company.id, order_id: orderId, product_id: item.id, name: item.name, quantity: item.qty, unit_price: item.price, total: item.qty * item.price })),
        ...current.order_items,
      ],
    }));
    window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { company_id: company.id, order_id: orderId } }));
    const message = [
      `Olá, ${company.name}! Quero fazer um pedido:`,
      "",
      `Empresa: ${company.name}`,
      `Pedido: #${String(orderNumber).padStart(5, "0")}`,
      `Cliente: ${checkout.name}`,
      `Telefone: ${checkout.phone}`,
      `Pagamento: ${checkout.payment_method}`,
      checkout.payment_method === "Dinheiro" && cashChangeFor > 0 ? `Troco para: ${money(cashChangeFor)} | Troco: ${money(calculatedChange)}` : "",
      "",
      "Itens:",
      ...cart.map((item) => `${item.qty}x ${item.name} - ${money(item.qty * item.price)}`),
      "",
      `Subtotal: ${money(subtotal)}`,
      `Desconto: -${money(discount)}`,
      fulfillment === "delivery" ? `Entrega: ${zone?.neighborhood || "Confirmar"} - ${money(deliveryFee)}` : "Retirada no local",
      `Total: ${money(total)}`,
      fulfillment === "delivery" ? `Endereço: ${fullAddress}` : "Retirada no local",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
    setCart([]);
    setCartOpen(false);
    notify("success", "Pedido criado e mensagem do WhatsApp preparada.");
  }

  if (["blocked", "canceled", "disabled"].includes(company.status)) {
    return <Suspended company={company} publicView />;
  }

  return (
    <main className="min-h-screen bg-startt-paper">
      <AppHeader company={company} />
      {!checkoutOnly && (
        <section className="relative isolate flex min-h-[560px] items-end overflow-hidden px-4 pb-24 pt-10 md:px-10 md:pb-14">
          <img className="absolute inset-0 -z-20 h-full w-full object-cover" src={company.banner_url || company.hero_image} alt={company.name} onError={(event) => { event.currentTarget.src = company.hero_image || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80"; }} />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-startt-paper to-transparent" />
          <div className="mx-auto grid w-[min(1280px,100%)] gap-7 pb-2 text-white lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-sm font-black uppercase backdrop-blur"><Sparkles size={16} /> Cardápio público</div>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                {company.logo_url ? <img className="h-20 w-20 rounded-2xl border border-white/30 object-cover shadow-2xl" src={company.logo_url} alt={company.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-20 w-20 place-items-center rounded-2xl border border-white/25 bg-white/15 text-4xl font-black backdrop-blur">S</span>}
                <div>
                  <h1 className="max-w-4xl text-5xl font-black leading-none md:text-7xl">{company.name}</h1>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-white/90">
                    <span className="rounded-full bg-white/14 px-3 py-1">{company.opening_hours}</span>
                    <span className="rounded-full bg-white/14 px-3 py-1">{company.estimated_delivery_time}</span>
                    <span className="rounded-full bg-white/14 px-3 py-1">Pedido min. {money(company.minimum_order)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-3 py-1"><Star size={14} fill="currentColor" /> 4,8</span>
                  </div>
                </div>
              </div>
              <label className="mt-7 flex h-14 w-[min(680px,100%)] items-center gap-3 rounded-2xl bg-white px-4 text-startt-muted shadow-2xl">
                <Search size={19} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-startt-ink outline-none" placeholder="Buscar produtos, combos e bebidas" />
              </label>
            </div>
            <div className="hidden rounded-2xl border border-white/20 bg-white/12 p-5 shadow-2xl backdrop-blur-xl lg:grid">
              <span className="text-sm font-bold text-white/75">Entrega via WhatsApp</span>
              <strong className="mt-1 text-2xl">Pedido enviado direto para a loja</strong>
              <a href={`https://wa.me/${company.whatsapp}`} target="_blank" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 font-black text-startt-ink"><MessageCircle size={18} /> Falar no WhatsApp</a>
            </div>
          </div>
        </section>
      )}
      <section className="mx-auto grid w-[min(1280px,calc(100%-32px))] gap-6 py-7 lg:grid-cols-[280px_1fr]">
        <aside className="grid gap-4 self-start lg:sticky lg:top-24">
          <StatusCard company={company} />
          <Panel title="Categorias">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
              <FilterButton active={categoryId === "all"} onClick={() => setCategoryId("all")}>Todos</FilterButton>
              {categories.map((category) => <FilterButton key={category.id} active={categoryId === category.id} onClick={() => setCategoryId(category.id)}>{category.name}</FilterButton>)}
            </div>
          </Panel>
          <Panel title="Cupons">
            <span className="text-sm text-startt-muted">{bundle.coupons.filter((item) => item.active).map((item) => item.code).join(", ") || "Nenhum cupom ativo"}</span>
          </Panel>
        </aside>
        <section>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-black uppercase text-startt-green">/{company.slug}</span>
              <h2 className="text-3xl font-black">{checkoutOnly ? "Checkout" : "Cardápio"}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCartOpen(true)} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-black/10 bg-white px-4 font-extrabold"><ShoppingBag size={18} /> Ver pedido ({itemCount})</button>
              <button onClick={() => setCompanyInfoOpen(true)} className="grid h-11 w-11 place-items-center rounded-lg border border-black/10 bg-white text-2xl font-black" aria-label="Informações da empresa">⋮</button>
            </div>
          </div>
          {!checkoutOnly && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => <ProductCard key={product.id} product={product} category={categories.find((item) => item.id === product.category_id)?.name || ""} onOpen={() => setSelectedProduct(product)} onAdd={() => add(product)} />)}
              {!filtered.length && <div className="rounded-lg border border-black/10 bg-white p-6 text-startt-muted md:col-span-2 xl:col-span-3">Nenhum produto encontrado neste cardápio.</div>}
            </div>
          )}
        </section>
      </section>
      <CartDrawer cartOpen={cartOpen} setCartOpen={setCartOpen} cart={cart} setCart={setCart} company={company} zones={activeZones} zoneId={zoneId} setZoneId={setZoneId} checkout={checkout} setCheckout={setCheckout} fulfillment={fulfillment} setFulfillment={setFulfillment} subtotal={subtotal} discount={discount} deliveryFee={deliveryFee} total={total} finishOrder={finishOrder} />
      {itemCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="mobile-safe-bottom fixed inset-x-4 bottom-3 z-40 flex min-h-14 items-center justify-between rounded-2xl bg-startt-green px-4 font-black text-white shadow-2xl md:hidden">
          <span className="inline-flex items-center gap-2"><ShoppingBag size={18} /> Ver pedido</span>
          <span>{itemCount} item(ns) • {money(total)}</span>
        </button>
      )}
      {selectedProduct && <ProductModal product={selectedProduct} category={categories.find((item) => item.id === selectedProduct.category_id)?.name || ""} onClose={() => setSelectedProduct(null)} onAdd={() => { add(selectedProduct); setSelectedProduct(null); }} />}
      {companyInfoOpen && <CompanyInfoModal company={company} onClose={() => setCompanyInfoOpen(false)} />}
      <Footer />
    </main>
  );
}

function CartDrawer({ cartOpen, setCartOpen, cart, setCart, company, zones, zoneId, setZoneId, checkout, setCheckout, fulfillment, setFulfillment, subtotal, discount, deliveryFee, total, finishOrder }: { cartOpen: boolean; setCartOpen: (value: boolean) => void; cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; company: Company; zones: DeliveryZone[]; zoneId: string; setZoneId: (value: string) => void; checkout: CheckoutState; setCheckout: (value: CheckoutState) => void; fulfillment: Fulfillment; setFulfillment: (value: Fulfillment) => void; subtotal: number; discount: number; deliveryFee: number; total: number; finishOrder: () => void }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const cashChangeFor = Number(checkout.cash_change_for) || 0;
  const calculatedChange = checkout.payment_method === "Dinheiro" && cashChangeFor > 0 ? Math.max(0, cashChangeFor - total) : 0;
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
        setCepMessage(`Frete para ${matchedZone.neighborhood}: ${money(matchedZone.fee)}`);
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
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <div><span className="text-sm font-bold text-startt-muted">Seu pedido</span><h2 className="text-2xl font-black leading-tight">Checkout</h2></div>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-startt-soft" onClick={() => setCartOpen(false)} aria-label="Fechar"><X size={20} /></button>
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
              <div className="grid grid-cols-2 gap-2">
                <Select value={checkout.payment_method} onChange={(value) => setCheckout({ ...checkout, payment_method: value as PaymentMethod })}><option>Pix</option><option>Cartão</option><option>Dinheiro</option></Select>
                <Input placeholder="Cupom" value={checkout.coupon} onChange={(value) => setCheckout({ ...checkout, coupon: value })} />
              </div>
              {checkout.payment_method === "Dinheiro" && <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3"><Input type="number" placeholder="Troco para quanto?" value={checkout.cash_change_for} onChange={(value) => setCheckout({ ...checkout, cash_change_for: value })} />{cashChangeFor > 0 && <span className="text-sm font-bold text-startt-muted">Troco para {money(cashChangeFor)} • Troco: {money(calculatedChange)}</span>}</div>}
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
  const [newOrderBadge, setNewOrderBadge] = useState(0);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const lastOrderCount = useRef(bundle.orders.length);
  const user = bundle.users.find((item) => item.id === sessionUserId);
  const allowed = user ? roleAccess[user.role] : [];
  const activeScreen = allowed.includes(screen) ? screen : allowed[0] || "dashboard";

  function announceNewOrder() {
    setNewOrderBadge((count) => count + 1);
    setNewOrderFlash(true);
    notify("info", "Novo pedido recebido.");
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
    if (bundle.orders.length > lastOrderCount.current) announceNewOrder();
    lastOrderCount.current = bundle.orders.length;
  }, [bundle.orders.length]);

  useEffect(() => {
    function onNewOrder(event: Event) {
      const detail = (event as CustomEvent<{ company_id: string }>).detail;
      if (detail?.company_id === company.id) announceNewOrder();
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
      <main className="grid min-h-screen place-items-center bg-startt-paper p-4">
        <form onSubmit={doLogin} className="grid w-[min(460px,100%)] gap-4 rounded-lg border border-black/10 bg-white p-6 shadow-xl">
          <LogoTitle title={`${company.name} Admin`} subtitle="Login da empresa" />
          <Input placeholder="E-mail" value={credentials.email} onChange={(email) => setCredentials({ ...credentials, email })} />
          <input className="min-h-11 rounded-lg border border-black/10 px-3 outline-startt-green" placeholder="Senha" type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} />
          {loginError && <p className="rounded-lg bg-startt-red/10 p-3 text-sm font-bold text-startt-red">{loginError}</p>}
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-startt-green px-4 font-black text-white"><LogIn size={18} /> Entrar</button>
          <p className="text-sm text-startt-muted">Teste: {bundle.users[0]?.email} / 123456</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-startt-paper">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/86 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1280px,100%)] flex-wrap items-center justify-between gap-3">
          <LogoTitle title="Startt Delivery" subtitle={`${company.name} • ${user.name} (${user.role})`} />
          <div className="flex flex-wrap items-center gap-2">
            {newOrderBadge > 0 && <a href={`/${company.slug}/admin/pedidos`} onClick={() => setNewOrderBadge(0)} className={`rounded-lg px-4 py-3 font-black text-white ${newOrderFlash ? "bg-startt-red shadow-xl" : "bg-startt-green"}`}>{newOrderBadge} novo(s) pedido(s)</a>}
            <a className="rounded-xl border border-black/10 bg-white px-4 py-3 font-extrabold shadow-sm" href={`/${company.slug}`}>Ver cardápio</a>
          </div>
        </div>
      </header>
      <section className="mx-auto grid w-[min(1280px,calc(100%-32px))] gap-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="grid gap-1 self-start rounded-2xl border border-black/10 bg-white/90 p-3 shadow-card backdrop-blur lg:sticky lg:top-24">
          {adminNav.filter((item) => allowed.includes(item.id)).map((item) => <a key={item.id} href={`/${company.slug}/admin/${item.id}`} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold transition hover:bg-startt-soft ${activeScreen === item.id ? "bg-startt-green text-white shadow-lg shadow-startt-green/20 hover:bg-startt-green" : "text-startt-ink"}`}>{item.icon}{item.label}</a>)}
          <button onClick={logout} className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-startt-soft px-3 text-sm font-extrabold"><LogOut size={18} /> Sair</button>
        </aside>
        <AdminContent screen={activeScreen} db={db} setDbState={setDbState} company={company} user={user} />
      </section>
      <Footer />
    </main>
  );
}

function AdminContent({ screen, db, setDbState, company, user }: { screen: AdminScreen; db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; user: User }) {
  const bundle = db.getCompanyBundle(company.id);
  const plan = bundle.plan;
  if (screen === "relatorios" && plan && !plan.allow_reports) return <PlanBlocked />;
  if (screen === "impressao" && plan && !plan.allow_printing) return <PlanBlocked />;
  if (screen === "cupons" && plan && !plan.allow_coupons) return <PlanBlocked />;
  if (screen === "dashboard") return <Dashboard company={company} bundle={bundle} />;
  if (screen === "caixa") return <Cashier company={company} user={user} products={bundle.products.filter((item) => item.active)} setDbState={setDbState} />;
  if (screen === "pedidos") return <OrdersManager bundle={bundle} setDbState={setDbState} company={company} user={user} />;
  if (screen === "clientes") return <CustomersManager company={company} customers={bundle.customers} setDbState={setDbState} />;
  if (screen === "produtos") return <ProductsManager company={company} products={bundle.products} categories={bundle.categories} plan={plan} setDbState={setDbState} />;
  if (screen === "categorias") return <CategoriesManager company={company} categories={bundle.categories} setDbState={setDbState} />;
  if (screen === "cupons") return <CouponsManager company={company} coupons={bundle.coupons} plan={plan} setDbState={setDbState} />;
  if (screen === "relatorios") return <Reports company={company} bundle={bundle} />;
  if (screen === "fretes") return <ZonesManager company={company} zones={bundle.delivery_zones} setDbState={setDbState} />;
  if (screen === "impressao") return <PrintManager company={company} settings={bundle.print_settings} setDbState={setDbState} />;
  if (screen === "configuracoes") return <CompanySettings company={company} setDbState={setDbState} />;
  return <UsersManager company={company} users={bundle.users} plan={plan} setDbState={setDbState} />;
}

function PlanBlocked() {
  return <section className="rounded-lg border border-black/10 bg-white p-6"><h1 className="text-3xl font-black">Recurso indisponível</h1><p className="mt-2 text-startt-muted">Seu plano atual não inclui este recurso. Entre em contato com a Startt Facilities.</p></section>;
}

function Dashboard({ company, bundle }: { company: Company; bundle: ReturnType<DatabaseApi["getCompanyBundle"]> }) {
  const [start, setStart] = useState(todayInput());
  const [end, setEnd] = useState(todayInput());
  const online = bundle.orders.filter((item) => isInPeriod(item.created_at, start, end));
  const cash = bundle.cash_sales.filter((item) => isInPeriod(item.created_at, start, end));
  const all = [...online.map((item) => ({ date: item.created_at, total: item.total })), ...cash.map((item) => ({ date: item.created_at, total: item.total }))];
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const salesToday = [...bundle.orders, ...bundle.cash_sales].filter((item) => item.created_at.slice(0, 10) === today).reduce((sum, item) => sum + item.total, 0);
  const salesMonth = [...bundle.orders, ...bundle.cash_sales].filter((item) => item.created_at.slice(0, 7) === month).reduce((sum, item) => sum + item.total, 0);
  const total = all.reduce((sum, item) => sum + item.total, 0);
  const pending = bundle.orders.filter((item) => !["concluido", "cancelado"].includes(item.status)).length;

  function pdf() {
    const byStatus = Object.entries(groupSum(bundle.orders.filter((item) => isInPeriod(item.created_at, start, end)), "status")).map(([status, count]) => `<li>${status}: ${count}</li>`).join("");
    openPrintable("Relatório Dashboard", `<h1>${company.name}</h1><p>Período: ${start} até ${end}</p><p>Total de vendas: ${money(total)}</p><p>Quantidade de pedidos: ${online.length}</p><p>Ticket médio: ${money(total / Math.max(1, all.length))}</p><h2>Pedidos por status</h2><ul>${byStatus}</ul><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`);
  }

  return (
    <section className="grid gap-5">
      <AdminHero company={company} title="Dashboard" description="Resumo operacional da empresa logada." />
      <DateFilters start={start} end={end} setStart={setStart} setEnd={setEnd} onPdf={pdf} />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Vendas do dia" value={money(salesToday)} icon={<CreditCard />} />
        <Metric label="Vendas do mês" value={money(salesMonth)} icon={<BarChart3 />} />
        <Metric label="Pedidos" value={String(online.length)} icon={<ClipboardList />} />
        <Metric label="Ticket médio" value={money(total / Math.max(1, all.length))} icon={<FileText />} />
        <Metric label="Pendentes" value={String(pending)} icon={<Bike />} />
        <Metric label="Produtos ativos" value={String(bundle.products.filter((item) => item.active).length)} icon={<Package />} />
        <Metric label="Clientes" value={String(bundle.customers.length)} icon={<UsersRound />} />
        <Metric label="Caixa presencial" value={money(cash.reduce((sum, item) => sum + item.total, 0))} icon={<CreditCard />} />
      </div>
      <Panel title="Vendas por dia">
        <div className="grid gap-2">{Object.entries(sumByDay(all)).map(([day, value]) => <div key={day} className="flex justify-between rounded-lg bg-startt-soft p-3"><span>{day}</span><b>{money(value)}</b></div>)}</div>
      </Panel>
    </section>
  );
}

function Cashier({ company, user, products, setDbState }: { company: Company; user: User; products: Product[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [cart, setCart] = useState<Array<{ product: Product; qty: number }>>([]);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("Pix");
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const total = Math.max(0, subtotal - discount);
  function add(product: Product) {
    setCart((current) => current.find((item) => item.product.id === product.id) ? current.map((item) => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { product, qty: 1 }]);
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
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title="Caixa presencial">
        <div className="grid gap-3 md:grid-cols-2">{products.map((product) => <button key={product.id} onClick={() => add(product)} className="rounded-lg border border-black/10 bg-white p-4 text-left"><b>{product.name}</b><span className="block text-startt-muted">{money(product.price)}</span></button>)}</div>
      </Panel>
      <Panel title="Carrinho do caixa">
        <div className="grid gap-3">{cart.map((item) => <div key={item.product.id} className="flex justify-between gap-3 border-b border-black/10 pb-2"><span>{item.qty}x {item.product.name}</span><b>{money(item.qty * item.product.price)}</b></div>)}</div>
        <Input placeholder="Desconto manual" value={String(discount)} onChange={(value) => setDiscount(Number(value) || 0)} />
        <Select value={payment} onChange={(value) => setPayment(value as PaymentMethod)}><option>Pix</option><option>Cartão</option><option>Dinheiro</option></Select>
        <Totals subtotal={subtotal} discount={discount} deliveryFee={0} total={total} />
        <button onClick={finish} className="w-full rounded-lg bg-startt-green px-4 py-3 font-black text-white">Finalizar venda</button>
      </Panel>
    </section>
  );
}

const orderStatuses: OrderStatus[] = ["novo", "aceito", "preparando", "saiu_para_entrega", "pronto_para_retirada", "concluido", "cancelado"];

function OrdersManager({ bundle, setDbState, company, user }: { bundle: ReturnType<DatabaseApi["getCompanyBundle"]>; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; company: Company; user: User }) {
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const rows = bundle.orders.filter((order) => (status === "todos" || order.status === status) && (!date || order.created_at.slice(0, 10) === date) && customerName(order.customer_id, bundle.customers).toLowerCase().includes(search.toLowerCase()));
  function update(order: Order, next: OrderStatus) {
    setDbState((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id && item.company_id === company.id ? { ...item, status: next } : item) }));
    notify("success", "Status do pedido atualizado.");
  }
  function remove(order: Order) {
    if (!["dono", "gerente"].includes(user.role)) {
      notify("error", "Seu usuário não tem permissão para excluir pedidos.");
      return;
    }
    if (!confirm(`Excluir pedido #${displayOrderNumber(order)}?`)) return;
    setDbState((current) => ({ ...current, orders: current.orders.filter((item) => !(item.id === order.id && item.company_id === company.id)), order_items: current.order_items.filter((item) => !(item.order_id === order.id && item.company_id === company.id)) }));
    notify("success", "Pedido excluído com sucesso.");
  }
  return (
    <CrudShell title="Pedidos" description="Pedidos recebidos do cardápio online.">
      <div className="grid gap-3 md:grid-cols-3"><Input placeholder="Buscar cliente" value={search} onChange={setSearch} /><Input placeholder="" type="date" value={date} onChange={setDate} /><Select value={status} onChange={setStatus}><option value="todos">Todos</option>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select></div>
      <Table headers={["Pedido", "Cliente", "Status", "Total", "Ações"]} rows={rows.map((order) => [`#${displayOrderNumber(order)}`, customerName(order.customer_id, bundle.customers), order.status, money(order.total), <div className="flex flex-wrap gap-2" key={order.id}><Select value={order.status} onChange={(value) => update(order, value as OrderStatus)}>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select><button className="rounded-lg border px-3 font-bold" onClick={() => printOrder(company, order, bundle)}>Imprimir</button><button className="rounded-lg border px-3 font-bold" onClick={() => sendOrderUpdate(order, customerName(order.customer_id, bundle.customers), company)}>WhatsApp</button>{["dono", "gerente"].includes(user.role) && <button className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white" onClick={() => remove(order)}>Excluir</button>}</div>])} />
    </CrudShell>
  );
}

function printOrder(company: Company, order: Order, bundle: ReturnType<DatabaseApi["getCompanyBundle"]>) {
  const items = bundle.order_items.filter((item) => item.order_id === order.id);
  const rows = items.map((item) => `<tr><td>${item.quantity}x ${item.name}</td><td>${money(item.total)}</td></tr>`).join("");
  const change = order.payment_method === "Dinheiro" && order.cash_change_for ? `<p>Troco para: ${money(order.cash_change_for)}</p><p>Troco: ${money(order.calculated_change || 0)}</p>` : "";
  openPrintable("Pedido", `<h1>${company.name}</h1><p><strong>Pedido:</strong> #${displayOrderNumber(order)}</p><p><strong>Cliente:</strong> ${customerName(order.customer_id, bundle.customers)}</p><p><strong>Status:</strong> ${order.status}</p><table><tr><th>Item</th><th>Total</th></tr>${rows || "<tr><td colspan='2'>Itens não informados</td></tr>"}</table><p>Subtotal: ${money(order.subtotal)}</p><p>Entrega: ${money(order.delivery_fee)}</p>${change}<h2>Total: ${money(order.total)}</h2><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`);
}

function sendOrderUpdate(order: Order, customer: string, company: Company) {
  const message = [`${company.name}`, `Pedido: #${displayOrderNumber(order)}`, `Cliente: ${customer}`, `Status atual: ${order.status}`, `Total: ${money(order.total)}`, order.payment_method === "Dinheiro" && order.cash_change_for ? `Troco para: ${money(order.cash_change_for)} | Troco: ${money(order.calculated_change || 0)}` : ""].filter(Boolean).join("\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  notify("success", "Mensagem de atualização preparada para WhatsApp.");
}

function ProductsManager({ company, products, categories, plan, setDbState }: { company: Company; products: Product[]; categories: Category[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", description: "", ingredients: "", price: "", category_id: categories[0]?.id || "", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80", preparation_time: "10", badge: "", featured: false, active: true };
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
    const product: Product = { id: form.id || id("prd"), company_id: company.id, category_id: form.category_id, name: form.name, description: form.description, ingredients: form.ingredients, price: Number(form.price), image: form.image, preparation_time: Number(form.preparation_time), featured: form.featured, active: form.active, badge: form.badge || undefined };
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
    <CrudShell title="Produtos" description="Cadastrar, editar, excluir e ativar/desativar produtos.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-card">
        <div><strong>{products.length} produtos cadastrados</strong><p className="text-sm text-startt-muted">Limite do plano: {plan?.max_products || "sem limite visível"}</p></div>
        <button onClick={create} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Novo produto</button>
      </div>
      <FormDrawer open={formOpen} title={form.id ? "Editar produto" : "Novo produto"} description="Organize dados comerciais, foto, selo e disponibilidade do item." onClose={() => setFormOpen(false)}>
        <form onSubmit={save} className="grid gap-4">
          <ImageUpload label="Foto do produto" value={form.image} onChange={(value) => setForm({ ...form, image: value })} />
          <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="Preço" value={form.price} onChange={(value) => setForm({ ...form, price: value })} /></div>
          <Select value={form.category_id} onChange={(value) => setForm({ ...form, category_id: value })}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Tempo de preparo" value={form.preparation_time} onChange={(value) => setForm({ ...form, preparation_time: value })} /><Input placeholder="Destaque/selo" value={form.badge} onChange={(value) => setForm({ ...form, badge: value })} /></div>
          <textarea className="min-h-28 rounded-xl border border-startt-border px-3 py-3 text-sm shadow-sm outline-startt-green focus:border-startt-green focus:shadow-input" placeholder="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <textarea className="min-h-24 rounded-xl border border-startt-border px-3 py-3 text-sm shadow-sm outline-startt-green focus:border-startt-green focus:shadow-input" placeholder="Ingredientes" value={form.ingredients} onChange={(event) => setForm({ ...form, ingredients: event.target.value })} />
          <div className="grid gap-2 rounded-2xl bg-startt-paper p-4">
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Produto em destaque</label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Ativo no cardápio</label>
          </div>
          <button disabled={saving} className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20 disabled:opacity-60">{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}</button>
        </form>
      </FormDrawer>
      <Table headers={["Produto", "Categoria", "Preço", "Status", "Ações"]} rows={products.map((product) => [product.name, categoryName(product.category_id, categories), money(product.price), product.active ? "Ativo" : "Inativo", <Actions key={product.id} onEdit={() => edit(product)} onDelete={() => remove(product)} />])} />
    </CrudShell>
  );
}

function CategoriesManager({ company, categories, setDbState }: { company: Company; categories: Category[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  function add() { if (!name.trim()) { notify("error", "Informe o nome da categoria."); return; } if (saving) return; runSave(setSaving, () => { setDbState((current) => ({ ...current, categories: [{ id: id("cat"), company_id: company.id, name, sort_order: categories.length + 1, active: true }, ...current.categories] })); setName(""); }, "Categoria salva com sucesso."); }
  function toggle(category: Category) { runSave(setSaving, () => setDbState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id && item.company_id === company.id ? { ...item, active: !item.active } : item) })), "Categoria atualizada."); }
  function remove(category: Category) { if (confirm(`Excluir ${category.name}?`)) { setDbState((current) => ({ ...current, categories: current.categories.filter((item) => !(item.id === category.id && item.company_id === company.id)) })); notify("success", "Categoria excluída com sucesso."); } }
  return <CrudShell title="Categorias" description="Cadastrar, editar ordem e ativar/desativar categorias."><InlineAdd value={name} setValue={setName} onAdd={add} placeholder="Nova categoria" /><Table headers={["Nome", "Ordem", "Status", "Ações"]} rows={categories.map((category) => [<Input key={category.id} value={category.name} placeholder="Categoria" onChange={(value) => setDbState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, name: value } : item) }))} />, String(category.sort_order), category.active ? "Ativa" : "Inativa", <div key={category.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => toggle(category)}>Ativar/desativar</button><button className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white" onClick={() => remove(category)}>Excluir</button></div>])} /></CrudShell>;
}

function CustomersManager({ company, customers, setDbState }: { company: Company; customers: Customer[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", phone: "", address: "" };
  const [form, setForm] = useState(blank);
  function save(event: React.FormEvent) { event.preventDefault(); const customer: Customer = { id: form.id || id("cus"), company_id: company.id, name: form.name, phone: form.phone, address: form.address, total_spent: 0, last_order_at: "", created_at: new Date().toISOString() }; setDbState((current) => ({ ...current, customers: form.id ? current.customers.map((item) => item.id === form.id && item.company_id === company.id ? { ...item, ...customer, total_spent: item.total_spent, last_order_at: item.last_order_at } : item) : [customer, ...current.customers] })); setForm(blank); }
  return <CrudShell title="Clientes" description="Cadastro manual, edição, exclusão e histórico."><form onSubmit={save} className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-4"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="Telefone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><button className="rounded-lg bg-startt-green px-4 font-black text-white">{form.id ? "Salvar" : "Cadastrar"}</button></form><Table headers={["Cliente", "Telefone", "Endereço", "Total gasto", "Último pedido", "Ações"]} rows={customers.map((customer) => [customer.name, customer.phone, customer.address, money(customer.total_spent), customer.last_order_at ? customer.last_order_at.slice(0, 10) : "-", <Actions key={customer.id} onEdit={() => setForm({ id: customer.id, name: customer.name, phone: customer.phone, address: customer.address })} onDelete={() => confirm("Excluir cliente?") && setDbState((current) => ({ ...current, customers: current.customers.filter((item) => !(item.id === customer.id && item.company_id === company.id)) }))} />])} /></CrudShell>;
}

function CouponsManager({ company, coupons, plan, setDbState }: { company: Company; coupons: Coupon[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { code: "", type: "percentual", value: "", minimum_order: "0", usage_limit: "100", expires_at: "2026-12-31" };
  const [form, setForm] = useState(blank);
  function add() { if (!form.code || !positiveNumber(form.value)) { notify("error", "Informe código e valor válido para o cupom."); return; } if (plan && !plan.allow_coupons) { notify("error", "Seu plano atual não inclui este recurso. Entre em contato com a Startt Facilities."); return; } setDbState((current) => ({ ...current, coupons: [{ id: id("cup"), company_id: company.id, code: form.code.toUpperCase(), type: form.type as Coupon["type"], value: Number(form.value), minimum_order: Number(form.minimum_order), usage_limit: Number(form.usage_limit), used_count: 0, expires_at: form.expires_at, active: true }, ...current.coupons] })); setForm(blank); notify("success", "Cupom criado com sucesso."); }
  function toggle(coupon: Coupon) { setDbState((current) => ({ ...current, coupons: current.coupons.map((item) => item.id === coupon.id && item.company_id === company.id ? { ...item, active: !item.active } : item) })); }
  return <CrudShell title="Cupons" description="Criar, editar, excluir e ativar/desativar cupons."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-6"><Input placeholder="Código" value={form.code} onChange={(value) => setForm({ ...form, code: value })} /><Select value={form.type} onChange={(value) => setForm({ ...form, type: value })}><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></Select><Input placeholder="Valor" value={form.value} onChange={(value) => setForm({ ...form, value })} /><Input placeholder="Pedido mínimo" value={form.minimum_order} onChange={(value) => setForm({ ...form, minimum_order: value })} /><Input placeholder="Limite" value={form.usage_limit} onChange={(value) => setForm({ ...form, usage_limit: value })} /><button onClick={add} className="rounded-lg bg-startt-green px-4 font-black text-white">Criar</button></div><Table headers={["Código", "Tipo", "Valor", "Mínimo", "Uso", "Status", "Ações"]} rows={coupons.map((coupon) => [coupon.code, coupon.type, coupon.type === "percentual" ? `${coupon.value}%` : money(coupon.value), money(coupon.minimum_order), `${coupon.used_count}/${coupon.usage_limit}`, coupon.active ? "Ativo" : "Inativo", <div key={coupon.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => toggle(coupon)}>Ativar/desativar</button><button className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white" onClick={() => setDbState((current) => ({ ...current, coupons: current.coupons.filter((item) => !(item.id === coupon.id && item.company_id === company.id)) }))}>Excluir</button></div>])} /></CrudShell>;
}

function Reports({ company, bundle }: { company: Company; bundle: ReturnType<DatabaseApi["getCompanyBundle"]> }) {
  const [start, setStart] = useState(todayInput());
  const [end, setEnd] = useState(todayInput());
  const [type, setType] = useState("todos");
  const [status, setStatus] = useState("todos");
  const online = bundle.orders.filter((item) => isInPeriod(item.created_at, start, end) && (status === "todos" || item.status === status));
  const cash = bundle.cash_sales.filter((item) => isInPeriod(item.created_at, start, end));
  const entries = type === "online" ? online.map((item) => ({ id: item.id, tipo: "Online", total: item.total, date: item.created_at, status: item.status })) : type === "caixa" ? cash.map((item) => ({ id: item.id, tipo: "Caixa", total: item.total, date: item.created_at, status: "concluido" })) : [...online.map((item) => ({ id: item.id, tipo: "Online", total: item.total, date: item.created_at, status: item.status })), ...cash.map((item) => ({ id: item.id, tipo: "Caixa", total: item.total, date: item.created_at, status: "concluido" }))];
  const total = entries.reduce((sum, item) => sum + item.total, 0);
  function pdf() { openPrintable("Relatório", `<h1>${company.name}</h1><p>Período: ${start} até ${end}</p><p>Tipo: ${type}</p><p>Total: ${money(total)}</p><p>Quantidade: ${entries.length}</p><p>Ticket médio: ${money(total / Math.max(1, entries.length))}</p><table><tr><th>ID</th><th>Tipo</th><th>Status</th><th>Total</th></tr>${entries.map((item) => `<tr><td>${item.id}</td><td>${item.tipo}</td><td>${item.status}</td><td>${money(item.total)}</td></tr>`).join("")}</table><p class="signature">Startt Delivery — produzido por Startt Facilities</p>`); }
  return <CrudShell title="Relatórios" description="Filtros por período, tipo, status e exportação PDF."><div className="grid gap-3 md:grid-cols-5"><Input type="date" placeholder="" value={start} onChange={setStart} /><Input type="date" placeholder="" value={end} onChange={setEnd} /><Select value={type} onChange={setType}><option value="todos">Todos</option><option value="online">Pedidos online</option><option value="caixa">Caixa presencial</option></Select><Select value={status} onChange={setStatus}><option value="todos">Todos status</option>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</Select><button onClick={pdf} className="rounded-lg bg-startt-green px-4 font-black text-white">Exportar PDF</button></div><div className="grid gap-4 md:grid-cols-3"><Metric label="Total" value={money(total)} icon={<CreditCard />} /><Metric label="Quantidade" value={String(entries.length)} icon={<ClipboardList />} /><Metric label="Ticket médio" value={money(total / Math.max(1, entries.length))} icon={<FileText />} /></div><Table headers={["ID", "Tipo", "Status", "Data", "Total"]} rows={entries.map((item) => [item.id, item.tipo, item.status, item.date.slice(0, 10), money(item.total)])} /></CrudShell>;
}

function ZonesManager({ company, zones, setDbState }: { company: Company; zones: DeliveryZone[]; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [form, setForm] = useState({ neighborhood: "", fee: "", estimated_minutes: "" });
  function add() { if (!form.neighborhood || !positiveNumber(form.fee)) { notify("error", "Informe bairro e valor de frete válido."); return; } setDbState((current) => ({ ...current, delivery_zones: [{ id: id("zon"), company_id: company.id, neighborhood: form.neighborhood, fee: Number(form.fee), estimated_minutes: form.estimated_minutes, active: true }, ...current.delivery_zones] })); setForm({ neighborhood: "", fee: "", estimated_minutes: "" }); notify("success", "Frete cadastrado com sucesso."); }
  return <CrudShell title="Fretes" description="Bairros ativos aparecem no checkout público e aplicam frete automaticamente."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-4"><Input placeholder="Bairro" value={form.neighborhood} onChange={(value) => setForm({ ...form, neighborhood: value })} /><Input placeholder="Valor do frete" value={form.fee} onChange={(value) => setForm({ ...form, fee: value })} /><Input placeholder="Tempo estimado" value={form.estimated_minutes} onChange={(value) => setForm({ ...form, estimated_minutes: value })} /><button onClick={add} className="rounded-lg bg-startt-green px-4 font-black text-white">Cadastrar</button></div><Table headers={["Bairro", "Frete", "Tempo", "Status", "Ações"]} rows={zones.map((zone) => [zone.neighborhood, money(zone.fee), zone.estimated_minutes, zone.active ? "Ativo" : "Inativo", <button key={zone.id} className="rounded-lg border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, delivery_zones: current.delivery_zones.map((item) => item.id === zone.id && item.company_id === company.id ? { ...item, active: !item.active } : item) }))}>Ativar/desativar</button>])} /></CrudShell>;
}

function PrintManager({ company, settings, setDbState }: { company: Company; settings?: PrintSettings; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const fallback: PrintSettings = { company_id: company.id, auto_print_orders: false, auto_print_cash_sales: false, printer_name: "", paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" };
  const [form, setForm] = useState(settings || fallback);
  function save() { setDbState((current) => ({ ...current, print_settings: current.print_settings.some((item) => item.company_id === company.id) ? current.print_settings.map((item) => item.company_id === company.id ? form : item) : [...current.print_settings, form] })); }
  return <CrudShell title="Impressão" description="Modo normal usa window.print(). Futuro modo avançado pode usar QZ Tray."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-2"><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.auto_print_orders} onChange={(e) => setForm({ ...form, auto_print_orders: e.target.checked })} /> Imprimir novos pedidos</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.auto_print_cash_sales} onChange={(e) => setForm({ ...form, auto_print_cash_sales: e.target.checked })} /> Imprimir vendas do caixa</label><Input placeholder="Nome da impressora" value={form.printer_name} onChange={(value) => setForm({ ...form, printer_name: value })} /><Select value={form.paper_width} onChange={(value) => setForm({ ...form, paper_width: value as "58mm" | "80mm" })}><option>58mm</option><option>80mm</option></Select><Input placeholder="Quantidade de vias" value={String(form.copies)} onChange={(value) => setForm({ ...form, copies: Number(value) || 1 })} /><Input placeholder="Rodapé" value={form.footer_text} onChange={(value) => setForm({ ...form, footer_text: value })} /><button onClick={save} className="rounded-lg bg-startt-green px-4 py-3 font-black text-white">Salvar configuração</button><button onClick={() => openPrintable("Teste de impressão", `<h1>${company.name}</h1><p>Teste ${form.paper_width}</p><p>${form.footer_text}</p>`)} className="rounded-lg border border-black/10 bg-white px-4 py-3 font-black">Testar impressão</button></div></CrudShell>;
}

function CompanySettings({ company, setDbState }: { company: Company; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [form, setForm] = useState(company);
  const [saving, setSaving] = useState(false);
  function save() { if (saving) return; runSave(setSaving, () => setDbState((current) => ({ ...current, companies: current.companies.map((item) => item.id === company.id ? { ...form, hero_image: form.banner_url || form.hero_image } : item) })), "Configurações salvas com sucesso."); }
  return (
    <CrudShell title="Configurações" description="Essas configs alteram o cardápio público da empresa.">
      <div className="grid gap-5 rounded-2xl border border-black/10 bg-white p-4 shadow-card">
        <div className="grid gap-4 lg:grid-cols-2">
          <ImageUpload label="Logo da loja" value={form.logo_url} onChange={(value) => setForm({ ...form, logo_url: value })} />
          <ImageUpload label="Banner do cardápio" value={form.banner_url || form.hero_image} onChange={(value) => setForm({ ...form, banner_url: value, hero_image: value })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Nome da empresa" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} />
          <Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
          <Input placeholder="Pedido mínimo" value={String(form.minimum_order)} onChange={(value) => setForm({ ...form, minimum_order: Number(value) || 0 })} />
          <Input placeholder="Tempo estimado" value={form.estimated_delivery_time} onChange={(value) => setForm({ ...form, estimated_delivery_time: value })} />
          <Input placeholder="Cor principal" value={form.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} />
          <Input placeholder="Horário de funcionamento" value={form.opening_hours} onChange={(value) => setForm({ ...form, opening_hours: value })} />
          <Input placeholder="Mensagem de rodapé" value={form.footer_message} onChange={(value) => setForm({ ...form, footer_message: value })} />
        </div>
        <div className="flex flex-wrap gap-4 rounded-2xl bg-startt-paper p-4">
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} /> Aberto</label>
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.delivery_enabled} onChange={(e) => setForm({ ...form, delivery_enabled: e.target.checked })} /> Permitir entrega</label>
          <label className="flex gap-2 font-bold"><input type="checkbox" checked={form.pickup_enabled} onChange={(e) => setForm({ ...form, pickup_enabled: e.target.checked })} /> Permitir retirada</label>
        </div>
        <button disabled={saving} onClick={save} className="w-fit rounded-xl bg-startt-green px-4 py-3 font-black text-white shadow-lg shadow-startt-green/20 disabled:opacity-60">{saving ? "Salvando..." : "Salvar configurações"}</button>
      </div>
    </CrudShell>
  );
}

function UsersManager({ company, users, plan, setDbState }: { company: Company; users: User[]; plan?: Plan; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { name: "", email: "", password: "123456", role: "atendente" as UserRole };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  function add() { if (saving) return; if (!form.name || !form.email || !form.password) { notify("error", "Informe nome, e-mail e senha do usuário."); return; } if (!company.is_registration_enabled) { notify("error", "Cadastro/acesso temporariamente desativado."); return; } if (plan && users.length >= plan.max_users) { notify("error", "Limite de usuários do plano atingido. Entre em contato com a Startt Facilities."); return; } runSave(setSaving, () => { setDbState((current) => ({ ...current, users: [{ id: id("usr"), company_id: company.id, name: form.name, email: form.email, password: form.password, role: form.role, is_active: true, created_at: new Date().toISOString() }, ...current.users] })); setForm(blank); }, "Usuário criado com sucesso."); }
  function toggle(user: User) { runSave(setSaving, () => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id && item.company_id === company.id ? { ...item, is_active: !item.is_active } : item) })), user.is_active ? "Usuário bloqueado com sucesso." : "Usuário desbloqueado com sucesso."); }
  function reset(user: User) { if (!confirm(`Redefinir senha de ${user.name}?`)) return; const password = prompt("Nova senha", "123456"); if (password) runSave(setSaving, () => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id && item.company_id === company.id ? { ...item, password } : item) })), "Senha redefinida com sucesso."); }
  return <CrudShell title="Usuários" description="Usuários internos e funções por empresa."><div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 md:grid-cols-5"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="E-mail" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input placeholder="Senha" value={form.password} onChange={(value) => setForm({ ...form, password: value })} /><Select value={form.role} onChange={(value) => setForm({ ...form, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><button onClick={add} className="rounded-lg bg-startt-green px-4 font-black text-white">Criar</button></div><Table headers={["Nome", "E-mail", "Função", "Status", "Ações"]} rows={users.map((user) => [user.name, user.email, user.role, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => reset(user)}>Redefinir senha</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => toggle(user)}>Ativar/bloquear</button></div>])} /></CrudShell>;
}

function MasterApp({ db, setDbState, screen, login }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>; screen: MasterScreen; login: boolean }) {
  const [session, setSession] = useState(() => localStorage.getItem(MASTER_SESSION_KEY));
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [masterError, setMasterError] = useState("");
  function doLogin(event: React.FormEvent) { event.preventDefault(); const found = db.master_users.find((user) => user.email === credentials.email && user.password === credentials.password && user.is_active); if (!found) { setMasterError("Login master inválido ou bloqueado."); return; } setMasterError(""); localStorage.setItem(MASTER_SESSION_KEY, found.id); setSession(found.id); window.history.pushState({}, "", "/master"); }
  if (!session) return <main className="grid min-h-screen place-items-center bg-startt-paper p-4"><form onSubmit={doLogin} className="grid w-[min(460px,100%)] gap-4 rounded-lg border border-black/10 bg-white p-6 shadow-xl"><LogoTitle title="Admin Master" subtitle="Startt Delivery SaaS" /><Input placeholder="E-mail" value={credentials.email} onChange={(email) => setCredentials({ ...credentials, email })} /><input className="min-h-11 rounded-lg border border-black/10 px-3 outline-startt-green" placeholder="Senha" type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />{masterError && <p className="rounded-lg bg-startt-red/10 p-3 text-sm font-bold text-startt-red">{masterError}</p>}<button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-startt-green px-4 font-black text-white"><ShieldCheck size={18} /> Entrar</button><p className="text-sm text-startt-muted">master@startt.com / 123456</p></form></main>;
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
  const emptyForm = { id: "", name: "", slug: "", whatsapp: "", address: "", status: "trial" as CompanyStatus, plan_id: firstPlan?.id || "", primary_color: "#116a4b", monthly_price: String(firstPlan?.monthly_price || 49.9), due_day: "10", next_due_date: todayInput(), subscription_status: "trialing" as SubscriptionStatus, is_registration_enabled: true, admin_email: "", payment_notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  function selectedPlan(planId = form.plan_id) { return db.plans.find((plan) => plan.id === planId) || firstPlan; }
  function startCreate() { setForm(emptyForm); setFormOpen(true); }
  function startEdit(company: Company) { setForm({ id: company.id, name: company.name, slug: company.slug, whatsapp: company.whatsapp, address: company.address, status: company.status, plan_id: company.plan_id, primary_color: company.primary_color, monthly_price: String(company.monthly_price), due_day: String(company.due_day), next_due_date: company.next_due_date, subscription_status: company.subscription_status, is_registration_enabled: company.is_registration_enabled, admin_email: "", payment_notes: company.payment_notes }); setFormOpen(true); }
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
    const plan = selectedPlan();
    const created = new Date().toISOString();
    const companyId = form.id || id("cmp");
    const previous = db.companies.find((item) => item.id === form.id);
    const company: Company = { id: companyId, name: form.name, slug: form.slug, logo_url: previous?.logo_url || "", banner_url: previous?.banner_url || previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80", whatsapp: form.whatsapp, address: form.address, hero_image: previous?.hero_image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80", primary_color: form.primary_color, minimum_order: previous?.minimum_order || 25, estimated_delivery_time: previous?.estimated_delivery_time || "35-45 min", is_open: previous?.is_open ?? true, delivery_enabled: previous?.delivery_enabled ?? true, pickup_enabled: previous?.pickup_enabled ?? true, status: form.status, plan: plan?.name || "Start", is_registration_enabled: form.is_registration_enabled, plan_id: form.plan_id, subscription_status: form.subscription_status, monthly_price: Number(form.monthly_price), due_day: Number(form.due_day), next_due_date: form.next_due_date, last_payment_date: previous?.last_payment_date || "", payment_notes: form.payment_notes, footer_message: previous?.footer_message || "produzido por Startt Facilities", opening_hours: previous?.opening_hours || "Aberto hoje", created_at: previous?.created_at || created };
    setDbState((current) => ({ ...current, companies: form.id ? current.companies.map((item) => item.id === form.id ? company : item) : [company, ...current.companies], settings: form.id ? current.settings : [{ id: id("set"), company_id: companyId, critical_locked: false }, ...current.settings], print_settings: form.id ? current.print_settings : [{ company_id: companyId, auto_print_orders: false, auto_print_cash_sales: false, printer_name: "", paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" }, ...current.print_settings], users: !form.id && form.admin_email ? [{ id: id("usr"), company_id: companyId, name: "Admin inicial", email: form.admin_email, password: "123456", role: "dono", is_active: true, created_at: created }, ...current.users] : current.users }));
    setFormOpen(false);
    notify("success", form.id ? "Empresa atualizada com sucesso." : "Empresa criada com sucesso.");
  }
  function updateCompany(companyId: string, patch: Partial<Company>) { setDbState((current) => ({ ...current, companies: current.companies.map((company) => company.id === companyId ? { ...company, ...patch } : company) })); notify("success", "Empresa atualizada."); }
  function deleteCompany(company: Company) { if (!confirm(`Excluir ${company.name} e TODOS os dados vinculados?`)) return; setDbState((current) => ({ ...current, companies: current.companies.filter((item) => item.id !== company.id), users: current.users.filter((item) => item.company_id !== company.id), categories: current.categories.filter((item) => item.company_id !== company.id), products: current.products.filter((item) => item.company_id !== company.id), orders: current.orders.filter((item) => item.company_id !== company.id), order_items: current.order_items.filter((item) => item.company_id !== company.id), customers: current.customers.filter((item) => item.company_id !== company.id), delivery_zones: current.delivery_zones.filter((item) => item.company_id !== company.id), coupons: current.coupons.filter((item) => item.company_id !== company.id), settings: current.settings.filter((item) => item.company_id !== company.id), cash_sales: current.cash_sales.filter((item) => item.company_id !== company.id), print_settings: current.print_settings.filter((item) => item.company_id !== company.id), reports: current.reports.filter((item) => item.company_id !== company.id) })); notify("success", "Empresa e dados vinculados foram excluídos."); }
  return <CrudShell title="Empresas" description="CRUD completo, controle de acesso e financeiro por empresa."><div className="flex flex-wrap justify-end gap-2"><button onClick={startCreate} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20"><Plus size={18} /> Nova empresa</button></div><FormDrawer open={formOpen} title={form.id ? "Editar empresa" : "Nova empresa"} description="Controle dados comerciais, plano, assinatura e usuário inicial da lancheria." onClose={() => setFormOpen(false)}><form onSubmit={saveCompany} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} /><Input placeholder="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} /><Input placeholder="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><Select value={form.status} onChange={(value) => setForm({ ...form, status: value as CompanyStatus })}><option>trial</option><option>active</option><option>blocked</option><option>canceled</option></Select><Select value={form.plan_id} onChange={(value) => { const plan = selectedPlan(value); setForm({ ...form, plan_id: value, monthly_price: String(plan?.monthly_price || form.monthly_price) }); }}>{db.plans.filter((plan) => plan.is_active || plan.id === form.plan_id).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select><Input placeholder="Cor principal" value={form.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} /><Input placeholder="Valor mensal" value={form.monthly_price} onChange={(value) => setForm({ ...form, monthly_price: value })} /><Input placeholder="Dia vencimento" value={form.due_day} onChange={(value) => setForm({ ...form, due_day: value })} /><Input type="date" placeholder="Próxima data" value={form.next_due_date} onChange={(value) => setForm({ ...form, next_due_date: value })} /><Select value={form.subscription_status} onChange={(value) => setForm({ ...form, subscription_status: value as SubscriptionStatus })}><option>trialing</option><option>active</option><option>overdue</option><option>canceled</option></Select><Input placeholder="Admin inicial opcional" value={form.admin_email} onChange={(value) => setForm({ ...form, admin_email: value })} /></div><Input placeholder="Observações financeiras" value={form.payment_notes} onChange={(value) => setForm({ ...form, payment_notes: value })} /><label className="flex items-center gap-2 rounded-2xl bg-startt-paper p-4 font-bold"><input type="checkbox" checked={form.is_registration_enabled} onChange={(event) => setForm({ ...form, is_registration_enabled: event.target.checked })} /> Cadastro/acesso habilitado</label><button className="min-h-12 rounded-xl bg-startt-green px-4 font-black text-white shadow-lg shadow-startt-green/20">{form.id ? "Salvar alterações" : "Criar empresa"}</button></form></FormDrawer><Table headers={["Empresa", "Slug", "Plano", "Assinatura", "Mensal", "Vencimento", "Ações"]} rows={db.companies.map((company) => [company.name, `/${company.slug}`, db.plans.find((plan) => plan.id === company.plan_id)?.name || company.plan, company.subscription_status, money(company.monthly_price), `${company.due_day} • ${company.next_due_date}`, <div key={company.id} className="flex flex-wrap gap-2"><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => startEdit(company)}>Editar</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: company.status === "blocked" ? "active" : "blocked" })}>{company.status === "blocked" ? "Desbloquear" : "Bloquear"}</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { subscription_status: "active", status: company.status === "blocked" ? "active" : company.status, last_payment_date: todayInput(), payment_notes: "Marcado como pago pelo Master." })}>Marcar pago</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { subscription_status: "overdue", payment_notes: "Marcado como inadimplente pelo Master." })}>Inadimplente</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: "canceled", subscription_status: "canceled" })}>Cancelar</button><button className="rounded-xl border px-3 py-2 font-bold" onClick={() => updateCompany(company.id, { status: "active", subscription_status: "active" })}>Reativar</button><a className="rounded-xl border px-3 py-2 font-bold" href={`/${company.slug}/admin`}>Simular</a><button className="rounded-xl bg-startt-red px-3 py-2 font-bold text-white" onClick={() => deleteCompany(company)}>Excluir</button></div>])} /></CrudShell>;
}

function MasterUsers({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const [companyId, setCompanyId] = useState("todos");
  const [form, setForm] = useState({ company_id: db.companies[0]?.id || "", name: "", email: "", password: "123456", role: "dono" as UserRole });
  const users = db.users.filter((user) => companyId === "todos" || user.company_id === companyId);
  function addUser() { if (!form.email || !form.company_id) return; setDbState((current) => ({ ...current, users: [{ id: id("usr"), company_id: form.company_id, name: form.name, email: form.email, password: form.password, role: form.role, is_active: true, created_at: new Date().toISOString() }, ...current.users] })); setForm({ ...form, name: "", email: "", password: "123456" }); }
  return <CrudShell title="Usuários" description="Usuários de todas as empresas, com filtro, criação, bloqueio e redefinição de senha."><div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6"><Select value={form.company_id} onChange={(value) => setForm({ ...form, company_id: value })}>{db.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="E-mail" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input placeholder="Senha" value={form.password} onChange={(value) => setForm({ ...form, password: value })} /><Select value={form.role} onChange={(value) => setForm({ ...form, role: value as UserRole })}>{(["dono", "gerente", "caixa", "atendente"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}</Select><button onClick={addUser} className="rounded-lg bg-startt-green px-4 font-black text-white">Criar usuário</button></div><Select value={companyId} onChange={setCompanyId}><option value="todos">Todas as empresas</option>{db.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select><Table headers={["Nome", "E-mail", "Empresa", "Função", "Status", "Ações"]} rows={users.map((user) => [user.name, user.email, db.companies.find((c) => c.id === user.company_id)?.name || "-", user.role, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, is_active: !item.is_active } : item) }))}>Ativar/bloquear</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => { const password = prompt("Nova senha", "123456"); if (password) setDbState((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, password } : item) })); }}>Redefinir senha</button></div>])} /></CrudShell>;
}

function MasterPlans({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  const blank = { id: "", name: "", monthly_price: "", max_products: "30", max_users: "3", allow_reports: false, allow_printing: false, allow_coupons: false, is_active: true };
  const [form, setForm] = useState(blank);
  function edit(plan: Plan) { setForm({ id: plan.id, name: plan.name, monthly_price: String(plan.monthly_price), max_products: String(plan.max_products), max_users: String(plan.max_users), allow_reports: plan.allow_reports, allow_printing: plan.allow_printing, allow_coupons: plan.allow_coupons, is_active: plan.is_active }); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !positiveNumber(form.monthly_price) || !positiveNumber(form.max_products) || !positiveNumber(form.max_users)) {
      notify("error", "Informe nome, preço e limites válidos para o plano.");
      return;
    }
    const plan: Plan = { id: form.id || id("plan"), name: form.name, monthly_price: Number(form.monthly_price), max_products: Number(form.max_products), max_users: Number(form.max_users), allow_reports: form.allow_reports, allow_printing: form.allow_printing, allow_coupons: form.allow_coupons, is_active: form.is_active };
    setDbState((current) => ({ ...current, plans: form.id ? current.plans.map((item) => item.id === form.id ? plan : item) : [plan, ...current.plans] }));
    setForm(blank);
    notify("success", form.id ? "Plano atualizado com sucesso." : "Plano criado com sucesso.");
  }
  function remove(plan: Plan) {
    if (db.companies.some((company) => company.plan_id === plan.id)) { notify("error", "Plano em uso não pode ser excluído."); return; }
    if (!confirm(`Excluir plano ${plan.name}?`)) return;
    setDbState((current) => ({ ...current, plans: current.plans.filter((item) => item.id !== plan.id) }));
    notify("success", "Plano excluído com sucesso.");
  }
  return <CrudShell title="Planos" description="Criar, editar, desativar e excluir planos não usados."><form onSubmit={save} className="grid gap-3 rounded-lg border bg-white p-4"><div className="grid gap-3 md:grid-cols-5"><Input placeholder="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input placeholder="Preço mensal" value={form.monthly_price} onChange={(value) => setForm({ ...form, monthly_price: value })} /><Input placeholder="Máx. produtos" value={form.max_products} onChange={(value) => setForm({ ...form, max_products: value })} /><Input placeholder="Máx. usuários" value={form.max_users} onChange={(value) => setForm({ ...form, max_users: value })} /><button className="rounded-lg bg-startt-green px-4 font-black text-white">{form.id ? "Salvar plano" : "Criar plano"}</button></div><div className="flex flex-wrap gap-4"><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_reports} onChange={(event) => setForm({ ...form, allow_reports: event.target.checked })} /> Relatórios</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_printing} onChange={(event) => setForm({ ...form, allow_printing: event.target.checked })} /> Impressão</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.allow_coupons} onChange={(event) => setForm({ ...form, allow_coupons: event.target.checked })} /> Cupons</label><label className="flex gap-2 font-bold"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Ativo</label></div></form><Table headers={["Plano", "Preço", "Produtos", "Usuários", "Recursos", "Status", "Ações"]} rows={db.plans.map((plan) => [plan.name, money(plan.monthly_price), String(plan.max_products), String(plan.max_users), `${plan.allow_reports ? "Relatórios " : ""}${plan.allow_printing ? "Impressão " : ""}${plan.allow_coupons ? "Cupons" : ""}` || "Básico", plan.is_active ? "Ativo" : "Inativo", <div key={plan.id} className="flex gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => edit(plan)}>Editar</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => setDbState((current) => ({ ...current, plans: current.plans.map((item) => item.id === plan.id ? { ...item, is_active: !item.is_active } : item) }))}>Ativar/desativar</button><button className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white" onClick={() => remove(plan)}>Excluir</button></div>])} /></CrudShell>;
}

function MasterUserControls({ db, setDbState }: { db: DatabaseApi; setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>> }) {
  function updateMaster(userId: string, patch: Partial<MockDatabaseState["master_users"][number]>) {
    setDbState((current) => ({ ...current, master_users: current.master_users.map((user) => user.id === userId ? { ...user, ...patch } : user) }));
    notify("success", "Usuário master atualizado com sucesso.");
  }
  function resetMaster(userId: string) {
    if (!confirm("Redefinir senha deste usuário master?")) return;
    const password = prompt("Nova senha", "123456");
    if (!password) return;
    updateMaster(userId, { password });
  }
  return <CrudShell title="Acessos Master" description="Controle de login, senha e bloqueio dos usuários master."><Table headers={["Nome", "E-mail", "Status", "Ações"]} rows={db.master_users.map((user) => [user.name, <Input key={`${user.id}-email`} value={user.email} placeholder="E-mail" onChange={(email) => updateMaster(user.id, { email })} />, user.is_active ? "Ativo" : "Bloqueado", <div key={user.id} className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => resetMaster(user.id)}>Redefinir senha</button><button className="rounded-lg border px-3 py-2 font-bold" onClick={() => updateMaster(user.id, { is_active: !user.is_active })}>{user.is_active ? "Bloquear" : "Desbloquear"}</button></div>])} /></CrudShell>;
}

function ProductCard({ product, category, onOpen, onAdd }: { product: Product; category: string; onOpen: () => void; onAdd: () => void }) {
  return <article onClick={onOpen} className="sd-card-lift grid cursor-pointer overflow-hidden rounded-2xl border border-black/10 bg-white shadow-card"><div className="relative h-52 overflow-hidden"><img className="h-full w-full object-cover transition duration-500 hover:scale-105" src={product.image} alt={product.name} onError={(event) => { event.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"; }} />{product.badge && <span className="absolute left-3 top-3 rounded-full bg-startt-yellow px-3 py-1 text-xs font-black shadow-lg">{product.badge}</span>}<span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-startt-green shadow">{product.preparation_time} min</span></div><div className="grid gap-4 p-4"><div><p className="mb-1 text-xs font-black uppercase text-startt-green">{category}</p><h3 className="text-xl font-black leading-tight">{product.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-startt-muted">{product.description}</p></div><div className="flex items-center justify-between"><strong className="text-xl">{money(product.price)}</strong><button onClick={(event) => { event.stopPropagation(); onAdd(); }} aria-label={`Adicionar ${product.name}`} className="grid h-11 w-11 place-items-center rounded-xl bg-startt-green text-white shadow-lg shadow-startt-green/20"><Plus size={18} /></button></div></div></article>;
}

function ProductModal({ product, category, onClose, onAdd }: { product: Product; category: string; onClose: () => void; onAdd: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar produto" />
      <section className="relative grid max-h-[92vh] w-[min(720px,100%)] overflow-hidden rounded-lg bg-white shadow-2xl animate-in zoom-in-95 duration-200 md:grid-cols-[280px_1fr]">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-lg bg-white/95 shadow" aria-label="Fechar"><X size={20} /></button>
        <img className="h-64 w-full object-cover md:h-full" src={product.image} alt={product.name} onError={(event) => { event.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"; }} />
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
        {company.logo_url ? <img className="mx-auto h-20 w-20 rounded-lg object-cover" src={company.logo_url} alt={company.name} /> : <span className="mx-auto grid h-20 w-20 place-items-center rounded-lg bg-startt-green text-4xl font-black text-white">S</span>}
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

function CrudShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5"><div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-card backdrop-blur"><span className="text-xs font-black uppercase text-startt-green">Admin</span><h1 className="mt-1 text-3xl font-black md:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-startt-muted">{description}</p></div>{children}</section>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-card"><h2 className="text-lg font-black">{title}</h2>{children}</section>; }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <input type={type} className="min-h-12 rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />; }
function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <select className="min-h-12 rounded-xl border border-startt-border bg-white px-3 text-sm shadow-sm outline-startt-green transition focus:border-startt-green focus:shadow-input" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>; }
function Toggle({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) { return <button disabled={disabled} onClick={onClick} className={`min-h-12 rounded-xl border px-3 font-black disabled:opacity-40 ${active ? "border-startt-green bg-startt-green text-white shadow-lg shadow-startt-green/20" : "border-startt-border bg-white"}`}>{children}</button>; }
function Table({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) { return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-card"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-startt-soft text-xs uppercase text-startt-muted"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i} className="sd-tr border-t border-black/10">{row.map((cell, j) => <td key={j} className="p-4 align-middle">{cell}</td>)}</tr>) : <tr className="border-t border-black/10"><td className="p-8 text-center text-startt-muted" colSpan={headers.length}>Nenhum registro encontrado ainda.</td></tr>}</tbody></table></div></div>; }
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
function ImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [dragging, setDragging] = useState(false);
  async function applyFile(file?: File) {
    if (!file) return;
    try {
      onChange(await readImageAsDataUrl(file));
      notify("success", "Imagem carregada com preview local.");
    } catch {
      notify("error", "Envie um arquivo de imagem válido.");
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
            <strong className="inline-flex items-center gap-2 text-startt-ink"><UploadCloud size={18} /> Arraste uma imagem ou toque para escolher</strong>
            <span>Funciona com galeria do celular, drag and drop no desktop e salva como Base64 quando não houver storage.</span>
          </div>
        </div>
      </label>
      <Input placeholder="Ou cole uma URL de imagem" value={value} onChange={onChange} />
    </div>
  );
}
function Totals({ subtotal, discount, deliveryFee, total }: { subtotal: number; discount: number; deliveryFee: number; total: number }) { return <div className="grid gap-1 text-sm"><span className="flex justify-between">Subtotal <b>{money(subtotal)}</b></span><span className="flex justify-between">Desconto <b>-{money(discount)}</b></span><span className="flex justify-between">Entrega <b>{money(deliveryFee)}</b></span><strong className="flex justify-between text-base">Total <b>{money(total)}</b></strong></div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-4"><span className="grid h-11 w-11 place-items-center rounded-lg bg-startt-soft text-startt-green">{icon}</span><div><strong className="block text-2xl">{value}</strong><small className="text-startt-muted">{label}</small></div></article>; }
function AdminHero({ company, title, description }: { company?: Company; title: string; description: string }) { return <div className="relative isolate flex min-h-64 items-end overflow-hidden rounded-lg p-6 text-white"><img className="absolute inset-0 -z-20 h-full w-full object-cover" src={company?.hero_image || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80"} alt="" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 to-black/25" /><div><span className="inline-flex items-center gap-2 text-sm font-black uppercase text-startt-yellow"><Building2 size={16} /> {company?.slug || "master"}</span><h1 className="mt-2 text-4xl font-black md:text-6xl">{title}</h1><p className="mt-2 max-w-2xl text-white/90">{description}</p></div></div>; }
function LogoTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-startt-green text-2xl font-black text-white">S</span><span><strong className="block leading-tight">{title}</strong><small className="block text-startt-muted">{subtitle}</small></span></div>; }
function StatusCard({ company }: { company: Company }) { return <div className="flex gap-3 rounded-lg border border-black/10 bg-white p-4"><span className={`mt-1 h-3 w-3 rounded-full ${company.is_open ? "bg-startt-lime" : "bg-startt-red"}`} /><div><strong className="block">{company.is_open ? "Loja aberta" : "Loja fechada"}</strong><span className="text-sm leading-6 text-startt-muted">{company.address}</span></div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`flex min-h-11 items-center justify-between rounded-lg px-3 font-extrabold ${active ? "bg-startt-green text-white" : "bg-startt-soft"}`}>{children}<ChevronRight size={16} /></button>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center content-center gap-2 text-center text-startt-muted"><ShoppingBag size={32} /><strong className="text-startt-ink">{text}</strong></div>; }
function DateFilters({ start, end, setStart, setEnd, onPdf }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void; onPdf: () => void }) { return <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3"><Input type="date" placeholder="" value={start} onChange={setStart} /><Input type="date" placeholder="" value={end} onChange={setEnd} /><button onClick={onPdf} className="rounded-lg bg-startt-green px-4 font-black text-white">Emitir PDF do relatório</button></div>; }
function Footer() { return <footer className="border-t border-black/10 px-4 py-6 text-center text-sm font-bold text-startt-muted">Startt Delivery — produzido por Startt Facilities</footer>; }
function NotFound({ message }: { message: string }) { return <main className="grid min-h-screen place-items-center bg-startt-paper p-4"><section className="rounded-lg border bg-white p-6 text-center shadow-xl"><h1 className="text-3xl font-black">{message}</h1><a href="/" className="mt-5 inline-flex rounded-lg bg-startt-green px-4 py-3 font-black text-white">Voltar</a></section></main>; }
function Suspended({ company, publicView = false, message }: { company: Company; publicView?: boolean; message?: string }) { return <main className="grid min-h-screen place-items-center bg-startt-paper p-4"><section className="max-w-lg rounded-lg border bg-white p-6 text-center shadow-xl"><h1 className="text-3xl font-black">Acesso suspenso</h1><p className="mt-3 text-startt-muted">{message || `${company.name} está com acesso suspenso. Entre em contato com a Startt Facilities.`} {publicView ? "O cardápio está temporariamente indisponível." : ""}</p></section></main>; }
function categoryName(id: string, categories: Category[]) { return categories.find((item) => item.id === id)?.name || "-"; }
function customerName(id: string, customers: Customer[]) { return customers.find((item) => item.id === id)?.name || "Cliente"; }
function groupSum<T extends Record<string, unknown>>(items: T[], key: keyof T) { return items.reduce<Record<string, number>>((acc, item) => { const value = String(item[key]); acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function sumByDay(items: Array<{ date: string; total: number }>) { return items.reduce<Record<string, number>>((acc, item) => { const day = item.date.slice(0, 10); acc[day] = (acc[day] || 0) + item.total; return acc; }, {}); }

createRoot(document.getElementById("root")!).render(<App />);
