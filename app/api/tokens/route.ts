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
  const { kid_id, behavior_rule_id, token_amount, note } = body

  // Get behavior rule if provided
  let amount = token_amount
  let ruleId = behavior_rule_id

  if (behavior_rule_id && !token_amount) {
    const { data: rule } = await supabase
      .from('behavior_rules')
      .select('token_value')
      .eq('id', behavior_rule_id)
      .single()
    if (rule) amount = rule.token_value
  }

  const { data, error } = await supabase
    .from('token_entries')
    .insert({
      kid_id,
      parent_id: user.id,
      behavior_rule_id: ruleId || null,
      token_amount: amount,
      entry_type: amount > 0 ? 'earn' : 'spend',
      note: note || null,
      occurred_at: new Date().toISOString()
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
  const kid_id = searchParams.get('kid_id')

  if (!kid_id) return NextResponse.json({ error: 'kid_id required' }, { status: 400 })

  const { data: balance } = await supabase
    .rpc('get_token_balance', { p_kid_id: kid_id })

  const { data: entries, error } = await supabase
    .from('token_entries')
    .select('*, behavior_rules(title)')
    .eq('kid_id', kid_id)
    .order('occurred_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ balance: balance || 0, entries })
}
