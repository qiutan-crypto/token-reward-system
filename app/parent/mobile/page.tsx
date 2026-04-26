'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Child, BehaviorRule } from '@/types'
import GoldCoin from '@/components/GoldCoin'

interface PendingRedemption {
  id: string
  token_cost: number
  redeemed_at: string
  reward_catalog: { title: string; image_url: string | null } | null
}

export default function MobileAwardPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [rules, setRules] = useState<BehaviorRule[]>([])
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [selectedRule, setSelectedRule] = useState<BehaviorRule | null>(null)
  const [pendingRule, setPendingRule] = useState<BehaviorRule | null>(null)   // rule awaiting confirmation
  const [toast, setToast] = useState<{ msg: string; ok: boolean; amount?: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState(0)
  const [todayAwarded, setTodayAwarded] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [recentAwards, setRecentAwards] = useState<{ id: string; amount: number; ts: number }[]>([])
  const [pendingRedemptions, setPendingRedemptions] = useState<PendingRedemption[]>([])
  const [processingRedemption, setProcessingRedemption] = useState<string | null>(null)
  const supabase = createClient()

  // ── Load children & rules ──
  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: r }] = await Promise.all([
        supabase.from('children').select('*').eq('status', 'active').order('name'),
        supabase.from('behavior_rules').select('*').eq('active', true).order('token_value', { ascending: false }),
      ])
      setChildren(c || [])
      setRules(r || [])
      if (c && c.length === 1) setSelectedChild(c[0])
    }
    load()
  }, [])

  // ── Load balance + today's stats + pending redemptions whenever child changes ──
  const refreshStats = useCallback(async () => {
    if (!selectedChild) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [bal, today, pending] = await Promise.all([
      supabase.rpc('get_token_balance', { p_kid_id: selectedChild.id }),
      supabase
        .from('token_ledger')
        .select('token_amount')
        .eq('child_id', selectedChild.id)
        .eq('entry_type', 'earn')
        .gte('occurred_at', todayStart.toISOString()),
      supabase
        .from('reward_redemptions')
        .select('id, token_cost, redeemed_at, reward_catalog(title, image_url)')
        .eq('child_id', selectedChild.id)
        .eq('status', 'pending')
        .order('redeemed_at', { ascending: false }),
    ])
    setBalance(bal.data ?? 0)
    const arr = today.data ?? []
    setTodayAwarded(arr.reduce((s, x) => s + (x.token_amount ?? 0), 0))
    setTodayCount(arr.length)
    setPendingRedemptions((pending.data as unknown as PendingRedemption[]) ?? [])
  }, [selectedChild])

  useEffect(() => { refreshStats() }, [refreshStats])

  // ── Approve / reject a pending redemption ──
  const handleRedemption = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingRedemption(id)
    const { error } = await supabase
      .from('reward_redemptions')
      .update({ status })
      .eq('id', id)
    setProcessingRedemption(null)
    if (error) {
      showToast('操作失败', false)
      return
    }
    // Optimistic remove from pending list
    setPendingRedemptions(prev => prev.filter(r => r.id !== id))
    // Refresh balance (rejected may refund tokens, depending on backend)
    refreshStats()
    showToast(status === 'approved' ? '已通过兑换' : '已拒绝兑换', true)
  }

  const showToast = (msg: string, ok: boolean, amount?: number) => {
    setToast({ msg, ok, amount })
    setTimeout(() => setToast(null), 2400)
  }

  // Click on a rule → open confirmation dialog (prevents accidental awards)
  const handleRuleClick = (rule: BehaviorRule) => {
    if (!selectedChild || loading) return
    setPendingRule(rule)
  }

  // Confirm in dialog → actually award tokens
  const handleAward = async (rule: BehaviorRule) => {
    if (!selectedChild) return
    setPendingRule(null)
    setLoading(true)
    setSelectedRule(rule)
    const { error } = await supabase.rpc('award_tokens', {
      p_child_id: selectedChild.id,
      p_rule_id: rule.id,
      p_token_amount: rule.token_value,
      p_occurred_at: new Date().toISOString(),
    })
    setLoading(false)
    setSelectedRule(null)
    if (error) {
      showToast('发放失败', false)
    } else {
      // optimistic update
      setBalance(b => b + rule.token_value)
      setTodayAwarded(t => t + rule.token_value)
      setTodayCount(c => c + 1)
      setRecentAwards(prev => [{ id: rule.id + '-' + Date.now(), amount: rule.token_value, ts: Date.now() }, ...prev].slice(0, 5))
      showToast(`发放给 ${selectedChild.name}`, true, rule.token_value)
    }
  }

  // ── Per-category visual config ──
  const catConfig: Record<string, {
    label: string
    grad: string
    soft: string
    text: string
    ring: string
    coin: string
  }> = {
    '学习': {
      label: '学习', grad: 'linear-gradient(135deg, #3B82F6, #6366F1)',
      soft: 'linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%)', text: '#1E40AF', ring: '#6366F1',
      coin: 'linear-gradient(135deg, #FFD466 0%, #FF9500 100%)',
    },
    '品德': {
      label: '品德', grad: 'linear-gradient(135deg, #0891B2, #06B6D4)',
      soft: 'linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)', text: '#155E75', ring: '#06B6D4',
      coin: 'linear-gradient(135deg, #FFD466 0%, #FF9500 100%)',
    },
    '生活': {
      label: '生活', grad: 'linear-gradient(135deg, #10B981, #14B8A6)',
      soft: 'linear-gradient(135deg, #ECFDF5 0%, #CCFBF1 100%)', text: '#065F46', ring: '#10B981',
      coin: 'linear-gradient(135deg, #FFD466 0%, #FF9500 100%)',
    },
    '家务': {
      label: '家务', grad: 'linear-gradient(135deg, #F59E0B, #F97316)',
      soft: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', text: '#92400E', ring: '#F59E0B',
      coin: 'linear-gradient(135deg, #FFD466 0%, #FF9500 100%)',
    },
  }
  const defaultCat = {
    label: '其他', grad: 'linear-gradient(135deg, #6B7280, #4B5563)',
    soft: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)', text: '#374151', ring: '#6B7280',
    coin: 'linear-gradient(135deg, #FFD466 0%, #FF9500 100%)',
  }

  const grouped = rules.reduce<Record<string, BehaviorRule[]>>((acc, r) => {
    const cat = r.category || '其他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})
  const categoryOrder = ['学习', '品德', '生活', '家务']
  const sortedCategories = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
  ]

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col"
      style={{ background: 'linear-gradient(180deg, #F5F3FF 0%, #FAFAFC 220px)' }}
    >

      {/* ──────────────── HEADER ──────────────── */}
      <div
        className="sticky top-0 z-30 px-5 pt-12 pb-5 rounded-b-[28px] shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #8B5CF6 100%)',
          boxShadow: '0 12px 32px -12px rgba(76,29,149,0.5)',
        }}
      >
        {/* Top row: title + dashboard link */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-purple-300/90 text-[11px] font-bold tracking-[0.2em] uppercase mb-1">PARENT</p>
            <h1 className="text-white text-[26px] font-black tracking-tight leading-none">发放金币</h1>
          </div>
          <a
            href="/parent/dashboard"
            className="text-[12px] font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur px-3.5 py-1.5 rounded-full transition-all active:scale-95"
          >
            控制台
          </a>
        </div>

        {/* Child selector — pills */}
        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {children.map(child => {
              const active = selectedChild?.id === child.id
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                    active
                      ? 'bg-white text-purple-700 shadow-md scale-105'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {child.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Balance + today's stats card */}
        {selectedChild && (
          <div
            className="rounded-2xl p-4 backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              {/* Left: child name + balance */}
              <div className="min-w-0 flex-1">
                <p className="text-purple-200 text-[11px] font-semibold mb-0.5">
                  {selectedChild.name} 当前余额
                </p>
                <div className="flex items-baseline gap-1.5">
                  <GoldCoin size={26} />
                  <span className="text-white text-[28px] font-black tabular-nums leading-none tracking-tight">
                    {balance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Right: today's earned */}
              <div className="text-right border-l border-white/20 pl-3">
                <p className="text-purple-200 text-[11px] font-semibold mb-0.5">今日已发</p>
                <div className="flex items-baseline justify-end gap-1">
                  <span
                    className="text-[20px] font-black tabular-nums leading-none"
                    style={{ color: '#FDE68A', textShadow: '0 0 12px rgba(253,230,138,0.5)' }}
                  >
                    +{todayAwarded.toLocaleString()}
                  </span>
                </div>
                <p className="text-purple-300/80 text-[10px] mt-0.5">{todayCount} 次</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────── EMPTY STATE ──────────────── */}
      {!selectedChild && children.length > 1 && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 py-20">
          <div className="text-5xl">👆</div>
          <p className="font-semibold">请先在上方选择孩子</p>
        </div>
      )}

      {/* ──────────────── PENDING REDEMPTIONS ──────────────── */}
      {selectedChild && pendingRedemptions.length > 0 && (
        <div className="px-4 pt-5">
          <div
            className="rounded-2xl overflow-hidden shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
              border: '1px solid #FDBA74',
            }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-white text-base">🎁</span>
                <span className="text-white font-black text-[14px] tracking-wide">待审核兑换</span>
              </div>
              <span className="bg-white text-orange-700 text-[11px] font-black px-2 py-0.5 rounded-full tabular-nums">
                {pendingRedemptions.length}
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-orange-200/60">
              {pendingRedemptions.map(r => {
                const isProcessing = processingRedemption === r.id
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-3">
                    {/* Reward image */}
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-orange-200">
                      {r.reward_catalog?.image_url ? (
                        <img
                          src={r.reward_catalog.image_url}
                          alt={r.reward_catalog.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">🎁</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[14px] text-orange-900 truncate leading-tight">
                        {r.reward_catalog?.title ?? '奖品'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <GoldCoin size={12} />
                        <span className="text-[12px] font-bold text-orange-700 tabular-nums">
                          {r.token_cost}
                        </span>
                        <span className="text-[10px] text-orange-500/80 ml-1">
                          {new Date(r.redeemed_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleRedemption(r.id, 'rejected')}
                        disabled={isProcessing}
                        className="w-9 h-9 rounded-full bg-white text-red-500 text-base font-black border border-red-200 hover:bg-red-50 active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center"
                        aria-label="拒绝"
                      >
                        ✗
                      </button>
                      <button
                        onClick={() => handleRedemption(r.id, 'approved')}
                        disabled={isProcessing}
                        className="w-9 h-9 rounded-full text-white text-base font-black active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                          boxShadow: '0 2px 8px rgba(34,197,94,0.4)',
                        }}
                        aria-label="通过"
                      >
                        {isProcessing ? '…' : '✓'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── RULES LIST ──────────────── */}
      <div className="flex-1 px-4 pt-5 pb-32 space-y-6">
        {sortedCategories.map(category => {
          const cfg = catConfig[category] ?? defaultCat
          const catRules = grouped[category]
          return (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center gap-2.5 mb-3 px-1">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[11px] font-black"
                  style={{ background: cfg.grad, boxShadow: `0 4px 12px ${cfg.ring}55` }}
                >
                  {cfg.label.charAt(0)}
                </div>
                <div className="flex items-baseline gap-2">
                  <h2 className="font-black text-[16px]" style={{ color: cfg.text }}>
                    {cfg.label}
                  </h2>
                  <span className="text-[11px] font-bold text-gray-400">{catRules.length} 条</span>
                </div>
              </div>

              {/* Rule cards */}
              <div className="space-y-2.5">
                {catRules.map(rule => {
                  const isThis = loading && selectedRule?.id === rule.id
                  return (
                    <button
                      key={rule.id}
                      onClick={() => handleRuleClick(rule)}
                      disabled={!selectedChild || loading}
                      className={`group w-full relative overflow-hidden rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left
                        transition-all duration-200 active:scale-[0.97] disabled:opacity-40
                        ${!selectedChild ? 'cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'}`}
                      style={{
                        background: cfg.soft,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.8) inset',
                        border: `1px solid ${cfg.ring}22`,
                      }}
                    >
                      {/* Decorative left-edge glow */}
                      <div
                        className="absolute top-0 bottom-0 left-0 w-1 rounded-l-2xl"
                        style={{ background: cfg.grad }}
                      />

                      {/* Title + description */}
                      <div className="flex-1 min-w-0 pl-1">
                        <p className="font-extrabold text-[15px] leading-tight" style={{ color: cfg.text }}>
                          {rule.title}
                        </p>
                        {rule.description && (
                          <p className="text-[11.5px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {rule.description}
                          </p>
                        )}
                      </div>

                      {/* Coin / loading badge */}
                      {isThis ? (
                        <div className="flex-shrink-0 w-[58px] h-[44px] flex items-center justify-center">
                          <div
                            className="w-5 h-5 border-2 rounded-full animate-spin"
                            style={{ borderColor: cfg.ring, borderTopColor: 'transparent' }}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full font-black text-[14px] tabular-nums"
                          style={{
                            background: 'linear-gradient(135deg, #FFE066 0%, #FF9500 100%)',
                            color: '#5B2E00',
                            boxShadow: '0 3px 10px rgba(255,159,0,0.4), 0 1px 0 rgba(255,255,255,0.5) inset',
                          }}
                        >
                          <GoldCoin size={16} />
                          <span>+{rule.token_value}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {rules.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold">还没有行为规则</p>
            <a href="/parent/behaviors" className="text-purple-500 text-sm mt-2 inline-block hover:underline font-medium">
              去添加规则 →
            </a>
          </div>
        )}
      </div>

      {/* ──────────────── CONFIRMATION DIALOG ──────────────── */}
      {pendingRule && selectedChild && (() => {
        const cfg = catConfig[pendingRule.category || ''] ?? defaultCat
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0 animate-overlay-in"
            onClick={() => setPendingRule(null)}
            style={{ background: 'rgba(15, 10, 35, 0.55)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-dialog-in"
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent stripe */}
              <div className="h-1.5 w-full" style={{ background: cfg.grad }} />

              {/* Body */}
              <div className="px-6 pt-6 pb-2">
                {/* Category pill */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                    style={{ background: cfg.grad }}
                  >
                    {cfg.label.charAt(0)}
                  </div>
                  <span className="text-[12px] font-bold" style={{ color: cfg.text }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Rule title */}
                <h3 className="text-[20px] font-black text-gray-900 leading-snug mb-2">
                  {pendingRule.title}
                </h3>

                {/* Description */}
                {pendingRule.description && (
                  <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                    {pendingRule.description}
                  </p>
                )}

                {/* Award preview card */}
                <div
                  className="rounded-2xl p-4 mb-5 flex items-center justify-between"
                  style={{ background: cfg.soft, border: `1px solid ${cfg.ring}33` }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-gray-500">发放给</span>
                    <span className="text-[16px] font-black" style={{ color: cfg.text }}>
                      {selectedChild.name}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #FFE066 0%, #FF9500 100%)',
                      color: '#5B2E00',
                      boxShadow: '0 4px 14px rgba(255,159,0,0.4)',
                    }}
                  >
                    <GoldCoin size={20} />
                    <span className="text-[18px] font-black tabular-nums">+{pendingRule.token_value}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => setPendingRule(null)}
                  className="flex-1 py-4 text-[15px] font-bold text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <div className="w-px bg-gray-100" />
                <button
                  onClick={() => handleAward(pendingRule)}
                  className="flex-1 py-4 text-[15px] font-black text-white transition-all active:scale-95"
                  style={{ background: cfg.grad }}
                >
                  确定发放
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ──────────────── TOAST ──────────────── */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-toast-in"
          style={{
            background: toast.ok
              ? 'linear-gradient(135deg, #1F2937 0%, #111827 100%)'
              : 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
            color: 'white',
            boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)',
          }}
        >
          {toast.ok ? (
            <>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FFE066 0%, #FF9500 100%)' }}
              >
                <GoldCoin size={22} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-medium text-gray-400">{toast.msg}</span>
                <span className="text-[15px] font-black text-amber-300 tabular-nums">+{toast.amount}</span>
              </div>
            </>
          ) : (
            <span className="text-sm font-bold">❌ {toast.msg}</span>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes toastIn {
          0%   { opacity: 0; transform: translate(-50%, 20px) scale(0.9); }
          60%  { opacity: 1; transform: translate(-50%, -4px) scale(1.02); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .animate-toast-in {
          animation: toastIn 0.35s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-overlay-in {
          animation: overlayIn 0.18s ease-out forwards;
        }
        @keyframes dialogIn {
          0%   { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-dialog-in {
          animation: dialogIn 0.28s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        /* Hide scroll indicator on child selector */
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
