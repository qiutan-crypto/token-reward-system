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

  const { prize_id } = await request.json()
  if (!prize_id) return NextResponse.json({ error: 'prize_id required' }, { status: 400 })

  // Get prize details
  const { data: prize, error: prizeError } = await supabase
    .from('prizes')
    .select('*')
    .eq('id', prize_id)
    .eq('is_active', true)
    .single()

  if (prizeError || !prize) {
    return NextResponse.json({ error: '奖品不存在或已下架' }, { status: 404 })
  }

  // Check balance
  const { data: balance } = await supabase
    .rpc('get_token_balance', { p_kid_id: user.id })

  if ((balance || 0) < prize.token_cost) {
    return NextResponse.json({ error: 'Token不足，无法兑换' }, { status: 400 })
  }

  // Deduct tokens
  const { error: entryError } = await supabase
    .from('token_entries')
    .insert({
      kid_id: user.id,
      token_amount: prize.token_cost,
      entry_type: 'redeem',
      note: `兑换奖品: ${prize.name}`,
      occurred_at: new Date().toISOString()
    })

  if (entryError) {
    return NextResponse.json({ error: '兑换失败: ' + entryError.message }, { status: 500 })
  }

  // Record redemption
  await supabase
    .from('redemptions')
    .insert({
      kid_id: user.id,
      prize_id: prize.id,
      token_cost: prize.token_cost,
      redeemed_at: new Date().toISOString()
    })

  return NextResponse.json({ success: true, prize_name: prize.name, tokens_spent: prize.token_cost })
}
