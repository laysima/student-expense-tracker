'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LaunchRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return null
}
