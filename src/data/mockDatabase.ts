export type ID = string;

export type CompanyStatus = "trial" | "active" | "blocked" | "canceled" | "disabled";
export type SubscriptionStatus = "trialing" | "active" | "overdue" | "canceled";
export type AssistantStatus = "inactive" | "active" | "trial" | "blocked";
export type UserRole = "dono" | "gerente" | "caixa" | "atendente";
export type MasterRole = "master";
export type CouponType = "percentual" | "fixo";
export type OrderStatus =
  | "novo"
  | "aceito"
  | "preparando"
  | "saiu_para_entrega"
  | "pronto_para_retirada"
  | "concluido"
  | "cancelado";
export type Fulfillment = "delivery" | "pickup";
export type PaymentMethod = "Pix" | "Cartão" | "Dinheiro" | "Vale alimentação/refeição";

export type Company = {
  id: ID;
  name: string;
  slug: string;
  logo_url: string;
  banner_url: string;
  whatsapp: string;
  address: string;
  hero_image: string;
  primary_color: string;
  minimum_order: number;
  estimated_delivery_time: string;
  is_open: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  status: CompanyStatus;
  plan: string;
  is_registration_enabled: boolean;
  plan_id: ID;
  subscription_status: SubscriptionStatus;
  monthly_price: number;
  due_day: number;
  next_due_date: string;
  last_payment_date: string;
  payment_notes: string;
  assistant_enabled?: boolean;
  assistant_status?: AssistantStatus;
  assistant_trial_until?: string;
  assistant_notes?: string;
  assistant_plan?: string;
  footer_message: string;
  opening_hours: string;
  created_at: string;
  updated_at?: string;
};

export type Plan = {
  id: ID;
  name: string;
  monthly_price: number;
  max_products: number;
  max_users: number;
  allow_reports: boolean;
  allow_printing: boolean;
  allow_coupons: boolean;
  is_active: boolean;
};

