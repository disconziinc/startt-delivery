import { STARTT_EMERGENCY_MODE, supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  Category,
  Company,
  Coupon,
  Customer,
  DeliveryZone,
  initialMockDatabase,
  MockDatabaseState,
  Order,
  Plan,
  Product,
  Settings,
  User,
  createDatabaseApi,
} from "../data/mockDatabase";

export const DATABASE_STORAGE_KEY = "startt_delivery_saas_database_v2";
export const DATABASE_SYNC_ERROR_EVENT = "startt:database-sync-error";
const PUBLIC_STORAGE_BUCKET = "startt-public";
const COMPANY_ROUTE_CACHE_PREFIX = "startt_company_route_cache:";
const allowLocalDatabaseFallback = import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_DATABASE === "true";
const PUBLIC_CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_CATALOG_CACHE_STATUS_KEY = "startt_public_catalog_cache_status";
const emergencyCompanyColumns = "id,name,slug,logo_url,banner_url,whatsapp,address,hero_image,primary_color,minimum_order,estimated_delivery_time,is_open,delivery_enabled,pickup_enabled,status,is_registration_enabled,footer_message,opening_hours";
const emergencySettingsColumns = "id,company_id,critical_locked";
const emergencyCategoryColumns = "id,company_id,name,sort_order,active";
const emergencyProductColumns = "id,company_id,category_id,name,description,price,ingredients,preparation_time,featured,active,badge";
const emergencyDeliveryZoneColumns = "id,company_id,neighborhood,fee,estimated_minutes,active";

const tableNames = [
  "plans",
  "companies",
  "master_users",
  "users",
  "categories",
  "products",
  "customers",
  "voucher_brands",
  "delivery_zones",
  "coupons",
  "settings",
  "print_settings",
  "orders",
  "order_items",
  "cash_sales",
  "reports",
  "inventory_items",
] as const;

const defaultMasterUser = {
  id: "mst_1",
  name: "Admin Master",
  email: "master@startt.com",
  password: "Achieve123",
  role: "master" as const,
  is_active: true,
};

type TableName = (typeof tableNames)[number];
type SnapshotKey = keyof MockDatabaseState;
type PublicCatalogStatus = "idle" | "fresh" | "cache" | "failed";
type PublicCatalogCache = {
  cachedAt: number;
  data: Partial<MockDatabaseState>;
};
type AdminScreenName =
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
  | "usuarios"
  | "login";

const tableColumns: Record<TableName, string> = {
  plans: "id,name,monthly_price,max_products,max_users,allow_reports,allow_printing,allow_coupons,is_active",
  companies: "id,name,slug,logo_url,banner_url,whatsapp,address,hero_image,primary_color,minimum_order,estimated_delivery_time,is_open,delivery_enabled,pickup_enabled,status,plan,is_registration_enabled,plan_id,subscription_status,monthly_price,due_day,next_due_date,last_payment_date,payment_notes,assistant_enabled,assistant_status,assistant_trial_until,assistant_notes,assistant_plan,footer_message,opening_hours,created_at,updated_at",
  master_users: "id,name,email,password,role,is_active",
  users: "id,company_id,name,email,password,role,is_active,created_at,updated_at,assistant_role,active",
  categories: "id,company_id,name,emoji,sort_order,active",
  products: "id,company_id,category_id,name,description,price,image,ingredients,preparation_time,featured,active,badge",
  customers: "id,company_id,name,phone,normalized_phone,address,updated_at,total_orders,total_spent,last_order_at,created_at",
  voucher_brands: "id,company_id,name,fee_percentage,active,created_at,updated_at",
  delivery_zones: "id,company_id,neighborhood,fee,estimated_minutes,active",
  coupons: "id,company_id,code,type,value,minimum_order,usage_limit,used_count,expires_at,active",
  settings: "id,company_id,critical_locked,pix_enabled,pix_key,pix_receiver_name,pix_city,pix_description",
  print_settings: "company_id,auto_print_orders,auto_print_cash_sales,printer_name,qz_tray_enabled,qz_printer_name,paper_width,copies,footer_text",
  orders: "id,order_number,company_id,customer_id,customer_name,customer_phone,normalized_phone,customer_address,status,fulfillment,delivery_zone_id,subtotal,discount,delivery_fee,total,payment_method,payment_details,cash_change_for,calculated_change,change_for,change_amount,card_type,voucher_brand,voucher_fee_percentage,payment_status,pix_txid,pix_payload,pix_qr_code,customer_note,archived,archived_at,removed_from_dashboard,qz_printed_at,qz_print_attempts,qz_print_error,created_at",
  order_items: "id,company_id,order_id,product_id,name,quantity,unit_price,total",
  cash_sales: "id,company_id,items,subtotal,discount,total,payment_method,created_by,created_at",
  reports: "id,company_id,name,type,created_at",
  inventory_items: "id,company_id,name,category,current_quantity,minimum_quantity,unit,notes,active,purchase_flag,purchase_resolved,created_at,updated_at",
};
const companyAdminColumns = "id,name,slug,logo_url,banner_url,whatsapp,address,hero_image,primary_color,minimum_order,estimated_delivery_time,is_open,delivery_enabled,pickup_enabled,status,plan,is_registration_enabled,plan_id,subscription_status,monthly_price,due_day,next_due_date,last_payment_date,payment_notes,assistant_enabled,assistant_status,assistant_trial_until,assistant_notes,assistant_plan,footer_message,opening_hours,created_at,updated_at";
const dashboardOrderColumns = "id,order_number,company_id,customer_id,customer_name,status,subtotal,discount,delivery_fee,total,payment_method,archived,removed_from_dashboard,created_at";
const dashboardCashSaleColumns = "id,company_id,subtotal,discount,total,payment_method,created_at";
const customerSummaryColumns = "id,company_id,name,phone,normalized_phone,address,total_orders,total_spent,last_order_at,created_at,updated_at";
const productListColumns = "id,company_id,category_id,name,description,price,image,ingredients,preparation_time,featured,active,badge";

const nullableDateFields = new Set([
  "companies.next_due_date",
  "companies.last_payment_date",
  "companies.assistant_trial_until",
  "settings.assistant_trial_until",
  "customers.last_order_at",
  "coupons.expires_at",
  "orders.archived_at",
  "orders.qz_printed_at",
]);

