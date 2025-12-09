import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCompany } from '@/actions/company'
import { CompanyPageContent } from '@/components/company/company-page-content'

export default async function CompanyPage() {
  const company = await getCompany()

  return (
    <DashboardLayout>
      <CompanyPageContent company={company} />
    </DashboardLayout>
  )
}
