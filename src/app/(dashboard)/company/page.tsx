// RSC minimal : le store live est seedé par le layout (dashboard), le contenu
// lit useLiveCompany() (Realtime + optimistic, zéro refetch).
import { CompanyPageContent } from '@/components/company/company-page-content'

export default function CompanyPage() {
  return <CompanyPageContent />
}