const timestampFields = new Set([
  ...nullableDateFields,
  "companies.created_at",
  "companies.updated_at",
  "users.created_at",
  "users.updated_at",
  "customers.created_at",
  "customers.updated_at",
  "voucher_brands.created_at",
  "voucher_brands.updated_at",
  "settings.created_at",
  "settings.updated_at",
  "orders.created_at",
  "cash_sales.created_at",
  "reports.created_at",
  "inventory_items.created_at",
  "inventory_items.updated_at",
]);

const requiredTimestampFields = new Set([...timestampFields].filter((field) => !nullableDateFields.has(field)));

const frontendOnlyFields: Partial<Record<TableName, string[]>> = {
  orders: ["removedFromDashboard"],
};

function toSupabaseRow<T>(table: TableName, row: T): T {
  const cleaned: Record<string, unknown> = {};
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (frontendOnlyFields[table]?.includes(key)) continue;
    if (value === undefined) continue;
    const field = `${table}.${key}`;
    if (requiredTimestampFields.has(field) && (value === "" || value === null)) {
      cleaned[key] = now;
      continue;
    }
    cleaned[key] = nullableDateFields.has(field) && value === "" ? null : value;
  }
  if (table === "users") {
    const userRow = row as Record<string, unknown>;
    const isActive = typeof userRow.is_active === "boolean" ? userRow.is_active : typeof userRow.active === "boolean" ? userRow.active : true;
    const assistantRole = typeof userRow.assistant_role === "string" && userRow.assistant_role.trim() ? userRow.assistant_role : "operator";
    const createdAt = typeof userRow.created_at === "string" && userRow.created_at ? userRow.created_at : now;
    const updatedAt = typeof userRow.updated_at === "string" && userRow.updated_at ? userRow.updated_at : createdAt;
    cleaned.is_active = isActive;
    cleaned.active = isActive;
    cleaned.assistant_role = assistantRole;
    cleaned.created_at = createdAt;
    cleaned.updated_at = updatedAt;
  }
  return cleaned as T;
}

function supabaseErrorMessage(error: unknown) {
  if (!error) return "Erro desconhecido";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "Erro desconhecido");
  return String(error);
}

function emptyTimestampFields(table: TableName, payload: unknown) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const fields = new Set<string>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (timestampFields.has(`${table}.${key}`) && value === "") fields.add(key);
    }
  }
  return [...fields];
}

function withSupabaseContext(table: TableName, stage: string, error: unknown, payload?: unknown) {
  const emptyFields = payload ? emptyTimestampFields(table, payload) : [];
  const message = [
    `Falha no Supabase durante ${stage}`,
    `tabela=${table}`,
    emptyFields.length ? `campos_timestamp_vazios=${emptyFields.join(",")}` : "",
    `erro=${supabaseErrorMessage(error)}`,
  ].filter(Boolean).join(" | ");
  console.error(message, { table, stage, emptyTimestampFields: emptyFields, payload, error });
  return Object.assign(new Error(message), { table, stage, emptyTimestampFields: emptyFields, originalError: error });
}

function fixMojibake(value = "") {
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    return decodeURIComponent(value.split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return value;
  }
}

