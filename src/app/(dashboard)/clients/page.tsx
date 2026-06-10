// RSC minimal : le store live est seedé par le layout (dashboard), le contenu
// lit useLiveCompany/useLiveClients (Realtime + optimistic, zéro refetch).
import { ClientsContent } from '@/components/clients/clients-content'

export default function ClientsPage() {
  return <ClientsContent />
}
