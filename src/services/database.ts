import { supabase, isSupabaseConfigured } from "../lib/supabase";
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

const tableNames = [
  "companies",
  "plans",
  "master_users",
  "users",
  "categories",
  "products",
  "orders",
  "order_items",
  "customers",
  "voucher_brands",
  "delivery_zones",
  "coupons",
  "settings",
  "cash_sales",
  "print_settings",
  "reports",
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
    const legacyStarter = company.plan === "Starter" || company.plan === "Start" || company.status === "trial";
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
      address: fixMojibake(company.address || ""),
      updated_at: company.updated_at || company.created_at || new Date().toISOString(),
    };
  });

  const products = (parsed.products || initialMockDatabase.products).map((product) => ({
    ...product,
    ingredients: product.ingredients || product.description || "",
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

  return { ...initialMockDatabase, ...parsed, plans, companies, products, master_users, delivery_zones, customers, orders, settings, voucher_brands };
}

function readFallbackSnapshot(): MockDatabaseState {
  try {
    const stored = localStorage.getItem(DATABASE_STORAGE_KEY);
    if (!stored) return initialMockDatabase;
    return withDefaults(JSON.parse(stored) as Partial<MockDatabaseState>);
  } catch {
    return initialMockDatabase;
  }
}

function writeFallbackSnapshot(state: MockDatabaseState) {
  localStorage.setItem(DATABASE_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("startt:database-changed", { detail: state }));
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

async function selectAll<T>(table: TableName): Promise<T[]> {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select("*");
  if (error) throw error;
  return (data || []) as T[];
}

async function insertRow<T>(table: TableName, row: T): Promise<T> {
  if (!isSupabaseConfigured) return row;
  const client = requireSupabase();
  const { data, error } = await client.from(table).insert(row as never).select("*").single();
  if (error) throw error;
  return data as T;
}

async function updateRow<T extends { id: string }>(table: TableName, row: T): Promise<T> {
  if (!isSupabaseConfigured) return row;
  const client = requireSupabase();
  const { data, error } = await client.from(table).update(row as never).eq("id", row.id).select("*").single();
  if (error) throw error;
  return data as T;
}

async function deleteById(table: TableName, id: string) {
  if (!isSupabaseConfigured) return;
  const client = requireSupabase();
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function syncTable(table: TableName, rows: unknown[], key: "id" | "company_id" = "id") {
  const client = requireSupabase();
  if (rows.length) {
    const { error } = await client.from(table).upsert(rows as never, { onConflict: key });
    if (error) throw error;
  }
}

export function getInitialDatabaseSnapshot(): MockDatabaseState {
  if (isSupabaseConfigured) return initialMockDatabase;
  return readFallbackSnapshot();
}

export async function loadDatabaseSnapshot(): Promise<MockDatabaseState> {
  if (!isSupabaseConfigured) return readFallbackSnapshot();

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
    });
  } catch (error) {
    console.error("Falha ao carregar Supabase.", error);
    window.dispatchEvent(new CustomEvent(DATABASE_SYNC_ERROR_EVENT, { detail: error }));
    throw error;
  }
}

export async function persistDatabaseSnapshot(state: MockDatabaseState) {
  if (!isSupabaseConfigured) {
    writeFallbackSnapshot(state);
    return;
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
  return insertRow<Company>("companies", company);
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
    }));
    return;
  }

  const client = requireSupabase();
  for (const table of ["reports", "print_settings", "cash_sales", "settings", "coupons", "delivery_zones", "customers", "order_items", "orders", "products", "categories", "users"] as TableName[]) {
    const { error } = await client.from(table).delete().eq("company_id", companyId);
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