function normalizedNeighborhood(value: string) {
  return fixMojibake(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}

function withDefaults(parsed: Partial<MockDatabaseState> = {}): MockDatabaseState {
  const plans = parsed.plans?.length ? parsed.plans : initialMockDatabase.plans;
  const companies = (parsed.companies || initialMockDatabase.companies).map((company) => {
    const legacyStarter = !company.plan_id && (company.plan === "Starter" || company.plan === "Start" || company.status === "trial");
    const fallbackPlan = legacyStarter
      ? plans.find((plan) => plan.id === "plan_start")
      : plans.find((plan) => plan.name === company.plan) || plans.find((plan) => plan.id === "plan_pro") || plans[0];
    return {
      ...company,
      banner_url: company.banner_url || company.hero_image || "",
      is_registration_enabled: company.is_registration_enabled ?? true,
      plan_id: legacyStarter ? "plan_start" : company.plan_id || fallbackPlan?.id || "plan_pro",
      subscription_status: company.subscription_status || (company.status === "trial" ? "trialing" : "active"),
      monthly_price: company.monthly_price ?? fallbackPlan?.monthly_price ?? 79.9,
      due_day: company.due_day ?? 10,
      next_due_date: company.next_due_date || "2026-05-10",
      last_payment_date: company.last_payment_date || "",
      payment_notes: fixMojibake(company.payment_notes || ""),
      assistant_enabled: company.assistant_enabled ?? false,
      assistant_status: company.assistant_status || "inactive",
      assistant_trial_until: company.assistant_trial_until || "",
      assistant_notes: fixMojibake(company.assistant_notes || ""),
      assistant_plan: company.assistant_plan || "mvp",
      address: fixMojibake(company.address || ""),
      updated_at: company.updated_at || company.created_at || new Date().toISOString(),
    };
  });

  const products = (parsed.products || initialMockDatabase.products).map((product) => ({
    ...product,
    ingredients: product.ingredients || product.description || "",
  }));
  const categories = (parsed.categories || initialMockDatabase.categories).map((category) => ({
    ...category,
    emoji: category.emoji || "",
  }));
  const masterSource = parsed.master_users?.length ? parsed.master_users : initialMockDatabase.master_users;
  const hasDefaultMaster = masterSource.some((user) => user.email.toLowerCase() === defaultMasterUser.email);
  const master_users = (hasDefaultMaster ? masterSource : [defaultMasterUser, ...masterSource]).map((user) => {
    if (user.email.toLowerCase() === defaultMasterUser.email || user.id === defaultMasterUser.id) {
      return { ...user, ...defaultMasterUser };
    }
    return {
      ...user,
      is_active: user.is_active ?? true,
    };
  });
  const users = (parsed.users || initialMockDatabase.users).map((user) => {
    const row = user as User & { active?: boolean };
    const createdAt = row.created_at || new Date().toISOString();
    return {
      ...user,
      is_active: row.is_active ?? row.active ?? true,
      created_at: createdAt,
      updated_at: (row as User & { updated_at?: string }).updated_at || createdAt,
    };
  });
  const parsedDeliveryZones = (parsed.delivery_zones || []).map((zone) => ({ ...zone, neighborhood: fixMojibake(zone.neighborhood) }));
  const delivery_zones = [
    ...parsedDeliveryZones,
    ...initialMockDatabase.delivery_zones.filter((seedZone) => !parsedDeliveryZones.some((zone) => zone.company_id === seedZone.company_id && normalizedNeighborhood(zone.neighborhood) === normalizedNeighborhood(seedZone.neighborhood))),
  ];
  const customers = (parsed.customers || initialMockDatabase.customers).map((customer) => {
    const digits = customer.phone.replace(/\D/g, "");
    const normalized_phone = customer.normalized_phone || (digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits);
    return {
      ...customer,
      normalized_phone,
      address: fixMojibake(customer.address || ""),
      updated_at: customer.updated_at || customer.created_at || customer.last_order_at || new Date().toISOString(),
      total_orders: customer.total_orders ?? Math.max(0, (parsed.orders || initialMockDatabase.orders).filter((order) => order.customer_id === customer.id).length),
      total_spent: customer.total_spent ?? 0,
      last_order_at: customer.last_order_at || "",
    };
  });
  const orders = (parsed.orders || initialMockDatabase.orders).map((order, index) => ({
    ...order,
    customer_name: order.customer_name || customers.find((customer) => customer.id === order.customer_id)?.name || "",
    customer_phone: order.customer_phone || customers.find((customer) => customer.id === order.customer_id)?.phone || "",
    normalized_phone: order.normalized_phone || customers.find((customer) => customer.id === order.customer_id)?.normalized_phone || "",
    customer_address: fixMojibake(order.customer_address || customers.find((customer) => customer.id === order.customer_id)?.address || ""),
    order_number: order.order_number || 10000 + index + 1,
    cash_change_for: order.cash_change_for || 0,
    calculated_change: order.calculated_change || 0,
    change_for: order.change_for || order.cash_change_for || 0,
    change_amount: order.change_amount || order.calculated_change || 0,
    payment_details: order.payment_details || order.payment_method,
    payment_status: order.payment_status || (order.payment_method === "Pix" ? "Aguardando comprovante" : undefined),
    pix_txid: order.pix_txid || "",
    pix_payload: order.pix_payload || "",
    pix_qr_code: order.pix_qr_code || "",
    archived: order.archived ?? false,
    archived_at: order.archived_at || "",
    removed_from_dashboard: order.removed_from_dashboard ?? order.removedFromDashboard ?? false,
    qz_printed_at: order.qz_printed_at || "",
    qz_print_attempts: order.qz_print_attempts ?? 0,
    qz_print_error: fixMojibake(order.qz_print_error || ""),
  }));
  const settings = (parsed.settings || initialMockDatabase.settings).map((setting) => ({
    ...setting,
    pix_enabled: setting.pix_enabled ?? false,
    pix_key: setting.pix_key || "",
    pix_receiver_name: setting.pix_receiver_name || "",
    pix_city: setting.pix_city || "Porto Alegre",
    pix_description: setting.pix_description || "",
  }));
  const voucher_brands = (parsed.voucher_brands || initialMockDatabase.voucher_brands).map((brand) => ({
    ...brand,
    created_at: brand.created_at || new Date().toISOString(),
    updated_at: brand.updated_at || brand.created_at || new Date().toISOString(),
  }));

  return { ...initialMockDatabase, ...parsed, plans, companies, products, categories, master_users, users, delivery_zones, customers, orders, settings, voucher_brands };
}

function readFallbackSnapshot(): MockDatabaseState {
  if (!allowLocalDatabaseFallback) return initialMockDatabase;
  try {
    const stored = localStorage.getItem(DATABASE_STORAGE_KEY);
    if (!stored) return initialMockDatabase;
    return withDefaults(JSON.parse(stored) as Partial<MockDatabaseState>);
  } catch {
    return initialMockDatabase;
  }
}

function writeFallbackSnapshot(state: MockDatabaseState) {
  if (!allowLocalDatabaseFallback) {
    const error = new Error("Backend persistente não configurado. Dados principais não podem ser salvos em localStorage em produção.");
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }
  localStorage.setItem(DATABASE_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("startt:database-changed", { detail: state }));
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function emptyDatabaseState(): MockDatabaseState {
  return {
    companies: [],
    plans: [],
    users: [],
    master_users: [],
    categories: [],
    products: [],
    orders: [],
    order_items: [],
    customers: [],
    voucher_brands: [],
    delivery_zones: [],
    coupons: [],
    settings: [],
    cash_sales: [],
    print_settings: [],
    reports: [],
    inventory_items: [],
  };
}

function scopedDefaults(parsed: Partial<MockDatabaseState> = {}): MockDatabaseState {
  return withDefaults({ ...emptyDatabaseState(), ...parsed });
}

function publicCatalogCacheKey(slug: string) {
  return `startt_public_catalog_cache_${slug}`;
}

function setPublicCatalogStatus(slug: string, status: PublicCatalogStatus) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PUBLIC_CATALOG_CACHE_STATUS_KEY, JSON.stringify({ slug, status, updatedAt: Date.now() }));
  } catch {
    // Cache/status cannot block the public catalog.
  }
}

