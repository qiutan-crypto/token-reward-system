'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { RewardCatalog } from '@/types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STORAGE_KEY = 'reward_sort_order'

function SortableCard({
  reward, onEdit, onToggle, onDelete,
}: {
  reward: RewardCatalog
  onEdit: (r: RewardCatalog) => void
  onToggle: (r: RewardCatalog) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reward.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.7 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border shadow-sm overflow-hidden ${!reward.active ? 'opacity-60' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center py-1.5 bg-gray-50 border-b cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 select-none"
        title="拖动排序"
      >
        ⠿⠿⠿
      </div>

      <div className="bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-2" style={{ minHeight: '8rem' }}>
        {reward.image_url ? (
          <img src={reward.image_url} alt={reward.title} className="max-h-48 w-full object-contain mix-blend-multiply" />
        ) : (
          <span className="text-5xl py-6">🎁</span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{reward.title}</h3>
        {reward.description && <p className="text-sm text-gray-500 mb-2">{reward.description}</p>}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-bold text-purple-600">{reward.token_cost} ⭐</span>
          {reward.stock_qty != null && <span className="text-xs text-gray-400">库存: {reward.stock_qty}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onToggle(reward)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${reward.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {reward.active ? '已上架' : '已下架'}
          </button>
          <button onClick={() => onEdit(reward)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-purple-100">编辑</button>
          <button onClick={() => onDelete(reward.id)} className="px-3 py-1.5 bg-gray-100 text-red-400 rounded-lg text-xs hover:bg-red-50">删除</button>
        </div>
      </div>
    </div>
  )
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardCatalog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RewardCatalog | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tokenCost, setTokenCost] = useState('10')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [stockQty, setStockQty] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const applyStoredOrder = (items: RewardCatalog[]) => {
    const stored: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!stored.length) return items
    const map = Object.fromEntries(items.map(r => [r.id, r]))
    const ordered = stored.filter(id => map[id]).map(id => map[id])
    const rest = items.filter(r => !stored.includes(r.id))
    return [...ordered, ...rest]
  }

  useEffect(() => { loadRewards() }, [])

  const loadRewards = async () => {
    const { data } = await supabase.from('reward_catalog').select('*').order('token_cost')
    if (data) setRewards(applyStoredOrder(data))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRewards(prev => {
      const oldIndex = prev.findIndex(r => r.id === active.id)
      const newIndex = prev.findIndex(r => r.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(r => r.id)))
      return next
    })
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setTokenCost('10'); setImageUrl('')
    setImageFile(null); setImagePreview(''); setStockQty(''); setEditing(null); setShowForm(false)
  }

  const handleEdit = (r: RewardCatalog) => {
    setEditing(r); setTitle(r.title); setDescription(r.description || ''); setTokenCost(String(r.token_cost))
    setImageUrl(r.image_url || ''); setImagePreview(r.image_url || ''); setImageFile(null)
    setStockQty(r.stock_qty != null ? String(r.stock_qty) : ''); setShowForm(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    let finalImageUrl = imageUrl
    if (imageFile) {
      const fd = new FormData()
      fd.append('file', imageFile)
      const res = await fetch('/api/rewards/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert('图片上传失败：' + data.error); setLoading(false); return }
      finalImageUrl = data.url
    }
    const payload = {
      title, description: description || null, token_cost: parseInt(tokenCost),
      image_url: finalImageUrl || null, stock_qty: stockQty ? parseInt(stockQty) : null, active: true,
    }
    if (editing) {
      await supabase.from('reward_catalog').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('reward_catalog').insert([payload])
    }
    await loadRewards(); resetForm(); setLoading(false)
  }

  const handleToggle = async (r: RewardCatalog) => {
    await supabase.from('reward_catalog').update({ active: !r.active }).eq('id', r.id)
    await loadRewards()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个奖品？')) return
    await supabase.from('reward_catalog').delete().eq('id', id)
    const stored: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter(s => s !== id)))
    await loadRewards()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/parent/dashboard" className="text-purple-600 hover:underline text-sm">← 返回控制台</Link>
          <span className="font-semibold text-gray-800">奖品库管理</span>
          <span className="text-xs text-gray-400 ml-2">拖动卡片顶部可排序</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">奖品库</h1>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">+ 添加奖品</button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
            <h2 className="font-semibold mb-4">{editing ? '编辑奖品' : '添加奖品'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">奖品名称 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="例：看电影一次" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所需 Token *</label>
                <input type="number" min="1" value={tokenCost} onChange={e => setTokenCost(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">奖品图片</label>
                <div className="flex items-center gap-3">
                  {imagePreview && <img src={imagePreview} alt="preview" className="w-16 h-16 object-contain rounded-lg border" />}
                  <label className="flex-1 flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors text-sm text-gray-500 hover:text-purple-600">
                    <span>{imagePreview ? '重新上传' : '点击上传图片'}</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">库存数量（空=无限）</label>
                <input type="number" min="0" value={stockQty} onChange={e => setStockQty(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="留空表示无限" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">奖品说明</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="可选" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={loading} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">{loading ? '保存中...' : '保存'}</button>
                <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">取消</button>
              </div>
            </form>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rewards.map(r => r.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.length === 0 && !showForm && (
                <div className="col-span-3 text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">🎁</div>
                  <p>还没有奖品，点击「添加奖品」开始</p>
                </div>
              )}
              {rewards.map(reward => (
                <SortableCard
                  key={reward.id}
                  reward={reward}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
