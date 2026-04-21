'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Child, BehaviorRule } from '@/types'

export default function AwardPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [rules, setRules] = useState<BehaviorRule[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [selectedRule, setSelectedRule] = useState('')
  const [customTokens, setCustomTokens] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const childId = searchParams.get('child')
    if (childId) setSelectedChild(childId)
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('children').select('*').eq('status', 'active').order('name'),
      supabase.from('behavior_rules').select('*').eq('active', true).order('title'),
    ])
    setChildren(c || [])
    setRules(r || [])
  }

  const selectedRuleData = rules.find(r => r.id === selectedRule)
  const tokenAmount = selectedRuleData ? selectedRuleData.token_value : parseInt(customTokens) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChild || tokenAmount <= 0) {
      setError('请选择孩子和行为')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.rpc('award_tokens', {
      p_child_id: selectedChild,
      p_rule_id: selectedRule || null,
      p_token_amount: tokenAmount,
      p_note: note || null,
      p_occurred_at: new Date().toISOString(),
    })

    if (error) {
      setError(error.message)
    } else {
      const child = children.find(c => c.id === selectedChild)
      setSuccess(`成功给 ${child?.name} 发放了 ${tokenAmount} 个 Token！`)
      setSelectedRule('')
      setNote('')
      setCustomTokens('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/parent/dashboard" className="text-purple-600 hover:underline text-sm">← 返回控制台</Link>
          <span className="font-semibold text-gray-800">发放 Token</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">给孩子发放 Token</h1>

          {success && (
            <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg font-medium">{success}</div>
          )}
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Select Child */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择孩子 *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {children.map(child => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChild(child.id)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      selectedChild === child.id
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">👶</div>
                    <div className="text-sm font-medium">{child.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Behavior */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择行为</label>
              <div className="space-y-2">
                {rules.map(rule => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setSelectedRule(rule.id === selectedRule ? '' : rule.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${
                      selectedRule === rule.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <span className="text-sm font-medium">{rule.title}</span>
                    <span className="text-purple-600 font-semibold">+{rule.token_value} ⭐</span>
                  </button>
                ))}
              </div>

              {!selectedRule && (
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">或输入自定义 Token 数量</label>
                  <input
                    type="number"
                    min="1"
                    value={customTokens}
                    onChange={e => setCustomTokens(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">备注（可选）</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="输入备注..."
              />
            </div>

            {/* Preview */}
            {selectedChild && tokenAmount > 0 && (
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-sm text-purple-600">将将发放</div>
                <div className="text-4xl font-bold text-purple-700 my-1">{tokenAmount} ⭐</div>
                <div className="text-sm text-purple-600">给 {children.find(c => c.id === selectedChild)?.name}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedChild || tokenAmount <= 0}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold text-lg transition-colors"
            >
              {loading ? '发放中...' : '确认发放 Token'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