function readPublicCatalogCache(slug: string): Partial<MockDatabaseState> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const cached = JSON.parse(localStorage.getItem(publicCatalogCacheKey(slug)) || "null") as PublicCatalogCache | null;
    if (!cached || Date.now() - cached.cachedAt > PUBLIC_CATALOG_CACHE_TTL_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writePublicCatalogCache(slug: string, data: Partial<MockDatabaseState>) {
  if (typeof localStorage === "undefined") return;
  try {
    const key = publicCatalogCacheKey(slug);
    const cache: PublicCatalogCache = { cachedAt: Date.now(), data };
    localStorage.removeItem(key);
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // The fresh response is still usable even when browser storage is full.
  }
}

function isStopImmediatelyError(error: unknown) {
  const value = error as { status?: number; message?: string };
  const message = value?.message || String(error || "");
  return [401, 402, 403, 500].includes(value?.status || 0) || /timeout|canceling statement|network|failed to fetch|fetch failed|invalid api key|jwt/i.test(message);
}

function emergencyCompany(row: Record<string, unknown>, settings?: Record<string, unknown>): Company {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    slug: String(row.slug || ""),
    logo_url: String(row.logo_url || ""),
    banner_url: String(row.banner_url || row.hero_image || ""),
    whatsapp: String(settings?.whatsapp || row.whatsapp || ""),
    address: String(settings?.address || row.address || ""),
    hero_image: String(row.banner_url || row.hero_image || ""),
    primary_color: String(row.primary_color || "#116a4b"),
    minimum_order: Number(settings?.minimum_order ?? row.minimum_order ?? 0),
    estimated_delivery_time: String(row.estimated_delivery_time || "30-45 min"),
    is_open: row.is_open !== false,
    delivery_enabled: Boolean(settings?.delivery_enabled ?? row.delivery_enabled ?? true),
    pickup_enabled: Boolean(settings?.pickup_enabled ?? row.pickup_enabled ?? true),
    status: row.status === "blocked" || row.status === "canceled" || row.status === "disabled" ? row.status : "active",
    plan: String(row.plan || "Start"),
    is_registration_enabled: row.is_registration_enabled !== false,
    plan_id: String(row.plan_id || "plan_start"),
    subscription_status: row.subscription_status === "overdue" || row.subscription_status === "canceled" ? row.subscription_status : "active",
    monthly_price: Number(row.monthly_price || 0),
    due_day: Number(row.due_day || 10),
    next_due_date: String(row.next_due_date || ""),
    last_payment_date: String(row.last_payment_date || ""),
    payment_notes: String(row.payment_notes || ""),
    assistant_enabled: false,
    assistant_status: "inactive",
    assistant_trial_until: "",
    assistant_notes: "",
    assistant_plan: "mvp",
    footer_message: String(row.footer_message || "produzido por Startt Facilities"),
    opening_hours: String(settings?.opening_hours || row.opening_hours || ""),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  } as Company;
}

function emergencyCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id || ""),
    company_id: String(row.company_id || ""),
    name: String(row.name || ""),
    sort_order: Number(row.sort_order || 0),
    active: Boolean(row.active ?? true),
  };
}

function emergencyProduct(row: Record<string, unknown>): Product {
  const productId = String(row.id || "");
  return {
    id: productId,
    company_id: String(row.company_id || ""),
    category_id: String(row.category_id || ""),
    name: String(row.name || ""),
    description: String(row.description || ""),
    price: Number(row.price || 0),
    image: productId ? `/api/product-image?id=${encodeURIComponent(productId)}` : "",
    ingredients: String(row.ingredients || row.description || ""),
    preparation_time: Number(row.preparation_time || 0),
    featured: Boolean(row.featured || false),
    active: Boolean(row.active ?? true),
    badge: row.badge ? String(row.badge) : undefined,
  };
}

async function loadEmergencyPublicCatalog(slug: string): Promise<MockDatabaseState> {
  try {
    const { data: companyRow, error: companyError } = await requireSupabase().from("companies").select(emergencyCompanyColumns).eq("slug", slug).maybeSingle();
    if (companyError) throw companyError;
    if (!companyRow) {
      setPublicCatalogStatus(slug, "failed");
      return scopedDefaults();
    }

    const companyId = String((companyRow as Record<string, unknown>).id || "");
    const [settings, categories, products, deliveryZones] = await Promise.all([
      requireSupabase().from("settings").select(emergencySettingsColumns).eq("company_id", companyId).maybeSingle().then(({ data, error }) => {
        if (error) throw error;
        return (data || {}) as Record<string, unknown>;
      }),
      requireSupabase().from("categories").select(emergencyCategoryColumns).eq("company_id", companyId).eq("active", true).order("sort_order").limit(100).then(({ data, error }) => {
        if (error) throw error;
        return ((data || []) as unknown as Record<string, unknown>[]).map(emergencyCategory);
      }),
      requireSupabase().from("products").select(emergencyProductColumns).eq("company_id", companyId).eq("active", true).limit(300).then(({ data, error }) => {
        if (error) throw error;
        return ((data || []) as unknown as Record<string, unknown>[]).map(emergencyProduct);
      }),
      requireSupabase().from("delivery_zones").select(emergencyDeliveryZoneColumns).eq("company_id", companyId).eq("active", true).limit(150).then(({ data, error }) => {
        if (error) throw error;
        return (data || []) as MockDatabaseState["delivery_zones"];
      }),
    ]);

    const data: Partial<MockDatabaseState> = {
      companies: [emergencyCompany(companyRow as Record<string, unknown>, settings)],
      categories,
      products,
      delivery_zones: deliveryZones,
      settings: settings && Object.keys(settings).length ? [settings as Settings] : [],
      coupons: [],
      voucher_brands: [],
      orders: [],
      order_items: [],
      customers: [],
    };
    writePublicCatalogCache(slug, data);
    setPublicCatalogStatus(slug, "fresh");
    return scopedDefaults(data);
  } catch (error) {
    console.warn("Falha no carregamento publico emergencial.", error);
    const cached = readPublicCatalogCache(slug);
    if (cached) {
      setPublicCatalogStatus(slug, "cache");
      return scopedDefaults(cached);
    }
    if (isStopImmediatelyError(error)) {
      setPublicCatalogStatus(slug, "failed");
      return scopedDefaults();
    }
    setPublicCatalogStatus(slug, "failed");
    return scopedDefaults();
  }
}

async function selectAll<T>(table: TableName, columns = tableColumns[table]): Promise<T[]> {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select(columns);
  if (error) throw error;
  return (data || []) as T[];
}

function isMissingOptionalInventoryTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /inventory_items|schema cache|does not exist|Could not find/i.test(message);
}

async function selectOptionalAll<T>(table: TableName, columns = tableColumns[table]): Promise<T[]> {
  try {
    return await selectAll<T>(table, columns);
  } catch (error) {
    if (table === "inventory_items" && isMissingOptionalInventoryTable(error)) return [];
    throw error;
  }
}

async function insertRow<T>(table: TableName, row: T): Promise<T> {
  if (!isSupabaseConfigured) return row;
  const client = requireSupabase();
  const payload = toSupabaseRow(table, row);
  const { data, error } = await client.from(table).insert(payload as never).select("*").single();
  if (error) throw withSupabaseContext(table, "insert", error, payload);
  return data as T;
}

async function updateRow<T extends { id: string }>(table: TableName, row: T): Promise<T> {
  if (!isSupabaseConfigured) return row;
  const client = requireSupabase();
  const payload = toSupabaseRow(table, row);
  const { data, error } = await client.from(table).update(payload as never).eq("id", row.id).select("*").single();
  if (error) throw withSupabaseContext(table, "update", error, payload);
  return data as T;
}

