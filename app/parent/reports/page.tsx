import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('status', 'active')
    .order('name')
  
  // Monthly summary per child
  const { data: monthlySummary } = await supabase
    .from('token_ledger')
    .select('child_id, year_month, entry_type, token_amount, children(name), behavior_rules(title), note, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(200)
  
  // Group by child and month
  const byChildMonth: Record<string, Record<string, { earned: number, spent: number, entries: unknown[] }>> = {}
  for (const entry of (monthlySummary || [])) {
    const childName = (entry as { children?: { name?: string } }).children?.name ?? 'Unknown'
    const ym = entry.year_month
    if (!byChildMonth[childName]) byChildMonth[childName] = {}
    if (!byChildMonth[childName][ym]) byChildMonth[childName][ym] = { earned: 0, spent: 0, entries: [] }
    if (entry.entry_type === 'earn') byChildMonth[childName][ym].earned += entry.token_amount
    if (entry.entry_type === 'redeem') byChildMonth[childName][ym].spent += Math.abs(entry.token_amount)
    byChildMonth[childName][ym].entries.push(entry)
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/parent/dashboard" className="text-purple-600 hover:underline text-sm">← 返回控制台</Link>
          <span className="font-semibold text-gray-800">月度报表</span>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Token 流水记录与月度报表</h1>
        {Object.keys(byChildMonth).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <p>还没有记录，先给孩子发放 Token 吧！</p>
          </div>
        )}
        {Object.entries(byChildMonth).map(([childName, months]) => (
          <div key={childName} className="mb-10">
            <h2 className="text-xl font-bold text-purple-700 mb-4">👶 {childName}</h2>
            {Object.entries(months).sort((a,b) => b[0].localeCompare(a[0])).map(([ym, data]) => (
              <div key={ym} className="bg-white rounded-xl border shadow-sm p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{ym}</h3>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">+{data.earned}</div>
                      <div className="text-xs text-gray-400">获得</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-500">-{data.spent}</div>
                      <div className="text-xs text-gray-400">消耗</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{data.earned - data.spent}</div>
                      <div className="text-xs text-gray-400">净得</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {(data.entries as { id?: string; entry_type: string; token_amount: number; occurred_at: string; behavior_rules?: { title?: string }; note?: string }[]).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <div className="text-sm text-gray-700">
                          {entry.behavior_rules?.title ?? entry.note ?? (entry.entry_type === 'redeem' ? '兑换奖品' : '手动调整')}
                        </div>
                        <div className="text-xs text-gray-400">{new Date(entry.occurred_at).toLocaleDateString('zh-CN')}</div>
                      </div>
                      <div className={entry.entry_type === 'earn' ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                        {entry.entry_type === 'earn' ? '+' : '-'}{Math.abs(entry.token_amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
