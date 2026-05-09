import Card from '../ui/Card'

const stats = [
  {
    title: 'Pedidos Hoje',
    value: '128'
  },
  {
    title: 'Faturamento',
    value: 'R$ 4.320'
  },
  {
    title: 'Clientes',
    value: '89'
  },
  {
    title: 'Produtos',
    value: '42'
  }
]

export default function StatsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <Card key={item.title}>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              {item.title}
            </p>

            <h2 className="text-3xl font-bold text-gray-800">
              {item.value}
            </h2>
          </div>
        </Card>
      ))}
    </div>
  )
}