async function deleteById(table: TableName, id: string) {
  if (!isSupabaseConfigured) return;
  const client = requireSupabase();
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw withSupabaseContext(table, "delete", error, { id });
}

async function syncTable(table: TableName, rows: unknown[], key: "id" | "company_id" = "id") {
  const client = requireSupabase();
  if (rows.length) {
    const sanitizedRows = rows.map((row) => toSupabaseRow(table, row));
    const { error } = await client.from(table).upsert(sanitizedRows as never, { onConflict: key });
    if (error && table === "companies" && /assistant_/i.test(error.message)) {
      const fallbackRows = sanitizedRows.map((row) => {
        const {
          assistant_enabled: _assistant_enabled,
          assistant_status: _assistant_status,
          assistant_trial_until: _assistant_trial_until,
          assistant_notes: _assistant_notes,
          assistant_plan: _assistant_plan,
          ...rest
        } = row as Record<string, unknown>;
        return rest;
      });
      const { error: retryError } = await client.from(table).upsert(fallbackRows as never, { onConflict: key });
      if (retryError) throw withSupabaseContext(table, "upsert:retry_without_assistant_fields", retryError, fallbackRows);
      return;
    }
    if (error && table === "inventory_items" && isMissingOptionalInventoryTable(error)) return;
    if (error) throw withSupabaseContext(table, "upsert", error, sanitizedRows);
  }
}

export function getInitialDatabaseSnapshot(): MockDatabaseState {
  if (isSupabaseConfigured) return initialMockDatabase;
  return readFallbackSnapshot();
}

