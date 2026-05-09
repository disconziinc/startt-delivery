import { Menu, Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenu?: () => void
}

export default function Header({
  title,
  onMenu
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-xl p-2 hover:bg-gray-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {title}
          </h1>

          <p className="text-sm text-gray-500">
            Produto Startt - Produzido por Startt Facilities
          </p>
        </div>
      </div>

      <button className="relative rounded-xl p-2 hover:bg-gray-100">
        <Bell size={20} />

        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
      </button>
    </header>
  )
}