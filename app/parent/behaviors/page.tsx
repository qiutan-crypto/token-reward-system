'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { BehaviorRule } from '@/types'

export default function BehaviorsPage() {
  const [rules, setRules] = useState<BehaviorRule[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<BehaviorRule | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tokenValue, setTokenValue] = useState('5')
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => { loadRules() }, [])

  const loadRules = async () => {
    const { data } = await supabase.from('behavior_rules').select('*').order('token_value', { ascending: false })
    setRules(data || [])
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory(''); setTokenValue('5'); setEditingRule(null); setShowForm(false); setError('')
  }

  const handleEdit = (rule: BehaviorRule) => {
    setEditingRule(rule); setTitle(rule.title); setDescription(rule.description || ''); setCategory(rule.category || ''); setTokenValue(String(rule.token_value)); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !tokenValue) { setError('请填写必填项'); return }
    setLoading(true); setError('')
    const payload = { title, description: description || null, category: category || null, token_value: parseInt(tokenValue), active: true }
    let err
    if (editingRule) {
      const { error } = await supabase.from('behavior_rules').update(payload).eq('id', editingRule.id)
      err = error
    } else {
      const { error } = await supabase.from('behavior_rules').insert([payload])
      err = error
    }
    if (err) { setError('保存失败：' + err.message); setLoading(false); return }
    await loadRules(); resetForm(); setLoading(false)
  }

  const handleToggle = async (rule: BehaviorRule) => {
    await supabase.from('behavior_rules').update({ active: !rule.active }).eq('id', rule.id)
    await loadRules()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个行为规则？')) return
    await supabase.from('behavior_rules').delete().eq('id', id)
    await loadRules()
  }

  const DEFAULT_BEHAVIORS = [
    { title: '完成作业', token_value: 5 },
    { title: '帮助家务', token_value: 3 },
    { title: '主动阅读30分钟', token_value: 4 },
    { title: '按时起床', token_value: 2 },
    { title: '整理房间', token_value: 3 },
    { title: '帮助弟弹', token_value: 2 },
    { title: '表现良好/被老师表扬', token_value: 5 },
    { title: '自动干发韭裣', token_value: 2 },
  ]

  const addDefaultBehaviors = async () => {
    await supabase.from('behavior_rules').insert(DEFAULT_BEHAVIORS.map(b => ({ ...b, active: true })))
    await loadRules()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/parent/dashboard" className="text-purple-600 hover:underline text-sm">← 返回控制台</Link>
          <span className="font-semibold text-gray-800">行为规则管理</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">行为奖励规则</h1>
          <div className="flex gap-3">
            {rules.length === 0 && (
              <button onClick={addDefaultBehaviors} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">导入默认行为</button>
            )}
            <button onClick={() => { resetForm(); setShowForm(true) }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">+ 添加行为</button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
            <h2 className="font-semibold mb-4">{editingRule ? '编辑行为' : '添加行为'}</h2>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行为名称 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="例：完成作业" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token 奖励 *</label>
                <input type="number" min="1" value={tokenValue} onChange={e => setTokenValue(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <input value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="例：学习、生活" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">说明</label>
                <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="可选" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={loading} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">{loading ? '保存中...' : '保存'}</button>
                <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">取消</button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {rules.length === 0 && !showForm && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p>还没有行为规则，点击「添加行为」开始</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${!rule.active ? 'opacity-50' : ''}`}>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">⭐</div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{rule.title}</div>
                {rule.category && <div className="text-xs text-gray-400">{rule.category}</div>}
                {rule.description && <div className="text-sm text-gray-500 mt-0.5">{rule.description}</div>}
              </div>
              <div className="text-xl font-bold text-purple-600">+{rule.token_value} ⭐</div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(rule)} className={`px-3 py-1 rounded-full text-xs font-medium ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{rule.active ? '启用' : '停用'}</button>
                <button onClick={() => handleEdit(rule)} className="text-gray-400 hover:text-purple-600 text-sm">编辑</button>
                <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-600 text-sm">删除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