export type User = {
  id: ID;
  company_id: ID;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type MasterUser = {
  id: ID;
  name: string;
  email: string;
  password: string;
  role: MasterRole;
  is_active: boolean;
};

export type Category = {
  id: ID;
  company_id: ID;
  name: string;
  emoji?: string;
  sort_order: number;
  active: boolean;
};

export type Product = {
  id: ID;
  company_id: ID;
  category_id: ID;
  name: string;
  description: string;
  price: number;
  image: string;
  ingredients: string;
  preparation_time: number;
  featured: boolean;
  active: boolean;
  badge?: string;
};

export type Customer = {
  id: ID;
  company_id: ID;
  name: string;
  phone: string;
  normalized_phone: string;
  address: string;
  updated_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string;
  created_at: string;
};

export type VoucherBrand = {
  id: ID;
  company_id: ID;
  name: string;
  fee_percentage: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DeliveryZone = {
  id: ID;
  company_id: ID;
  neighborhood: string;
  fee: number;
  estimated_minutes: string;
  active: boolean;
};

export type Coupon = {
  id: ID;
  company_id: ID;
  code: string;
  type: CouponType;
  value: number;
  minimum_order: number;
  usage_limit: number;
  used_count: number;
  expires_at: string;
  active: boolean;
};

export type OrderItem = {
  id: ID;
  company_id: ID;
  order_id: ID;
  product_id: ID;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type Order = {
  id: ID;
  order_number?: number;
  company_id: ID;
  customer_id: ID;
  customer_name?: string;
  customer_phone?: string;
  normalized_phone?: string;
  customer_address?: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  delivery_zone_id?: ID;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  payment_method: PaymentMethod;
  payment_details?: string;
  cash_change_for?: number;
  calculated_change?: number;
  change_for?: number;
  change_amount?: number;
  card_type?: "Débito" | "Crédito";
  voucher_brand?: string;
  voucher_fee_percentage?: number;
  payment_status?: string;
  pix_txid?: string;
  pix_payload?: string;
  pix_qr_code?: string;
  customer_note?: string;
  archived?: boolean;
  archived_at?: string;
  removedFromDashboard?: boolean;
  removed_from_dashboard?: boolean;
  created_at: string;
};

export type CashSaleItem = {
  product_id: ID;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type CashSale = {
  id: ID;
  company_id: ID;
  items: CashSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  created_by: ID;
  created_at: string;
};

export type PrintSettings = {
  company_id: ID;
  auto_print_orders: boolean;
  auto_print_cash_sales: boolean;
  printer_name: string;
  paper_width: "58mm" | "80mm";
  copies: number;
  footer_text: string;
};

export type Settings = {
  id: ID;
  company_id: ID;
  critical_locked: boolean;
  pix_enabled?: boolean;
  pix_key?: string;
  pix_receiver_name?: string;
  pix_city?: string;
  pix_description?: string;
};

export type Report = {
  id: ID;
  company_id: ID;
  name: string;
  type: "online" | "cash" | "all";
  created_at: string;
};

export type InventoryUnit = "un" | "kg" | "g" | "litro" | "ml" | "pacote" | "caixa";

export type InventoryItem = {
  id: ID;
  company_id: ID;
  name: string;
  category: string;
  current_quantity: number;
  minimum_quantity: number;
  unit: InventoryUnit;
  notes: string;
  active: boolean;
  purchase_flag: boolean;
  purchase_resolved: boolean;
  created_at: string;
  updated_at: string;
};

export type MockDatabaseState = {
  companies: Company[];
  plans: Plan[];
  users: User[];
  master_users: MasterUser[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  order_items: OrderItem[];
  customers: Customer[];
  voucher_brands: VoucherBrand[];
  delivery_zones: DeliveryZone[];
  coupons: Coupon[];
  settings: Settings[];
  cash_sales: CashSale[];
  print_settings: PrintSettings[];
  reports: Report[];
  inventory_items: InventoryItem[];
};

const now = "2026-04-26T12:00:00.000Z";
const yesterday = "2026-04-25T12:00:00.000Z";
const monthStart = "2026-04-01T12:00:00.000Z";
const portoAlegreNeighborhoods = [
  "Aberta dos Morros", "Agronomia", "Anchieta", "ArquipÃ©lago", "Auxiliadora", "Azenha", "Bela Vista", "BelÃ©m Novo", "BelÃ©m Velho", "Boa Vista", "Boa Vista do Sul", "Bom Fim", "Bom Jesus", "CamaquÃ£", "Campo Novo", "Cascata", "Cavalhada", "Centro", "Centro HistÃ³rico", "ChÃ¡cara das Pedras", "ChapÃ©u do Sol", "Cidade Baixa", "Coronel AparÃ­cio Borges", "Costa e Silva", "Cristal", "Cristo Redentor", "EspÃ­rito Santo", "Extrema", "Farrapos", "Farroupilha", "Floresta", "GlÃ³ria", "GuarujÃ¡", "HigienÃ³polis", "HÃ­pica", "HumaitÃ¡", "IndependÃªncia", "Ipanema", "Jardim BotÃ¢nico", "Jardim Carvalho", "Jardim do Salso", "Jardim Europa", "Jardim Floresta", "Jardim Isabel", "Jardim Itu", "Jardim Leopoldina", "Jardim LindÃ³ia", "Jardim SabarÃ¡", "Jardim SÃ£o Pedro", "Lageado", "Lami", "Lomba do Pinheiro", "MÃ¡rio Quintana", "Medianeira", "Menino Deus", "Moinhos", "Moinhos de Vento", "Mont Serrat", "Morro Santana", "Navegantes", "Nonoai", "Parque Santa FÃ©", "Partenon", "Passo da Areia", "Passo das Pedras", "Pedra Redonda", "PetrÃ³polis", "Pitinga", "Ponta Grossa", "Praia de Belas", "Restinga", "Rio Branco", "Rubem Berta", "Santa CecÃ­lia", "Santa Maria Goretti", "Santa Rosa de Lima", "Santa Tereza", "Santana", "Santo AntÃ´nio", "SÃ£o Caetano", "SÃ£o Geraldo", "SÃ£o João", "SÃ£o JosÃ©", "SÃ£o SebastiÃ£o", "Sarandi", "Serraria", "SÃ©timo CÃ©u", "TeresÃ³polis", "TrÃªs Figueiras", "Tristeza", "Vila AssunÃ§Ã£o", "Vila ConceiÃ§Ã£o", "Vila Ipiranga", "Vila Jardim", "Vila João Pessoa", "Vila Nova", "Vila SÃ£o JosÃ©",
];
const demoDeliveryZones: DeliveryZone[] = [
  { id: "zon_dog_1", company_id: "cmp_dogexpress", neighborhood: "Centro", fee: 7.9, estimated_minutes: "35-45", active: true },
  { id: "zon_dog_2", company_id: "cmp_dogexpress", neighborhood: "Moinhos", fee: 9.9, estimated_minutes: "45-55", active: true },
  { id: "zon_piz_1", company_id: "cmp_pizzariajoao", neighborhood: "Centro", fee: 8.9, estimated_minutes: "40-50", active: true },
  { id: "zon_piz_2", company_id: "cmp_pizzariajoao", neighborhood: "Bom Fim", fee: 10.9, estimated_minutes: "50-60", active: true },
  { id: "zon_bur_1", company_id: "cmp_burguerpaulo", neighborhood: "Moinhos", fee: 6.9, estimated_minutes: "30-40", active: true },
];

function normalizedNeighborhood(value: string) {
  return fixMojibake(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}

function fixMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    return decodeURIComponent(value.split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return value;
  }
}

function zonesForCompany(company_id: ID) {
  const existing = demoDeliveryZones.filter((zone) => zone.company_id === company_id).map((zone) => ({ ...zone, neighborhood: fixMojibake(zone.neighborhood) }));
  const existingNames = new Set(existing.map((zone) => normalizedNeighborhood(zone.neighborhood)));
  return [
    ...existing,
    ...portoAlegreNeighborhoods
      .map(fixMojibake)
      .filter((neighborhood) => !existingNames.has(normalizedNeighborhood(neighborhood)))
      .map((neighborhood, index) => ({ id: `zon_${company_id}_${index}`, company_id, neighborhood, fee: 0, estimated_minutes: "A combinar", active: true })),
  ];
}

function normalizeSeedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
}

export const initialMockDatabase: MockDatabaseState = {
  plans: [
    { id: "plan_start", name: "Start", monthly_price: 49.9, max_products: 30, max_users: 3, allow_reports: false, allow_printing: false, allow_coupons: false, is_active: true },
    { id: "plan_pro", name: "Pro", monthly_price: 79.9, max_products: 120, max_users: 8, allow_reports: true, allow_printing: true, allow_coupons: true, is_active: true },
    { id: "plan_premium", name: "Premium", monthly_price: 129.9, max_products: 999, max_users: 30, allow_reports: true, allow_printing: true, allow_coupons: true, is_active: true },
  ],
  companies: [
    {
      id: "cmp_dogexpress",
      name: "DogExpress POA",
      slug: "dogexpress",
      logo_url: "",
      banner_url: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80",
      whatsapp: "5551999990000",
      address: "Av. CristÃ³vÃ£o Colombo, 820 - Porto Alegre",
      hero_image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80",
      primary_color: "#116a4b",
      minimum_order: 25,
      estimated_delivery_time: "35-45 min",
      is_open: true,
      delivery_enabled: true,
      pickup_enabled: true,
      status: "active",
      plan: "Pro",
      is_registration_enabled: true,
      plan_id: "plan_pro",
      subscription_status: "active",
      monthly_price: 79.9,
      due_day: 10,
      next_due_date: "2026-05-10",
      last_payment_date: "2026-04-10",
      payment_notes: "Pagamento em dia.",
      assistant_enabled: true,
      assistant_status: "trial",
      assistant_trial_until: "2026-06-30T23:59:59.000Z",
      assistant_notes: "Teste liberado para demonstracao.",
      assistant_plan: "mvp",
      footer_message: "produzido por Startt Facilities",
      opening_hours: "Aberto hoje, 10:30 às 22:30",
      created_at: "2026-01-10T10:00:00.000Z",
    },
    {
      id: "cmp_pizzariajoao",
      name: "Pizzaria do João",
      slug: "pizzariadojoao",
      logo_url: "",
      banner_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1600&q=80",
      whatsapp: "5551988880000",
      address: "Rua das Massas, 45 - Centro",
      hero_image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1600&q=80",
      primary_color: "#b63d2a",
      minimum_order: 45,
      estimated_delivery_time: "40-55 min",
      is_open: true,
      delivery_enabled: true,
      pickup_enabled: true,
      status: "trial",
      plan: "Starter",
      is_registration_enabled: true,
      plan_id: "plan_start",
      subscription_status: "trialing",
      monthly_price: 49.9,
      due_day: 15,
      next_due_date: "2026-05-15",
      last_payment_date: "",
      payment_notes: "Trial ativo.",
      footer_message: "produzido por Startt Facilities",
      opening_hours: "Aberto hoje, 18:00 às 23:30",
      created_at: "2026-02-03T10:00:00.000Z",
    },
    {
      id: "cmp_burguerpaulo",
      name: "Burguer do Paulo",
      slug: "burguerdopaulo",
      logo_url: "",
      banner_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1600&q=80",
      whatsapp: "5551977770000",
      address: "Rua do Grill, 318 - Moinhos",
      hero_image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1600&q=80",
      primary_color: "#8f4a18",
      minimum_order: 30,
      estimated_delivery_time: "30-40 min",
      is_open: false,
      delivery_enabled: true,
      pickup_enabled: false,
      status: "active",
      plan: "Pro",
      is_registration_enabled: true,
      plan_id: "plan_pro",
      subscription_status: "active",
      monthly_price: 79.9,
      due_day: 20,
      next_due_date: "2026-05-20",
      last_payment_date: "2026-04-20",
      payment_notes: "Pagamento em dia.",
      footer_message: "produzido por Startt Facilities",
      opening_hours: "Fechado agora, abre às 18:00",
      created_at: "2026-03-12T10:00:00.000Z",
    },
  ],
  master_users: [{ id: "mst_1", name: "Admin Master", email: "master@startt.com", password: "Achieve123", role: "master", is_active: true }],
  users: [
    { id: "usr_dog_owner", company_id: "cmp_dogexpress", name: "Marina Alves", email: "admin@dogexpress.com", password: "Startt123", role: "dono", is_active: true, created_at: now },
    { id: "usr_dog_cash", company_id: "cmp_dogexpress", name: "Caixa Dog", email: "caixa@dogexpress.com", password: "Startt123", role: "caixa", is_active: true, created_at: now },
    { id: "usr_piz_owner", company_id: "cmp_pizzariajoao", name: "João Pereira", email: "admin@pizzariadojoao.com", password: "Startt123", role: "dono", is_active: true, created_at: now },
    { id: "usr_bur_owner", company_id: "cmp_burguerpaulo", name: "Paulo Mendes", email: "admin@burguerdopaulo.com", password: "Startt123", role: "dono", is_active: true, created_at: now },
  ],
  categories: [
    { id: "cat_dog_1", company_id: "cmp_dogexpress", name: "Dogs", emoji: "🌭", sort_order: 1, active: true },
    { id: "cat_dog_2", company_id: "cmp_dogexpress", name: "Combos", emoji: "🍟", sort_order: 2, active: true },
    { id: "cat_dog_3", company_id: "cmp_dogexpress", name: "Bebidas", emoji: "🥤", sort_order: 3, active: true },
    { id: "cat_piz_1", company_id: "cmp_pizzariajoao", name: "Pizzas", emoji: "🍕", sort_order: 1, active: true },
    { id: "cat_piz_2", company_id: "cmp_pizzariajoao", name: "Calzones", emoji: "🥟", sort_order: 2, active: true },
    { id: "cat_piz_3", company_id: "cmp_pizzariajoao", name: "Bebidas", emoji: "🥤", sort_order: 3, active: true },
    { id: "cat_bur_1", company_id: "cmp_burguerdopaulo", name: "Hambúrgueres", emoji: "🍔", sort_order: 1, active: true },
    { id: "cat_bur_2", company_id: "cmp_burguerdopaulo", name: "Combos", emoji: "🍟", sort_order: 2, active: true },
  ].map((category) => category.company_id === "cmp_burguerdopaulo" ? { ...category, company_id: "cmp_burguerpaulo" } : category),
  products: [
    { id: "prd_dog_1", company_id: "cmp_dogexpress", category_id: "cat_dog_1", name: "Dog Startt Clássico", description: "Pão macio, salsicha premium, molho da casa, batata palha e milho.", price: 22.9, image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=900&q=80", ingredients: "Pão, salsicha premium, milho, batata palha, ketchup, maionese e molho da casa", preparation_time: 12, featured: true, active: true, badge: "Mais pedido" },
    { id: "prd_dog_2", company_id: "cmp_dogexpress", category_id: "cat_dog_2", name: "Combo Dog + Refri", description: "Dog clÃ¡ssico, refrigerante lata e embalagem lacrada para viagem.", price: 31.9, image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=900&q=80", ingredients: "Dog clÃ¡ssico, refrigerante lata e embalagem para viagem", preparation_time: 15, featured: false, active: true, badge: "Combo" },
    { id: "prd_dog_3", company_id: "cmp_dogexpress", category_id: "cat_dog_3", name: "Refrigerante lata", description: "Coca-Cola, Guaraná ou Sprite. 350 ml.", price: 7.9, image: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=900&q=80", ingredients: "Bebida lata 350 ml", preparation_time: 1, featured: false, active: true },
    { id: "prd_piz_1", company_id: "cmp_pizzariajoao", category_id: "cat_piz_1", name: "Pizza Margherita", description: "Molho artesanal, muçarela, tomate, manjericÃ£o e azeite.", price: 59.9, image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80", ingredients: "Massa artesanal, molho de tomate, muçarela, tomate, manjericÃ£o e azeite", preparation_time: 30, featured: true, active: true, badge: "Forno a lenha" },
    { id: "prd_piz_2", company_id: "cmp_pizzariajoao", category_id: "cat_piz_2", name: "Calzone quatro queijos", description: "Massa fina, parmesão, provolone, gorgonzola e muçarela.", price: 42.5, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80", ingredients: "Massa fina, parmesão, provolone, gorgonzola e muçarela", preparation_time: 24, featured: false, active: true },
    { id: "prd_bur_1", company_id: "cmp_burguerpaulo", category_id: "cat_bur_1", name: "Smash Paulo", description: "Dois smash burgers, cheddar, cebola caramelizada e molho especial.", price: 34.9, image: "https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=900&q=80", ingredients: "Pão brioche, dois smash burgers, cheddar, cebola caramelizada e molho especial", preparation_time: 18, featured: true, active: true, badge: "Assinatura" },
    { id: "prd_bur_2", company_id: "cmp_burguerpaulo", category_id: "cat_bur_2", name: "Combo Smash", description: "Smash Paulo, fritas rústicas e bebida lata.", price: 47.9, image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=900&q=80", ingredients: "Smash Paulo, fritas rústicas e bebida lata", preparation_time: 22, featured: false, active: true },
  ],
  customers: [
    { id: "cus_dog_1", company_id: "cmp_dogexpress", name: "Rafael Costa", phone: "(51) 99999-1010", normalized_phone: normalizeSeedPhone("(51) 99999-1010"), address: "Centro", total_orders: 4, total_spent: 206.5, last_order_at: now, created_at: now, updated_at: now },
    { id: "cus_dog_2", company_id: "cmp_dogexpress", name: "Marina Alves", phone: "(51) 99999-2020", normalized_phone: normalizeSeedPhone("(51) 99999-2020"), address: "Moinhos", total_orders: 2, total_spent: 151.7, last_order_at: yesterday, created_at: yesterday, updated_at: yesterday },
    { id: "cus_piz_1", company_id: "cmp_pizzariajoao", name: "Clara Nunes", phone: "(51) 98888-3030", normalized_phone: normalizeSeedPhone("(51) 98888-3030"), address: "Bom Fim", total_orders: 1, total_spent: 73.8, last_order_at: now, created_at: now, updated_at: now },
    { id: "cus_bur_1", company_id: "cmp_burguerpaulo", name: "Lucas Vieira", phone: "(51) 97777-4040", normalized_phone: normalizeSeedPhone("(51) 97777-4040"), address: "Auxiliadora", total_orders: 1, total_spent: 61.8, last_order_at: monthStart, created_at: monthStart, updated_at: monthStart },
  ],
  voucher_brands: [
    { id: "vou_dog_1", company_id: "cmp_dogexpress", name: "Alelo", fee_percentage: 4.5, active: true, created_at: now, updated_at: now },
    { id: "vou_dog_2", company_id: "cmp_dogexpress", name: "Sodexo", fee_percentage: 5, active: true, created_at: now, updated_at: now },
    { id: "vou_dog_3", company_id: "cmp_dogexpress", name: "VR", fee_percentage: 4, active: false, created_at: now, updated_at: now },
    { id: "vou_piz_1", company_id: "cmp_pizzariajoao", name: "Ticket", fee_percentage: 3.8, active: true, created_at: now, updated_at: now },
    { id: "vou_bur_1", company_id: "cmp_burguerpaulo", name: "Pluxee", fee_percentage: 4.2, active: true, created_at: now, updated_at: now },
  ],
  delivery_zones: [...zonesForCompany("cmp_dogexpress"), ...zonesForCompany("cmp_pizzariajoao"), ...zonesForCompany("cmp_burguerpaulo")],
  coupons: [
    { id: "cup_dog_1", company_id: "cmp_dogexpress", code: "DOG10", type: "percentual", value: 10, minimum_order: 25, usage_limit: 100, used_count: 3, expires_at: "2026-12-31", active: true },
    { id: "cup_piz_1", company_id: "cmp_pizzariajoao", code: "PIZZA15", type: "percentual", value: 15, minimum_order: 45, usage_limit: 80, used_count: 5, expires_at: "2026-12-31", active: true },
    { id: "cup_bur_1", company_id: "cmp_burguerpaulo", code: "PAULO5", type: "fixo", value: 5, minimum_order: 30, usage_limit: 50, used_count: 1, expires_at: "2026-12-31", active: true },
  ],
  orders: [
    { id: "ord_dog_1", order_number: 10231, company_id: "cmp_dogexpress", customer_id: "cus_dog_1", status: "preparando", fulfillment: "delivery", delivery_zone_id: "zon_dog_1", subtotal: 54.8, discount: 0, delivery_fee: 7.9, total: 62.7, payment_method: "Pix", payment_status: "Aguardando comprovante", pix_txid: "STDOG10231", created_at: now },
    { id: "ord_dog_2", order_number: 10232, company_id: "cmp_dogexpress", customer_id: "cus_dog_2", status: "saiu_para_entrega", fulfillment: "delivery", delivery_zone_id: "zon_dog_2", subtotal: 151.7, discount: 10, delivery_fee: 9.9, total: 151.6, payment_method: "Cartão", card_type: "Crédito", payment_details: "Cartão • Crédito", created_at: yesterday },
    { id: "ord_piz_1", order_number: 48392, company_id: "cmp_pizzariajoao", customer_id: "cus_piz_1", status: "novo", fulfillment: "pickup", subtotal: 73.8, discount: 0, delivery_fee: 0, total: 73.8, payment_method: "Pix", payment_status: "Aguardando comprovante", pix_txid: "STPIZ48392", created_at: now },
    { id: "ord_bur_1", order_number: 39218, company_id: "cmp_burguerpaulo", customer_id: "cus_bur_1", status: "concluido", fulfillment: "delivery", delivery_zone_id: "zon_bur_1", subtotal: 54.9, discount: 0, delivery_fee: 6.9, total: 61.8, payment_method: "Dinheiro", cash_change_for: 100, calculated_change: 38.2, created_at: monthStart },
  ],
  order_items: [
    { id: "oit_1", company_id: "cmp_dogexpress", order_id: "ord_dog_1", product_id: "prd_dog_1", name: "Dog Startt Clássico", quantity: 2, unit_price: 22.9, total: 45.8 },
    { id: "oit_2", company_id: "cmp_dogexpress", order_id: "ord_dog_1", product_id: "prd_dog_3", name: "Refrigerante lata", quantity: 1, unit_price: 7.9, total: 7.9 },
    { id: "oit_3", company_id: "cmp_pizzariajoao", order_id: "ord_piz_1", product_id: "prd_piz_1", name: "Pizza Margherita", quantity: 1, unit_price: 59.9, total: 59.9 },
  ],
  settings: [
    { id: "set_dog_1", company_id: "cmp_dogexpress", critical_locked: false, pix_enabled: true, pix_key: "+5551992885988" },
    { id: "set_piz_1", company_id: "cmp_pizzariajoao", critical_locked: false, pix_enabled: true, pix_key: "+5551992885988" },
    { id: "set_bur_1", company_id: "cmp_burguerpaulo", critical_locked: false, pix_enabled: true, pix_key: "+5551992885988" },
  ],
  cash_sales: [
    { id: "cash_dog_1", company_id: "cmp_dogexpress", items: [{ product_id: "prd_dog_1", name: "Dog Startt Clássico", quantity: 1, unit_price: 22.9, total: 22.9 }], subtotal: 22.9, discount: 0, total: 22.9, payment_method: "Dinheiro", created_by: "usr_dog_cash", created_at: now },
  ],
  print_settings: [
    { company_id: "cmp_dogexpress", auto_print_orders: false, auto_print_cash_sales: false, printer_name: "Balcão", paper_width: "80mm", copies: 1, footer_text: "Startt Delivery — produzido por Startt Facilities" },
    { company_id: "cmp_pizzariajoao", auto_print_orders: true, auto_print_cash_sales: true, printer_name: "Cozinha", paper_width: "80mm", copies: 2, footer_text: "Obrigado pela preferência" },
    { company_id: "cmp_burguerpaulo", auto_print_orders: true, auto_print_cash_sales: false, printer_name: "Caixa", paper_width: "58mm", copies: 1, footer_text: "Volte sempre" },
  ],
  reports: [
    { id: "rep_dog_1", company_id: "cmp_dogexpress", name: "Resumo diário", type: "all", created_at: now },
  ],
  inventory_items: [
    { id: "inv_dog_1", company_id: "cmp_dogexpress", name: "Salsicha premium", category: "Cozinha", current_quantity: 18, minimum_quantity: 10, unit: "un", notes: "Usada nos dogs principais", active: true, purchase_flag: false, purchase_resolved: false, created_at: now, updated_at: now },
    { id: "inv_dog_2", company_id: "cmp_dogexpress", name: "Pão de hot dog", category: "Padaria", current_quantity: 6, minimum_quantity: 12, unit: "un", notes: "", active: true, purchase_flag: true, purchase_resolved: false, created_at: now, updated_at: now },
  ],
};

export function createDatabaseApi(state: MockDatabaseState) {
  return {
    ...state,
    getCompanyBySlug(slug: string) {
      return state.companies.find((company) => company.slug === slug);
    },
    getCompanyBundle(company_id: ID) {
      return {
        company: state.companies.find((company) => company.id === company_id),
        plan: state.plans.find((plan) => plan.id === state.companies.find((company) => company.id === company_id)?.plan_id),
        users: state.users.filter((item) => item.company_id === company_id),
        categories: state.categories.filter((item) => item.company_id === company_id).sort((a, b) => a.sort_order - b.sort_order),
        products: state.products.filter((item) => item.company_id === company_id),
        orders: state.orders.filter((item) => item.company_id === company_id),
        order_items: state.order_items.filter((item) => item.company_id === company_id),
        customers: state.customers.filter((item) => item.company_id === company_id),
        voucher_brands: state.voucher_brands.filter((item) => item.company_id === company_id),
        delivery_zones: state.delivery_zones.filter((item) => item.company_id === company_id),
        coupons: state.coupons.filter((item) => item.company_id === company_id),
        settings: state.settings.find((item) => item.company_id === company_id),
        cash_sales: state.cash_sales.filter((item) => item.company_id === company_id),
        print_settings: state.print_settings.find((item) => item.company_id === company_id),
        reports: state.reports.filter((item) => item.company_id === company_id),
        inventory_items: state.inventory_items.filter((item) => item.company_id === company_id),
      };
    },
  };
}

export const mockDatabase = createDatabaseApi(initialMockDatabase);


