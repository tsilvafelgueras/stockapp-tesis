'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-white/72 transition-colors hover:text-white"
    >
      <LogOut className="size-4" />
      Salir
    </button>
  )
}
