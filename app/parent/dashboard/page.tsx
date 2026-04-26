import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteChildButton from './DeleteChildButton'
import CreateChildLoginButton from './CreateChildLoginButton'

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
    .order('redeemed_at', { ascending: false })

  const balanceMap = Object.fromEntries(
    (balances || []).map(b => [b.child_id, b.current_balance])
  )

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const handleDeleteChild = async (childId: string) => {
    'use server'
    const supabase = await createClient()
    await supabase.from('children').delete().eq('id', childId)
    redirect('/parent/dashboard')
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
            <Link href="/parent/mobile" className="text-sm text-purple-600 hover:underline">📱 手机发放</Link>
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
            <div key={child.id} className="relative group bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-4">
                {child.avatar_url && (
                  <img src={child.avatar_url} alt={child.name} className="w-12 h-12 rounded-full object-cover" />
                )}
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
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/parent/award?child=${child.id}`}
                  className="flex-1 text-center bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                >
                  + 发放 Token
                </Link>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteChildButton
                    childId={child.id}
                    childName={child.name}
                    action={handleDeleteChild}
                  />
                </div>
              </div>
              {!child.user_id && (
                <CreateChildLoginButton childId={child.id} childName={child.name} />
              )}
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

        <div className="space-y-6">
          {/* Recent Awards — 3-column table */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">最近发放记录</h2>
            {(recentLedger || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无记录</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left font-medium pb-2 w-28">日期</th>
                    <th className="text-left font-medium pb-2">内容</th>
                    <th className="text-right font-medium pb-2 w-20">🪙 Token</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLedger!.map(entry => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2.5 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(entry.occurred_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-gray-900">
                          {(entry as unknown as { children?: { name?: string } }).children?.name ?? '-'}
                        </span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-gray-500">
                          {(entry as unknown as { behavior_rules?: { title?: string } }).behavior_rules?.title ?? entry.note ?? '-'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-green-600">+{entry.token_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending Redemptions */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                待审核兑换
                {pendingRedemptions?.length ? (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{pendingRedemptions.length}</span>
                ) : null}
              </h2>
              <Link href="/parent/redemptions" className="text-xs text-purple-600 hover:underline">查看全部</Link>
            </div>
            {(pendingRedemptions || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无待审核项目</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left font-medium pb-2 w-28">日期</th>
                    <th className="text-left font-medium pb-2">孩子 · 奖品</th>
                    <th className="text-right font-medium pb-2 w-20">🪙 Token</th>
                    <th className="text-right font-medium pb-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRedemptions!.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2.5 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(r.redeemed_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-gray-900">
                          {(r as unknown as { children?: { name?: string } }).children?.name}
                        </span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-gray-500">
                          {(r as unknown as { reward_catalog?: { title?: string } }).reward_catalog?.title}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-amber-600 font-semibold">{r.token_cost}</td>
                      <td className="py-2.5 text-right">
                        <Link href="/parent/redemptions" className="text-xs text-purple-600 hover:underline">审核</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
