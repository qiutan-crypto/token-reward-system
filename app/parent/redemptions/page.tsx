'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Redemption {
  id: string
  child_id: string
  reward_id: string
  token_cost: number
  status: 'pending' | 'approved' | 'rejected'
  redeemed_at: string
  children: { name: string }
  reward_catalog: { title: string; image_url: string | null }
}

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, children(name), reward_catalog(title, image_url)')
      .order('redeemed_at', { ascending: false })
    setRedemptions((data as unknown as Redemption[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id)
    const supabase = createClient()
    await supabase
      .from('reward_redemptions')
      .update({ status })
      .eq('id', id)
    await load()
    setProcessing(null)
  }

  const pending = redemptions.filter(r => r.status === 'pending')
  const done = redemptions.filter(r => r.status !== 'pending')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">加载中…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/parent/dashboard" className="text-purple-600 hover:underline text-sm">← 返回控制台</Link>
          <span className="font-semibold text-gray-800">兑换审核</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Pending */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            待审核 {pending.length > 0 && <span className="ml-2 bg-red-100 text-red-600 text-sm px-2 py-0.5 rounded-full">{pending.length}</span>}
          </h2>
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">暂无待审核兑换 🎉</div>
          ) : (
            <div className="space-y-3">
              {pending.map(r => (
                <div key={r.id} className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {r.reward_catalog?.image_url
                      ? <img src={r.reward_catalog.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                      : <span className="text-2xl">🎁</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{r.reward_catalog?.title}</p>
                    <p className="text-sm text-gray-500">{r.children?.name} · 🪙 {r.token_cost}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.redeemed_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, 'approved')}
                      disabled={processing === r.id}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {processing === r.id ? '…' : '✓ 通过'}
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, 'rejected')}
                      disabled={processing === r.id}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors"
                    >
                      {processing === r.id ? '…' : '✗ 拒绝'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        {done.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">历史记录</h2>
            <div className="space-y-2">
              {done.map(r => (
                <div key={r.id} className="bg-white rounded-xl border p-4 flex items-center gap-4 opacity-70">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {r.reward_catalog?.image_url
                      ? <img src={r.reward_catalog.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                      : <span className="text-xl">🎁</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{r.reward_catalog?.title}</p>
                    <p className="text-xs text-gray-500">{r.children?.name} · 🪙 {r.token_cost}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {r.status === 'approved' ? '已通过' : '已拒绝'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
