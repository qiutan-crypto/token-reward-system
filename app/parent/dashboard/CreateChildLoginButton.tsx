'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateChildLoginButton({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 4) { setError('PIN 码必须是 4 位数字'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/children/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, pin }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setOpen(false)
    router.refresh()
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="mt-2 w-full text-center text-xs text-purple-500 hover:text-purple-700 border border-dashed border-purple-300 rounded-lg py-1.5 hover:border-purple-500 transition-colors"
    >
      + 创建孩子登录账号
    </button>
  )

  return (
    <div className="mt-2 border border-purple-200 rounded-lg p-3 bg-purple-50">
      <p className="text-xs font-medium text-purple-700 mb-1">为 {childName} 设置 PIN 码</p>
      <p className="text-xs text-gray-400 mb-2">孩子用名字 + PIN 码登录</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          inputMode="numeric"
          required
          maxLength={4}
          placeholder="4 位 PIN 码（如 1234）"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 tracking-widest text-center font-mono"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded hover:bg-purple-700 disabled:opacity-50">
            {loading ? '创建中...' : '确认'}
          </button>
          <button type="button" onClick={() => { setOpen(false); setPin(''); setError('') }}
            className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-200">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
