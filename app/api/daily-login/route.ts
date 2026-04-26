import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST /api/daily-login
// Awards 1 token per day to the kid for logging in.
// Idempotent: calling multiple times in a single day returns the same result
// (the bonus is granted at most once per local day).
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve children.id from auth user id
  const { data: childRecord } = await supabase
    .from('children')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!childRecord) return NextResponse.json({ error: '未找到孩子账号' }, { status: 404 })
  const child_id = childRecord.id

  // Compute "today" boundaries (server time — close enough for this use case)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  // Check if today's daily-login bonus has already been awarded
  const { data: existing } = await supabase
    .from('token_ledger')
    .select('id, token_amount')
    .eq('child_id', child_id)
    .eq('entry_type', 'earn')
    .eq('note', 'daily_login')
    .gte('occurred_at', todayStart.toISOString())
    .lte('occurred_at', todayEnd.toISOString())
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      awarded: false,
      reason: 'already_claimed_today',
      message: '今天的登录奖励已经领过啦',
    })
  }

  // Insert today's bonus
  const now = new Date()
  const { error: insertError } = await supabase
    .from('token_ledger')
    .insert({
      child_id,
      token_amount: 1,
      entry_type: 'earn',
      note: 'daily_login',
      occurred_at: now.toISOString(),
      year_month: now.toISOString().slice(0, 7),
    })

  if (insertError) {
    return NextResponse.json({ error: '发放失败: ' + insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    awarded: true,
    amount: 1,
    message: '🎉 今日登录奖励 +1 金币！',
  })
}
