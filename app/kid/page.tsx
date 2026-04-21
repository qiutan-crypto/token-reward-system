'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function KidHomePage() {
  const [balance, setBalance] = useState<number>(0)
  const [kidName, setKidName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalance = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (profile) setKidName(profile.name)

      const { data } = await supabase
        .rpc('get_token_balance', { p_kid_id: user.id })

      setBalance(data || 0)
      setLoading(false)
    }
    fetchBalance()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 to-orange-100">
      <div className="text-2xl text-orange-500">加载中...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-100">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⭐</div>
          <h1 className="text-3xl font-bold text-orange-600">你好, {kidName}!</h1>
          <p className="text-gray-600 mt-2">欢迎来到你的奖励中心</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8 mb-6 text-center">
          <p className="text-gray-500 text-sm mb-2">我的Token余额</p>
          <div className="text-6xl font-bold text-yellow-500 mb-2">{balance}</div>
          <div className="text-4xl">🪙</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/kid/store" className="bg-white rounded-2xl shadow p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-2">🛍️</div>
            <div className="font-semibold text-gray-700">奖品商店</div>
            <div className="text-xs text-gray-400 mt-1">用Token兑换奖品</div>
          </Link>
          <Link href="/kid/history" className="bg-white rounded-2xl shadow p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-2">📋</div>
            <div className="font-semibold text-gray-700">历史记录</div>
            <div className="text-xs text-gray-400 mt-1">查看Token记录</div>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
