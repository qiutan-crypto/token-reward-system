import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { childId, pin } = await request.json()
  if (!childId || !pin || pin.length !== 4)
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })

  const { data: child } = await supabase
    .from('children')
    .select('id, name, user_id')
    .eq('id', childId)
    .single()

  if (!child) return NextResponse.json({ error: '孩子不存在' }, { status: 404 })
  if (child.user_id) return NextResponse.json({ error: '该孩子已有登录账号' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generate a hidden email — child never sees this
  const email = `kid_${childId}@kids.local`

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { name: child.name, role: 'kid' },
  })

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  await admin.from('profiles').insert({ id: newUser.user.id, name: child.name, role: 'kid' })

  await admin.from('children').update({ user_id: newUser.user.id, pin_code: pin }).eq('id', childId)

  return NextResponse.json({ success: true })
}
