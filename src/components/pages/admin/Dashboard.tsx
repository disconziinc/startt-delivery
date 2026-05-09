import { useState } from 'react'

import Header from '../../components/layout/Header'
import Sidebar from '../../components/layout/Sidebar'
import PageContainer from '../../components/layout/PageContainer'

import StatsCards from '../../components/dashboard/StatsCards'

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <PageContainer>
        <Header
          title="Dashboard"
          onMenu={() => setSidebarOpen(true)}
        />

        <div className="mt-6">
          <StatsCards />
        </div>
      </PageContainer>
    </>
  )
}