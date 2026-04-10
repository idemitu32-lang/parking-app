import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get('pw')

  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('reservations')
    .select('*, parking_lots(name, address)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  return NextResponse.json(data)
}
