import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: '请输入名字' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: children } = await admin
    .from('children')
    .select('id, name, user_id')
    .ilike('name', name)
    .eq('status', 'active')
    .not('user_id', 'is', null)

  if (!children || children.length === 0)
    return NextResponse.json({ error: '找不到该名字的孩子账号，请联系家长' }, { status: 404 })

  // Return generated email for client to sign in with
  const child = children[0]
  return NextResponse.json({ email: `kid_${child.id}@kids.local`, name: child.name })
}
