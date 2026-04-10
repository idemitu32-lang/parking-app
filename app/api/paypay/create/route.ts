import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lot_id, lot_name, start_time, end_time, amount, user_name, user_email, user_phone } = body

    // バリデーション
    if (!lot_id || !start_time || !end_time || !amount || !user_name || !user_email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }
    if (amount < 1) {
      return NextResponse.json({ error: '料金が不正です' }, { status: 400 })
    }

    const db = createServiceClient()

    // 空き確認（既存の確定済み予約と重複がないか）
    const { data: conflicts } = await db
      .from('reservations')
      .select('id')
      .eq('parking_lot_id', lot_id)
      .eq('status', 'paid')
      .lt('start_time', end_time)
      .gt('end_time', start_time)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: '選択した時間帯はすでに予約済みです。別の時間帯をお選びください。' },
        { status: 409 }
      )
    }

    // 予約レコード作成（pending状態）
    const merchantPaymentId = uuidv4()
    const { data: reservation, error: dbError } = await db
      .from('reservations')
      .insert({
        parking_lot_id: lot_id,
        user_name,
        user_email,
        user_phone,
        start_time,
        end_time,
        amount,
        status: 'pending',
        merchant_payment_id: merchantPaymentId,
      })
      .select()
      .single()

    if (dbError || !reservation) {
      console.error('DB error:', dbError)
      return NextResponse.json({ error: '予約の作成に失敗しました' }, { status: 500 })
    }

    // PayPay QRコード決済作成
    const payPayRestSDK = require('@paypayopa/paypayopa-sdk-node')
    payPayRestSDK.Configure({
      clientId: process.env.PAYPAY_CLIENT_ID,
      clientSecret: process.env.PAYPAY_CLIENT_SECRET,
      merchantId: process.env.PAYPAY_MERCHANT_ID,
      productionMode: process.env.PAYPAY_SANDBOX !== 'true',
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const payload = {
      merchantPaymentId,
      amount: {
        amount,
        currency: 'JPY',
      },
      codeType: 'ORDER_QR',
      redirectUrl: `${baseUrl}/complete?merchantPaymentId=${merchantPaymentId}`,
      redirectType: 'WEB_LINK',
      orderDescription: `${lot_name} 駐車場予約`,
      orderItems: [
        {
          name: `${lot_name} 駐車場予約`,
          category: 'parking',
          quantity: 1,
          unitPrice: {
            amount,
            currency: 'JPY',
          },
        },
      ],
    }

    const response = await payPayRestSDK.QRCodeCreate(payload)
    const payPayUrl = response?.BODY?.data?.url

    if (!payPayUrl) {
      // PayPay URL取得失敗時は予約レコードを削除
      await db.from('reservations').delete().eq('id', reservation.id)
      console.error('PayPay error:', response)
      return NextResponse.json(
        { error: 'PayPay決済の準備に失敗しました。しばらくしてから再度お試しください。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: payPayUrl })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
