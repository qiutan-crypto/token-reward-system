'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import GoldCoin from '@/components/GoldCoin'

export default function KidLoginPage() {
  const [step, setStep] = useState<'name' | 'pin'>('name')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/children/lookup?name=${encodeURIComponent(name)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setEmail(data.email)
      setStep('pin')
    } catch {
      setError('网络错误，请重试')
    }
    setLoading(false)
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) { setError('PIN 码错误，请重试'); setLoading(false); return }
    router.push('/kid')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-900 via-purple-900 to-violet-950 select-none">
      <div className="w-full max-w-xs px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div style={{ filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.6))' }}>
            <GoldCoin size={100} />
          </div>
          <h1 className="text-white text-2xl font-bold mt-4 tracking-wide">金币乐园</h1>
          <p className="text-purple-300 text-sm mt-1">你的专属奖励空间</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-white/20">
          {step === 'name' ? (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <p className="text-white text-center font-medium mb-2">你叫什么名字？</p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="输入你的名字"
                autoFocus
                className="w-full px-4 py-3 rounded-2xl text-center text-lg font-medium bg-white/20 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              {error && <p className="text-sm text-red-300 text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:from-yellow-300 hover:to-amber-400 active:scale-95 transition-all disabled:opacity-50">
                {loading ? '查找中...' : '下一步 →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <p className="text-center text-white">
                你好，<span className="font-bold text-yellow-300">{name}</span>！🎉
              </p>
              <p className="text-center text-purple-300 text-sm">输入你的 4 位 PIN 码</p>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                maxLength={4}
                placeholder="••••"
                autoFocus
                className="w-full px-4 py-3 rounded-2xl text-center text-3xl tracking-widest bg-white/20 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              {error && <p className="text-sm text-red-300 text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:from-yellow-300 hover:to-amber-400 active:scale-95 transition-all disabled:opacity-50">
                {loading ? '登录中...' : '进入 🎉'}
              </button>
              <button type="button" onClick={() => { setStep('name'); setPin(''); setError('') }}
                className="w-full text-sm text-purple-300 hover:text-white transition-colors">
                ← 返回
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs text-purple-400/60 hover:text-purple-300 transition-colors">家长登录</Link>
        </div>
      </div>
    </div>
  )
}
