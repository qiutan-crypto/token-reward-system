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

  const body = await request.json()
  const { child_id, rule_id, token_amount, note } = body

  let amount = token_amount
  if (rule_id && !token_amount) {
    const { data: rule } = await supabase
      .from('behavior_rules')
      .select('token_value')
      .eq('id', rule_id)
      .single()
    if (rule) amount = rule.token_value
  }

  const { data, error } = await supabase
    .from('token_ledger')
    .insert({
      child_id,
      awarded_by: user.id,
      rule_id: rule_id || null,
      token_amount: amount,
      entry_type: amount > 0 ? 'earn' : 'spend',
      note: note || null,
      occurred_at: new Date().toISOString(),
      year_month: new Date().toISOString().slice(0, 7),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { searchParams } = new URL(request.url)
  const child_id = searchParams.get('child_id')

  if (!child_id) return NextResponse.json({ error: 'child_id required' }, { status: 400 })

  const { data: balance } = await supabase
    .rpc('get_token_balance', { p_kid_id: child_id })

  const { data: entries, error } = await supabase
    .from('token_ledger')
    .select('*, behavior_rules(title)')
    .eq('child_id', child_id)
    .order('occurred_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ balance: balance || 0, entries })
}