export function getCachedCompanyRouteSnapshot(slug: string): MockDatabaseState | null {
  try {
    const raw = localStorage.getItem(`${COMPANY_ROUTE_CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { snapshot?: Partial<MockDatabaseState> };
    return parsed.snapshot ? withDefaults(parsed.snapshot) : null;
  } catch {
    return null;
  }
}

export function cacheCompanyRouteSnapshot(slug: string, snapshot: MockDatabaseState) {
  try {
    localStorage.setItem(`${COMPANY_ROUTE_CACHE_PREFIX}${slug}`, JSON.stringify({ cached_at: new Date().toISOString(), snapshot }));
  } catch {
    // Cache publico e apenas acelerador. Se falhar, o Supabase continua sendo a fonte real.
  }
}

export async function loadDatabaseSnapshot(): Promise<MockDatabaseState> {
  if (!isSupabaseConfigured) {
    if (allowLocalDatabaseFallback) return readFallbackSnapshot();
    throw new Error("Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de produção.");
  }

  try {
    const [
      companies,
      plans,
      master_users,
      users,
      categories,
      products,
      orders,
      order_items,
      customers,
      voucher_brands,
      delivery_zones,
      coupons,
      settings,
      cash_sales,
      print_settings,
      reports,
      inventory_items,
    ] = await Promise.all([
      selectAll<MockDatabaseState["companies"][number]>("companies"),
      selectAll<MockDatabaseState["plans"][number]>("plans"),
      selectAll<MockDatabaseState["master_users"][number]>("master_users"),
      selectAll<MockDatabaseState["users"][number]>("users"),
      selectAll<MockDatabaseState["categories"][number]>("categories"),
      selectAll<MockDatabaseState["products"][number]>("products"),
      selectAll<MockDatabaseState["orders"][number]>("orders"),
      selectAll<MockDatabaseState["order_items"][number]>("order_items"),
      selectAll<MockDatabaseState["customers"][number]>("customers"),
      selectAll<MockDatabaseState["voucher_brands"][number]>("voucher_brands"),
      selectAll<MockDatabaseState["delivery_zones"][number]>("delivery_zones"),
      selectAll<MockDatabaseState["coupons"][number]>("coupons"),
      selectAll<MockDatabaseState["settings"][number]>("settings"),
      selectAll<MockDatabaseState["cash_sales"][number]>("cash_sales"),
      selectAll<MockDatabaseState["print_settings"][number]>("print_settings"),
      selectAll<MockDatabaseState["reports"][number]>("reports"),
      selectOptionalAll<MockDatabaseState["inventory_items"][number]>("inventory_items"),
    ]);

    return withDefaults({
      companies,
      plans,
      master_users,
      users,
      categories,
      products,
      orders,
      order_items,
      customers,
      voucher_brands,
      delivery_zones,
      coupons,
      settings,
      cash_sales,
      print_settings,
      reports,
      inventory_items,
    });
  } catch (error) {
    console.error("Falha ao carregar Supabase.", error);
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }
}

async function selectCompanyRows<T>(
  table: TableName,
  companyId: string,
  columns = tableColumns[table],
  options: { orderBy?: string; ascending?: boolean; limit?: number; activeOnly?: boolean } = {},
): Promise<T[]> {
  let query = requireSupabase().from(table).select(columns).eq("company_id", companyId);
  if (options.activeOnly) query = query.eq("active", true);
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    if (table === "inventory_items" && isMissingOptionalInventoryTable(error)) return [];
    throw error;
  }
  return (data || []) as T[];
}

async function loadAdminCompanyData(company: Company, plans: Plan[], screen: AdminScreenName): Promise<MockDatabaseState> {
  const companyId = company.id;
  const base = {
    companies: [company],
    plans,
    master_users: [],
    users: await selectCompanyRows<MockDatabaseState["users"][number]>("users", companyId, tableColumns.users, { limit: 50 }),
  };

  if (screen === "login" || screen === "conta" || screen === "usuarios") {
    return withDefaults({
      ...base,
      users: await selectCompanyRows<MockDatabaseState["users"][number]>("users", companyId, tableColumns.users, { limit: 100 }),
    });
  }

  if (screen === "dashboard") {
    const [products, orders, customers, cash_sales, inventory_items] = await Promise.all([
      selectCompanyRows<MockDatabaseState["products"][number]>("products", companyId, "id,company_id,category_id,name,price,active", { activeOnly: true, limit: 200 }),
      selectCompanyRows<MockDatabaseState["orders"][number]>("orders", companyId, dashboardOrderColumns, { orderBy: "created_at", ascending: false, limit: 50 }),
      selectCompanyRows<MockDatabaseState["customers"][number]>("customers", companyId, customerSummaryColumns, { orderBy: "created_at", ascending: false, limit: 100 }),
      selectCompanyRows<MockDatabaseState["cash_sales"][number]>("cash_sales", companyId, dashboardCashSaleColumns, { orderBy: "created_at", ascending: false, limit: 50 }),
      selectCompanyRows<MockDatabaseState["inventory_items"][number]>("inventory_items", companyId, "id,company_id,name,current_quantity,minimum_quantity,active,purchase_flag,purchase_resolved,updated_at", { orderBy: "updated_at", ascending: false, limit: 100 }),
    ]);
    return withDefaults({ ...base, products, orders, customers, cash_sales, inventory_items });
  }

  if (screen === "pedidos") {
    const [orders, order_items, customers, products, print_settings] = await Promise.all([
      selectCompanyRows<MockDatabaseState["orders"][number]>("orders", companyId, tableColumns.orders, { orderBy: "created_at", ascending: false, limit: 100 }),
      selectCompanyRows<MockDatabaseState["order_items"][number]>("order_items", companyId, tableColumns.order_items, { limit: 500 }),
      selectCompanyRows<MockDatabaseState["customers"][number]>("customers", companyId, customerSummaryColumns, { limit: 200 }),
      selectCompanyRows<MockDatabaseState["products"][number]>("products", companyId, "id,company_id,category_id,name,price,active", { activeOnly: true, limit: 300 }),
      selectCompanyRows<MockDatabaseState["print_settings"][number]>("print_settings", companyId, tableColumns.print_settings, { limit: 1 }),
    ]);
    return withDefaults({ ...base, orders, order_items, customers, products, print_settings });
  }

  if (screen === "caixa") {
    const products = await selectCompanyRows<MockDatabaseState["products"][number]>("products", companyId, productListColumns, { activeOnly: true, limit: 300 });
    return withDefaults({ ...base, products });
  }

  if (screen === "estoque") {
    const inventory_items = await selectCompanyRows<MockDatabaseState["inventory_items"][number]>("inventory_items", companyId, tableColumns.inventory_items, { orderBy: "updated_at", ascending: false, limit: 500 });
    return withDefaults({ ...base, inventory_items });
  }

  if (screen === "clientes") {
    const [customers, orders, order_items] = await Promise.all([
      selectCompanyRows<MockDatabaseState["customers"][number]>("customers", companyId, tableColumns.customers, { orderBy: "created_at", ascending: false, limit: 500 }),
      selectCompanyRows<MockDatabaseState["orders"][number]>("orders", companyId, dashboardOrderColumns, { orderBy: "created_at", ascending: false, limit: 200 }),
      selectCompanyRows<MockDatabaseState["order_items"][number]>("order_items", companyId, tableColumns.order_items, { limit: 500 }),
    ]);
    return withDefaults({ ...base, customers, orders, order_items });
  }

  if (screen === "produtos") {
    const [products, categories] = await Promise.all([
      selectCompanyRows<MockDatabaseState["products"][number]>("products", companyId, productListColumns, { limit: 500 }),
      selectCompanyRows<MockDatabaseState["categories"][number]>("categories", companyId, tableColumns.categories, { orderBy: "sort_order", limit: 100 }),
    ]);
    return withDefaults({ ...base, products, categories });
  }

  if (screen === "categorias") {
    const categories = await selectCompanyRows<MockDatabaseState["categories"][number]>("categories", companyId, tableColumns.categories, { orderBy: "sort_order", limit: 100 });
    return withDefaults({ ...base, categories });
  }

  if (screen === "cupons") {
    const coupons = await selectCompanyRows<MockDatabaseState["coupons"][number]>("coupons", companyId, tableColumns.coupons, { limit: 200 });
    return withDefaults({ ...base, coupons });
  }

  if (screen === "relatorios") {
    const [orders, cash_sales, reports] = await Promise.all([
      selectCompanyRows<MockDatabaseState["orders"][number]>("orders", companyId, dashboardOrderColumns, { orderBy: "created_at", ascending: false, limit: 300 }),
      selectCompanyRows<MockDatabaseState["cash_sales"][number]>("cash_sales", companyId, dashboardCashSaleColumns, { orderBy: "created_at", ascending: false, limit: 300 }),
      selectCompanyRows<MockDatabaseState["reports"][number]>("reports", companyId, tableColumns.reports, { orderBy: "created_at", ascending: false, limit: 100 }),
    ]);
    return withDefaults({ ...base, orders, cash_sales, reports });
  }

  if (screen === "fretes") {
    const delivery_zones = await selectCompanyRows<MockDatabaseState["delivery_zones"][number]>("delivery_zones", companyId, tableColumns.delivery_zones, { limit: 300 });
    return withDefaults({ ...base, delivery_zones });
  }

  if (screen === "impressao") {
    const print_settings = await selectCompanyRows<MockDatabaseState["print_settings"][number]>("print_settings", companyId, tableColumns.print_settings, { limit: 1 });
    return withDefaults({ ...base, print_settings });
  }

  if (screen === "configuracoes") {
    const [settings, print_settings, voucher_brands] = await Promise.all([
      selectCompanyRows<MockDatabaseState["settings"][number]>("settings", companyId, tableColumns.settings, { limit: 1 }),
      selectCompanyRows<MockDatabaseState["print_settings"][number]>("print_settings", companyId, tableColumns.print_settings, { limit: 1 }),
      selectCompanyRows<MockDatabaseState["voucher_brands"][number]>("voucher_brands", companyId, tableColumns.voucher_brands, { limit: 100 }),
    ]);
    return withDefaults({ ...base, settings, print_settings, voucher_brands });
  }

  return withDefaults(base);
}

export async function loadCompanyOrdersRefresh(companyId: string): Promise<Pick<MockDatabaseState, "orders" | "order_items">> {
  if (!isSupabaseConfigured) {
    const fallback = readFallbackSnapshot();
    return {
      orders: fallback.orders.filter((order) => order.company_id === companyId),
      order_items: fallback.order_items.filter((item) => item.company_id === companyId),
    };
  }
  const [orders, order_items] = await Promise.all([
    selectCompanyRows<MockDatabaseState["orders"][number]>("orders", companyId, tableColumns.orders, { orderBy: "created_at", ascending: false, limit: 100 }),
    selectCompanyRows<MockDatabaseState["order_items"][number]>("order_items", companyId, tableColumns.order_items, { limit: 500 }),
  ]);
  return { orders, order_items };
}

export async function loadCompanyRouteSnapshot(slug: string, includeAdminData = false, screen: AdminScreenName = includeAdminData ? "dashboard" : "login"): Promise<MockDatabaseState> {
  if (!isSupabaseConfigured) {
    if (allowLocalDatabaseFallback) return readFallbackSnapshot();
    throw new Error("Supabase nao configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de producao.");
  }

  try {
    if (STARTT_EMERGENCY_MODE && !includeAdminData) {
      return loadEmergencyPublicCatalog(slug);
    }

    const client = requireSupabase();
    if (!STARTT_EMERGENCY_MODE) {
      const { data: routeBundle, error: routeBundleError } = await client.rpc("startt_company_route_bundle", {
        p_slug: slug,
        p_include_admin: includeAdminData,
      });
      if (!routeBundleError && routeBundle && typeof routeBundle === "object" && (!includeAdminData || "inventory_items" in (routeBundle as Record<string, unknown>))) {
        const bundle = routeBundle as Partial<MockDatabaseState> & { company?: Company | null };
        return withDefaults({
          companies: bundle.company ? [bundle.company] : [],
          plans: bundle.plans || [],
          master_users: [],
          users: bundle.users || [],
          categories: bundle.categories || [],
          products: bundle.products || [],
          orders: bundle.orders || [],
          order_items: bundle.order_items || [],
          customers: bundle.customers || [],
          voucher_brands: bundle.voucher_brands || [],
          delivery_zones: bundle.delivery_zones || [],
          coupons: bundle.coupons || [],
          settings: bundle.settings || [],
          cash_sales: bundle.cash_sales || [],
          print_settings: bundle.print_settings || [],
          reports: bundle.reports || [],
          inventory_items: bundle.inventory_items || [],
        });
      }
    }

    const [{ data: company, error: companyError }, plans] = await Promise.all([
      client.from("companies").select(companyAdminColumns).eq("slug", slug).maybeSingle(),
      selectAll<MockDatabaseState["plans"][number]>("plans", tableColumns.plans),
    ]);
    if (companyError) throw companyError;

    if (!company) {
      return withDefaults({
        companies: [],
        plans,
        master_users: [],
        users: [],
        categories: [],
        products: [],
        orders: [],
        order_items: [],
        customers: [],
        voucher_brands: [],
        delivery_zones: [],
        coupons: [],
        settings: [],
        cash_sales: [],
        print_settings: [],
        reports: [],
        inventory_items: [],
      });
    }

    const companyId = (company as Company).id;
    if (includeAdminData && STARTT_EMERGENCY_MODE) {
      return loadAdminCompanyData(company as Company, plans, screen);
    }

    const [categories, products, orders, customers, voucher_brands, delivery_zones, coupons, settings, print_settings] = await Promise.all([
      client.from("categories").select(tableColumns.categories).eq("company_id", companyId).order("sort_order"),
      client.from("products").select(tableColumns.products).eq("company_id", companyId),
      client.from("orders").select(tableColumns.orders).eq("company_id", companyId).order("created_at", { ascending: false }),
      client.from("customers").select(tableColumns.customers).eq("company_id", companyId),
      client.from("voucher_brands").select(tableColumns.voucher_brands).eq("company_id", companyId),
      client.from("delivery_zones").select(tableColumns.delivery_zones).eq("company_id", companyId),
      client.from("coupons").select(tableColumns.coupons).eq("company_id", companyId),
      client.from("settings").select(tableColumns.settings).eq("company_id", companyId),
      client.from("print_settings").select(tableColumns.print_settings).eq("company_id", companyId),
    ]);

    const adminResponses = includeAdminData
      ? await Promise.all([
          client.from("users").select(tableColumns.users).eq("company_id", companyId),
          client.from("order_items").select(tableColumns.order_items).eq("company_id", companyId),
          client.from("cash_sales").select(tableColumns.cash_sales).eq("company_id", companyId),
          client.from("reports").select(tableColumns.reports).eq("company_id", companyId),
          client.from("inventory_items").select(tableColumns.inventory_items).eq("company_id", companyId).order("updated_at", { ascending: false }),
        ])
      : [];
    const [users, order_items, cash_sales, reports, inventory_items] = adminResponses;

    const responses = [categories, products, orders, customers, voucher_brands, delivery_zones, coupons, settings, print_settings, ...adminResponses];
    const failed = responses.find((response) => response.error && !(response === inventory_items && isMissingOptionalInventoryTable(response.error)));
    if (failed?.error) throw failed.error;

    return withDefaults({
      companies: [company as Company],
      plans,
      master_users: [],
      users: (users?.data || []) as unknown as MockDatabaseState["users"],
      categories: (categories.data || []) as unknown as MockDatabaseState["categories"],
      products: (products.data || []) as unknown as MockDatabaseState["products"],
      orders: (orders.data || []) as unknown as MockDatabaseState["orders"],
      order_items: (order_items?.data || []) as unknown as MockDatabaseState["order_items"],
      customers: (customers.data || []) as unknown as MockDatabaseState["customers"],
      voucher_brands: (voucher_brands.data || []) as unknown as MockDatabaseState["voucher_brands"],
      delivery_zones: (delivery_zones.data || []) as unknown as MockDatabaseState["delivery_zones"],
      coupons: (coupons.data || []) as unknown as MockDatabaseState["coupons"],
      settings: (settings.data || []) as unknown as MockDatabaseState["settings"],
      cash_sales: (cash_sales?.data || []) as unknown as MockDatabaseState["cash_sales"],
      print_settings: (print_settings.data || []) as unknown as MockDatabaseState["print_settings"],
      reports: (reports?.data || []) as unknown as MockDatabaseState["reports"],
      inventory_items: (inventory_items && !inventory_items.error ? inventory_items.data || [] : []) as unknown as MockDatabaseState["inventory_items"],
    });
  } catch (error) {
    console.error("Falha ao carregar lancheria no Supabase.", error);
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }
}

export async function persistDatabaseSnapshot(state: MockDatabaseState) {
  if (!isSupabaseConfigured) {
    if (allowLocalDatabaseFallback) {
      writeFallbackSnapshot(state);
      return;
    }
    const error = new Error("Supabase não configurado. Alteração principal não foi salva em backend persistente.");
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }

  try {
    for (const table of tableNames) {
      const rows = state[table as SnapshotKey] as unknown[];
      await syncTable(table, rows, table === "print_settings" ? "company_id" : "id");
    }
  } catch (error) {
    console.error("Falha ao sincronizar Supabase.", error);
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }
}

function mutateFallback(mutator: (state: MockDatabaseState) => MockDatabaseState) {
  const next = mutator(readFallbackSnapshot());
  writeFallbackSnapshot(next);
  return next;
}

export async function getCompanyBySlug(slug: string) {
  if (!isSupabaseConfigured) return createDatabaseApi(readFallbackSnapshot()).getCompanyBySlug(slug);
  const { data, error } = await requireSupabase().from("companies").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function getCompanyById(id: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().companies.find((company) => company.id === id) || null;
  const { data, error } = await requireSupabase().from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function getProductsByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().products.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("products").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data as Product[];
}

export async function getCategoriesByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().categories.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("categories").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as Category[];
}

export async function getOrdersByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().orders.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("orders").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function getCustomersByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().customers.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("customers").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data as Customer[];
}

export async function getDeliveryZonesByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().delivery_zones.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("delivery_zones").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data as DeliveryZone[];
}

export async function getCouponsByCompany(companyId: string) {
  if (!isSupabaseConfigured) return readFallbackSnapshot().coupons.filter((item) => item.company_id === companyId);
  const { data, error } = await requireSupabase().from("coupons").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data as Coupon[];
}

export async function createOrder(order: Order, items: MockDatabaseState["order_items"] = []) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, orders: [...state.orders, order], order_items: [...state.order_items, ...items] }));
    return order;
  }
  const created = await insertRow("orders", order);
  if (items.length) {
    const { error } = await requireSupabase().from("order_items").insert(items as never);
    if (error) throw error;
  }
  return created as Order;
}

export async function updateOrderStatus(orderId: string, status: Order["status"]) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, orders: state.orders.map((order) => (order.id === orderId ? { ...order, status } : order)) }));
    return;
  }
  const { error } = await requireSupabase().from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

export async function createProduct(product: Product) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, products: [...state.products, product] }));
    return product;
  }
  return insertRow<Product>("products", product);
}

export async function updateProduct(product: Product) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, products: state.products.map((item) => (item.id === product.id ? product : item)) }));
    return product;
  }
  return updateRow<Product>("products", product);
}

export async function deleteProduct(productId: string) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, products: state.products.filter((item) => item.id !== productId) }));
    return;
  }
  return deleteById("products", productId);
}

export async function createCompany(company: Company, defaults?: { user?: User; settings?: Settings }) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({
      ...state,
      companies: [...state.companies, company],
      users: defaults?.user ? [...state.users, defaults.user] : state.users,
      settings: defaults?.settings ? [...state.settings, defaults.settings] : state.settings,
    }));
    return company;
  }
  const created = await insertRow<Company>("companies", company);
  if (defaults?.settings) await insertRow<Settings>("settings", defaults.settings);
  if (defaults?.user) await insertRow<User>("users", defaults.user);
  return created;
}

export async function updateCompany(company: Company) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, companies: state.companies.map((item) => (item.id === company.id ? company : item)) }));
    return company;
  }
  return updateRow<Company>("companies", company);
}

export async function deleteCompanyCascade(companyId: string) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({
      ...state,
      companies: state.companies.filter((item) => item.id !== companyId),
      users: state.users.filter((item) => item.company_id !== companyId),
      categories: state.categories.filter((item) => item.company_id !== companyId),
      products: state.products.filter((item) => item.company_id !== companyId),
      orders: state.orders.filter((item) => item.company_id !== companyId),
      order_items: state.order_items.filter((item) => item.company_id !== companyId),
      customers: state.customers.filter((item) => item.company_id !== companyId),
      delivery_zones: state.delivery_zones.filter((item) => item.company_id !== companyId),
      coupons: state.coupons.filter((item) => item.company_id !== companyId),
      settings: state.settings.filter((item) => item.company_id !== companyId),
      cash_sales: state.cash_sales.filter((item) => item.company_id !== companyId),
      print_settings: state.print_settings.filter((item) => item.company_id !== companyId),
      reports: state.reports.filter((item) => item.company_id !== companyId),
      inventory_items: state.inventory_items.filter((item) => item.company_id !== companyId),
    }));
    return;
  }

  const client = requireSupabase();
  for (const table of ["inventory_items", "reports", "print_settings", "cash_sales", "settings", "coupons", "delivery_zones", "customers", "order_items", "orders", "products", "categories", "users"] as TableName[]) {
    const { error } = await client.from(table).delete().eq("company_id", companyId);
    if (table === "inventory_items" && isMissingOptionalInventoryTable(error)) continue;
    if (error) throw error;
  }
  await deleteById("companies", companyId);
}

export async function createPlan(plan: Plan) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, plans: [...state.plans, plan] }));
    return plan;
  }
  return insertRow<Plan>("plans", plan);
}

export async function updatePlan(plan: Plan) {
  if (!isSupabaseConfigured) {
    mutateFallback((state) => ({ ...state, plans: state.plans.map((item) => (item.id === plan.id ? plan : item)) }));
    return plan;
  }
  return updateRow<Plan>("plans", plan);
}

export async function deletePlan(planId: string) {
  if (!isSupabaseConfigured) {
    const state = readFallbackSnapshot();
    if (state.companies.some((company) => company.plan_id === planId)) throw new Error("Plano em uso por uma empresa.");
    writeFallbackSnapshot({ ...state, plans: state.plans.filter((item) => item.id !== planId) });
    return;
  }
  const { count, error: countError } = await requireSupabase().from("companies").select("id", { count: "exact", head: true }).eq("plan_id", planId);
  if (countError) throw countError;
  if (count) throw new Error("Plano em uso por uma empresa.");
  return deleteById("plans", planId);
}

export async function uploadPublicImage(companyId: string, kind: string, file: File) {
  if (!isSupabaseConfigured || !supabase) return "";
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `companies/${companyId}/${kind}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(PUBLIC_STORAGE_BUCKET).upload(path, file, {
    cacheControl: "60",
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PUBLIC_STORAGE_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
