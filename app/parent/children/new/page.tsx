'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddChildPage() {
  const [name, setName] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('请输入孩子的姓名'); return }
    if (pinCode && (pinCode.length < 4 || !/^\d+$/.test(pinCode))) {
      setError('PIN 码必须是 4 位数字'); return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Get or create family for this parent
    let { data: family, error: famSelectErr } = await supabase
      .from('families')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (famSelectErr) { setError('读取家庭失败：' + famSelectErr.message); setLoading(false); return }

    if (!family) {
      const { data: newFamily, error: famErr } = await supabase
        .from('families')
        .insert({ name: '我的家庭', owner_user_id: user.id })
        .select('id')
        .single()
      if (famErr) { setError('创建家庭失败：' + famErr.message); setLoading(false); return }
      family = newFamily
    }

    if (!family) { setError('无法获取家庭信息，请重试'); setLoading(false); return }

    const { error: insertErr } = await supabase
      .from('children')
      .insert({
        name: name.trim(),
        family_id: family.id,
        pin_code: pinCode || null,
        status: 'active',
      })

    if (insertErr) {
      setError('添加失败：' + insertErr.message)
      setLoading(false)
      return
    }

    router.push('/parent/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <a href="/parent/dashboard" className="text-gray-400 hover:text-gray-600 text-xl">←</a>
          <h1 className="text-2xl font-bold text-gray-900">添加孩子</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="孩子的名字"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN 码（可选，4位数字）</label>
            <input
              type="text"
              value={pinCode}
              onChange={e => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="例如：1234"
              inputMode="numeric"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">孩子登录时使用的 PIN 码（暂时可留空）</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? '添加中...' : '添加孩子'}
          </button>
        </form>
      </div>
    </div>
  )
}
