'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Wrapper required by Next.js 14: useSearchParams() must be inside a Suspense
// boundary when the page is statically rendered.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Honour ?next=<safe path> so bookmarks like /parent/mobile land on the
  // requested page after login. Reject anything that isn't an internal path
  // (must start with '/', not '//', no scheme).
  const nextRaw = searchParams.get('next')
  const nextPath =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.includes(':')
      ? nextRaw
      : '/parent/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name: name || email.split('@')[0], role: 'parent' } }
        })
        if (error) throw error
        setError('注册成功！请查收邮件确认。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(nextPath)
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⭐</div>
          <h1 className="text-2xl font-bold text-gray-900">Token Reward System</h1>
          <p className="text-gray-500 mt-1">行为奖励系统</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="你的名字"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="输入密码"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-purple-600 hover:underline text-sm"
          >
            {isRegister ? '已有账号？登录' : '没有账号？注册'}
          </button>
          <div>
            <a href="/kid/login" className="text-orange-500 hover:underline text-sm">
              👶 孩子登录入口
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
