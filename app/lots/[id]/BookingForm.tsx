'use client'

import { useState, useEffect } from 'react'
import { ParkingLot } from '@/types'
import { calculatePrice, formatDateTime, formatDuration } from '@/lib/pricing'

type Props = { lot: ParkingLot }

const DURATION_OPTIONS = [
  { label: '1時間', hours: 1 },
  { label: '2時間', hours: 2 },
  { label: '3時間', hours: 3 },
  { label: '4時間', hours: 4 },
  { label: '5時間', hours: 5 },
  { label: '6時間', hours: 6 },
  { label: '8時間', hours: 8 },
  { label: '10時間', hours: 10 },
  { label: '12時間', hours: 12 },
  { label: '24時間', hours: 24 },
]

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function roundToNext30(d: Date): Date {
  const next = new Date(d)
  const m = next.getMinutes()
  if (m === 0 || m === 30) return next
  next.setMinutes(m < 30 ? 30 : 60, 0, 0)
  return next
}

export default function BookingForm({ lot }: Props) {
  const [startInput, setStartInput] = useState('')
  const [durationHours, setDurationHours] = useState(2)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 初期値: 30分後に丸める
  useEffect(() => {
    const initial = roundToNext30(new Date(Date.now() + 30 * 60 * 1000))
    setStartInput(toLocalDatetimeValue(initial))
  }, [])

  const startDate = startInput ? new Date(startInput) : null
  const endDate = startDate ? new Date(startDate.getTime() + durationHours * 60 * 60 * 1000) : null
  const price = startDate && endDate ? calculatePrice(startDate, endDate) : null

  const minDatetime = toLocalDatetimeValue(new Date())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!startDate || !endDate || !price) {
      setError('開始日時を入力してください')
      return
    }
    if (startDate < new Date()) {
      setError('開始日時は現在以降を指定してください')
      return
    }
    if (!name.trim()) {
      setError('お名前を入力してください')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('正しいメールアドレスを入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/paypay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lot.id,
          lot_name: lot.name,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          amount: price.total,
          user_name: name.trim(),
          user_email: email.trim(),
          user_phone: phone.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '予約の作成に失敗しました')
        return
      }

      // PayPayのURLにリダイレクト
      window.location.href = data.url
    } catch {
      setError('通信エラーが発生しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-800 mb-4">予約内容</h2>

        {/* 開始日時 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            開始日時 <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={startInput}
            min={minDatetime}
            onChange={(e) => setStartInput(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* 利用時間 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            利用時間 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => setDurationHours(opt.hours)}
                className={`py-2 text-sm rounded-lg border font-medium transition-colors ${
                  durationHours === opt.hours
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 料金プレビュー */}
        {price && startDate && endDate && (
          <div className="bg-blue-50 rounded-lg p-3 mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">
                {formatDateTime(startDate)} 〜 {formatDateTime(endDate)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              利用時間: {formatDuration(startDate, endDate)}
            </div>
            {price.segments.map((seg, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {seg.label}
                  {seg.capped && <span className="ml-1 text-xs text-orange-500">（打ち止め）</span>}
                </span>
                <span className="font-medium">{seg.cost.toLocaleString()}円</span>
              </div>
            ))}
            <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between font-bold text-lg">
              <span>合計料金</span>
              <span className="text-blue-700">{price.total.toLocaleString()}円</span>
            </div>
          </div>
        )}
      </div>

      {/* お客様情報 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-800 mb-4">お客様情報</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田 太郎"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            電話番号 <span className="text-gray-400 text-xs">（任意）</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="090-0000-0000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={loading || !price}
        className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            処理中...
          </>
        ) : (
          <>
            <span className="text-xl">🔴</span>
            PayPayで{price ? `${price.total.toLocaleString()}円を` : ''}支払う
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        PayPayアプリで決済完了後、予約が確定されます
      </p>
    </form>
  )
}
