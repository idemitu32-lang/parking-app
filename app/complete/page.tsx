import { createServiceClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/pricing'
import Link from 'next/link'

// PayPay決済状態確認
async function verifyPayment(merchantPaymentId: string) {
  const payPayRestSDK = require('@paypayopa/paypayopa-sdk-node')
  payPayRestSDK.Configure({
    clientId: process.env.PAYPAY_CLIENT_ID,
    clientSecret: process.env.PAYPAY_CLIENT_SECRET,
    merchantId: process.env.PAYPAY_MERCHANT_ID,
    productionMode: process.env.PAYPAY_SANDBOX !== 'true',
  })

  try {
    const response = await payPayRestSDK.GetCodePaymentDetails([merchantPaymentId])
    return response?.BODY?.data?.status ?? null
  } catch {
    return null
  }
}

export default async function CompletePage({
  searchParams,
}: {
  searchParams: { merchantPaymentId?: string }
}) {
  const merchantPaymentId = searchParams.merchantPaymentId

  if (!merchantPaymentId) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">無効なページです</p>
        <Link href="/" className="text-blue-600 mt-4 inline-block">トップに戻る</Link>
      </div>
    )
  }

  const db = createServiceClient()

  // 予約情報を取得
  const { data: reservation } = await db
    .from('reservations')
    .select('*, parking_lots(name, address)')
    .eq('merchant_payment_id', merchantPaymentId)
    .single()

  if (!reservation) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">予約情報が見つかりません</p>
        <Link href="/" className="text-blue-600 mt-4 inline-block">トップに戻る</Link>
      </div>
    )
  }

  // 既に確定済みの場合はスキップ
  if (reservation.status !== 'paid') {
    // PayPay決済状態確認
    const paymentStatus = await verifyPayment(merchantPaymentId)

    if (paymentStatus === 'COMPLETED') {
      await db
        .from('reservations')
        .update({ status: 'paid' })
        .eq('merchant_payment_id', merchantPaymentId)
      reservation.status = 'paid'
    } else {
      // 未払い・期限切れ
      return (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">決済が完了していません</h1>
          <p className="text-gray-500 text-sm mb-6">
            決済がキャンセルされたか、タイムアウトしました。<br />
            再度予約してください。
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-xl"
          >
            トップに戻る
          </Link>
        </div>
      )
    }
  }

  const lot = reservation.parking_lots as { name: string; address: string }
  const startDate = new Date(reservation.start_time)
  const endDate = new Date(reservation.end_time)

  return (
    <div className="text-center py-8 px-4">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-bold text-green-700 mb-1">予約完了！</h1>
      <p className="text-gray-500 text-sm mb-6">ご予約ありがとうございます</p>

      {/* 予約詳細 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left space-y-3 mb-6">
        <h2 className="font-bold text-gray-800 border-b pb-2">予約詳細</h2>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">駐車場</span>
          <span className="font-medium text-right">{lot?.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">住所</span>
          <span className="font-medium text-right">{lot?.address}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">開始</span>
          <span className="font-medium">{formatDateTime(startDate)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">終了</span>
          <span className="font-medium">{formatDateTime(endDate)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">お名前</span>
          <span className="font-medium">{reservation.user_name} 様</span>
        </div>
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-gray-500 font-bold">お支払い金額</span>
          <span className="font-bold text-blue-700 text-lg">
            {reservation.amount.toLocaleString()}円
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">予約番号</span>
          <span className="text-gray-400 font-mono">{reservation.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-6">
        予約確認メールを {reservation.user_email} に送信しました
      </p>

      <Link
        href="/"
        className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-xl"
      >
        トップに戻る
      </Link>
    </div>
  )
}
