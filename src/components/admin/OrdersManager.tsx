import { useState } from 'react'

export default function OrdersManager({
  bundle,
  setDbState,
  company,
  user
}: {
  bundle: ReturnType<DatabaseApi['getCompanyBundle']>
  setDbState: React.Dispatch<React.SetStateAction<MockDatabaseState>>
  company: Company
  user: User
}) {
  const [status, setStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')

  const rows = bundle.orders.filter(
    (order) =>
      (status === 'todos' || order.status === status) &&
      (!date || order.created_at.slice(0, 10) === date) &&
      customerName(order.customer_id, bundle.customers)
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  function update(order: Order, next: OrderStatus) {
    setDbState((current) => ({
      ...current,
      orders: current.orders.map((item) =>
        item.id === order.id && item.company_id === company.id
          ? { ...item, status: next }
          : item
      )
    }))

    notify('success', 'Status do pedido atualizado.')
  }

  function remove(order: Order) {
    if (!['dono', 'gerente'].includes(user.role)) {
      notify(
        'error',
        'Seu usuário não tem permissão para excluir pedidos.'
      )

      return
    }

    if (!confirm(`Excluir pedido #${displayOrderNumber(order)}?`))
      return

    setDbState((current) => ({
      ...current,
      orders: current.orders.filter(
        (item) =>
          !(
            item.id === order.id &&
            item.company_id === company.id
          )
      ),

      order_items: current.order_items.filter(
        (item) =>
          !(
            item.order_id === order.id &&
            item.company_id === company.id
          )
      )
    }))

    notify('success', 'Pedido excluído com sucesso.')
  }

  return (
    <CrudShell
      title="Pedidos"
      description="Pedidos recebidos do cardápio online."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder="Buscar cliente"
          value={search}
          onChange={setSearch}
        />

        <Input
          placeholder=""
          type="date"
          value={date}
          onChange={setDate}
        />

        <Select
          value={status}
          onChange={setStatus}
        >
          <option value="todos">Todos</option>

          {orderStatuses.map((item) => (
            <option key={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      <Table
        headers={[
          'Pedido',
          'Cliente',
          'Status',
          'Total',
          'Ações'
        ]}
        rows={rows.map((order) => [
          `#${displayOrderNumber(order)}`,

          customerName(
            order.customer_id,
            bundle.customers
          ),

          order.status,

          money(order.total),

          <div
            className="flex flex-wrap gap-2"
            key={order.id}
          >
            <Select
              value={order.status}
              onChange={(value) =>
                update(
                  order,
                  value as OrderStatus
                )
              }
            >
              {orderStatuses.map((item) => (
                <option key={item}>
                  {item}
                </option>
              ))}
            </Select>

            <button
              className="rounded-lg border px-3 font-bold"
              onClick={() =>
                printOrder(
                  company,
                  order,
                  bundle
                )
              }
            >
              Imprimir
            </button>

            <button
              className="rounded-lg border px-3 font-bold"
              onClick={() =>
                sendOrderUpdate(
                  order,
                  customerName(
                    order.customer_id,
                    bundle.customers
                  ),
                  company
                )
              }
            >
              WhatsApp
            </button>

            {['dono', 'gerente'].includes(
              user.role
            ) && (
              <button
                className="rounded-lg bg-startt-red px-3 py-2 font-bold text-white"
                onClick={() => remove(order)}
              >
                Excluir
              </button>
            )}
          </div>
        ])}
      />
    </CrudShell>
  )
}