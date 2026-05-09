import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Users,
  Settings,
  X
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const menu = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Produtos',
    icon: ShoppingBag
  },
  {
    label: 'Pedidos',
    icon: ClipboardList
  },
  {
    label: 'Clientes',
    icon: Users
  },
  {
    label: 'Configurações',
    icon: Settings
  }
]

export default function Sidebar({
  open,
  onClose
}: SidebarProps) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[280px] bg-black text-white transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              Startt Delivery
            </h1>

            <p className="text-xs text-gray-400">
              Produzido por Startt Facilities
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-white/10 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-2 p-4">
          {menu.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/10"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}