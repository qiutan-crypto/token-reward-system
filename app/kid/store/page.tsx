'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RewardCatalog } from '@/types'

export default function KidStorePage() {
  const [prizes, setPrizes] = useState<RewardCatalog[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prizesData }, { data: balanceData }] = await Promise.all([
        supabase.from('reward_catalog').select('*').eq('active', true),
        supabase.rpc('get_token_balance', { p_kid_id: user.id })
      ])
      const stored: string[] = JSON.parse(localStorage.getItem('reward_sort_order') || '[]')
      const raw = prizesData || []
      if (stored.length) {
        const map = Object.fromEntries(raw.map((r: RewardCatalog) => [r.id, r]))
        const ordered = stored.filter((id: string) => map[id]).map((id: string) => map[id])
        const rest = raw.filter((r: RewardCatalog) => !stored.includes(r.id))
        setPrizes([...ordered, ...rest])
      } else {
        setPrizes(raw)
      }
      setBalance(balanceData || 0)
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleRedeem = async (prize: RewardCatalog) => {
    if (balance < prize.token_cost) {
      setMessage('兑换失败！Token不足。')
      return
    }
    setRedeeming(prize.id)
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: prize.id })
      })
      const result = await res.json()
      if (result.success) {
        setBalance(prev => prev - prize.token_cost)
        setMessage(`成功兑换: ${prize.title}! 剩余 ${balance - prize.token_cost} tokens`)
      } else {
        setMessage(result.error || '兑换失败')
      }
    } catch {
      setMessage('兑换失败，请重试')
    }
    setRedeeming(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
      <div className="text-2xl text-purple-500">加载中...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <a href="/kid" className="text-purple-600 hover:text-purple-800">← 返回</a>
          <h1 className="text-2xl font-bold text-purple-700">🛒 奖品商店</h1>
          <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm font-bold text-yellow-700">🪙 {balance}</div>
        </div>
        {message && (
          <div className="mb-4 p-3 bg-white rounded-xl text-center font-medium text-purple-700 shadow">
            {message}
            <button onClick={() => setMessage('')} className="ml-2 text-gray-400">×</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {prizes.map(prize => (
            <div key={prize.id} className="bg-white rounded-2xl shadow p-4 flex flex-col">
              {prize.image_url && (
                <img src={prize.image_url} alt={prize.title} className="w-full max-h-40 object-contain mb-3 mix-blend-multiply" />
              )}
              {!prize.image_url && (
                <div className="w-full h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mb-3 flex items-center justify-center text-5xl">
                  🎁
                </div>
              )}
              <h3 className="font-bold text-gray-800 mb-1">{prize.title}</h3>
              {prize.description && <p className="text-xs text-gray-500 mb-2">{prize.description}</p>}
              <div className="mt-auto">
                <div className="text-yellow-600 font-bold mb-2">🪙 {prize.token_cost} tokens</div>
                <button
                  onClick={() => handleRedeem(prize)}
                  disabled={balance < prize.token_cost || redeeming === prize.id}
                  className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                    balance >= prize.token_cost
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {redeeming === prize.id ? '处理中...' : balance >= prize.token_cost ? '兑换' : 'Token不足'}
                </button>
              </div>
            </div>
          ))}
        </div>
        {prizes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-4">📦</div>
            <p>奖品商店暂无商品</p>
          </div>
        )}
      </div>
    </div>
  )
}
