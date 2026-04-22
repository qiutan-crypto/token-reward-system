'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TokenLedger } from '@/types'

export default function KidHistoryPage() {
  const [entries, setEntries] = useState<TokenLedger[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [noRecord, setNoRecord] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: childRecord } = await supabase
        .from('children')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!childRecord) { setNoRecord(true); setLoading(false); return }

      const [{ data: entriesData }, { data: balanceData }] = await Promise.all([
        supabase
          .from('token_ledger')
          .select('*, behavior_rules(title)')
          .eq('child_id', childRecord.id)
          .order('occurred_at', { ascending: false })
          .limit(50),
        supabase.rpc('get_token_balance', { p_kid_id: childRecord.id })
      ])

      setEntries(entriesData || [])
      setBalance(balanceData || 0)
      setLoading(false)
    }

    fetchHistory()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-cyan-100">
      <div className="text-2xl text-blue-500">加载中...</div>
    </div>
  )

  if (noRecord) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-cyan-100">
      <div className="text-center text-gray-500">
        <div className="text-5xl mb-4">👋</div>
        <p>请让家长先添加你的账号</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-cyan-100">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <a href="/kid" className="text-blue-600 hover:text-blue-800">← 返回</a>
          <h1 className="text-2xl font-bold text-blue-700">📋 历史记录</h1>
          <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm font-bold text-yellow-700">
            🪙 {balance}
          </div>
        </div>

        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">
                  {(entry as any).behavior_rules?.title ?? (entry.entry_type === 'redeem' ? '兑换奖品' : '手动调整')}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(entry.occurred_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <div className={entry.entry_type === 'earn' ? 'text-green-600 font-semibold text-lg' : 'text-red-500 font-semibold text-lg'}>
                {entry.entry_type === 'earn' ? '+' : '-'}{Math.abs(entry.token_amount)}
              </div>
            </div>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-4">📥</div>
            <p>还没有记录</p>
          </div>
        )}
      </div>
    </div>
  )
}
