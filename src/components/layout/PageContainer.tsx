import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function PageContainer({ children }: Props) {
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6 lg:ml-[280px]">
      {children}
    </main>
  )
}