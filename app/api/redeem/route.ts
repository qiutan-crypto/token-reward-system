import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reward_id } = await request.json()
  if (!reward_id) return NextResponse.json({ error: 'reward_id required' }, { status: 400 })

  // Resolve children.id from auth user id
  const { data: childRecord } = await supabase
    .from('children')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!childRecord) return NextResponse.json({ error: '未找到孩子账号' }, { status: 404 })
  const child_id = childRecord.id

  const { data: reward, error: rewardError } = await supabase
    .from('reward_catalog')
    .select('*')
    .eq('id', reward_id)
    .eq('active', true)
    .single()

  if (rewardError || !reward) {
    return NextResponse.json({ error: '奖品不存在或已下架' }, { status: 404 })
  }

  const { data: balance } = await supabase
    .rpc('get_token_balance', { p_kid_id: child_id })

  if ((balance || 0) < reward.token_cost) {
    return NextResponse.json({ error: 'Token不足，无法兑换' }, { status: 400 })
  }

  const { error: entryError } = await supabase
    .from('token_ledger')
    .insert({
      child_id,
      token_amount: reward.token_cost,
      entry_type: 'redeem',
      note: `兑换奖品: ${reward.title}`,
      occurred_at: new Date().toISOString(),
      year_month: new Date().toISOString().slice(0, 7),
    })

  if (entryError) {
    return NextResponse.json({ error: '兑换失败: ' + entryError.message }, { status: 500 })
  }

  await supabase
    .from('reward_redemptions')
    .insert({
      child_id,
      reward_id: reward.id,
      token_cost: reward.token_cost,
      status: 'pending',
      redeemed_at: new Date().toISOString(),
    })

  return NextResponse.json({ success: true, prize_name: reward.title, tokens_spent: reward.token_cost })
}
