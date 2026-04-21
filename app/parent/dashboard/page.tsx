import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch children and their balances
  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('status', 'active')
    .order('name')

  const { data: balances } = await supabase
    .from('child_balances')
    .select('*')

  // Recent token awards (last 10)
  const { data: recentLedger } = await supabase
    .from('token_ledger')
    .select('*, children(name), behavior_rules(title)')
    .eq('entry_type', 'earn')
    .order('occurred_at', { ascending: false })
    .limit(10)

  // Pending redemptions
  const { data: pendingRedemptions } = await supabase
    .from('reward_redemptions')
    .select('*, children(name), reward_catalog(title)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const balanceMap = Object.fromEntries(
    (balances || []).map(b => [b.child_id, b.current_balance])
  )

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span className="font-bold text-lg text-purple-700">Token Reward System</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/parent/award" className="text-sm text-purple-600 hover:underline">发放 Token</Link>
            <Link href="/parent/behaviors" className="text-sm text-purple-600 hover:underline">行为规则</Link>
            <Link href="/parent/rewards" className="text-sm text-purple-600 hover:underline">奖品库</Link>
            <Link href="/parent/reports" className="text-sm text-purple-600 hover:underline">月度报表</Link>
            <form action={handleSignOut}>
              <button type="submit" className="text-sm text-gray-500 hover:text-red-600">登出</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">家长控制台</h1>

        {/* Children Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {(children || []).map(child => (
            <div key={child.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl">
                  {child.avatar_url ? (
                    <img src={child.avatar_url} alt={child.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : '👶'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{child.name}</h3>
                  <p className="text-sm text-gray-500">活跃孩子</p>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-700">
                  {balanceMap[child.id] ?? 0}
                </div>
                <div className="text-sm text-purple-500 mt-1">Token 余额</div>
              </div>
              <Link
                href={`/parent/award?child=${child.id}`}
                className="mt-4 block w-full text-center bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
              >
                + 发放 Token
              </Link>
            </div>
          ))}

          {/* Add Child Card */}
          <Link
            href="/parent/children/new"
            className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center text-gray-400 hover:text-purple-600 hover:border-purple-300 transition-colors cursor-pointer"
          >
            <div className="text-4xl mb-2">+</div>
            <div className="text-sm font-medium">添加孩子</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Awards */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">最近发放记录</h2>
            {(recentLedger || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无记录</p>
            ) : (
              <div className="space-y-3">
                {recentLedger!.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {(entry as unknown as { children?: { name?: string } }).children?.name ?? '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(entry as unknown as { behavior_rules?: { title?: string } }).behavior_rules?.title ?? entry.note ?? '-'}
                      </div>
                    </div>
                    <div className="text-green-600 font-semibold">+{entry.token_amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Redemptions */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">待审核兑换 {pendingRedemptions?.length ? `(${pendingRedemptions.length})` : ''}</h2>
            {(pendingRedemptions || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无待审核项目</p>
            ) : (
              <div className="space-y-3">
                {pendingRedemptions!.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {(r as unknown as { children?: { name?: string } }).children?.name} - {(r as unknown as { reward_catalog?: { title?: string } }).reward_catalog?.title}
                      </div>
                      <div className="text-xs text-gray-500">{r.token_cost} tokens</div>
                    </div>
                    <Link href="/parent/redemptions" className="text-xs text-purple-600 hover:underline">审核</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
