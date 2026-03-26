import { redirect } from 'next/navigation'
import { getUser } from '@/actions/auth'

export default async function Home() {
  const user = await getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
