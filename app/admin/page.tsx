'use client'

import { useState, useEffect, useCallback } from 'react'
import { Reservation } from '@/types'

type ReservationWithLot = Reservation & {
  parking_lots: { name: string; address: string }
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [reservations, setReservations] = useState<ReservationWithLot[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reservations?pw=${encodeURIComponent(password)}`)
      if (!res.ok) {
        setAuthed(false)
        return
      }
      const data = await res.json()
      setReservations(data)
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    if (authed) fetchReservations()
  }, [authed, fetchReservations])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const res = await fetch(`/api/admin/reservations?pw=${encodeURIComponent(password)}`)
    if (res.ok) {
      setAuthed(true)
    } else {
      setAuthError('パスワードが違います')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">管理画面</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    )
  }

  const filtered = reservations.filter((r) =>
    filter === 'all' ? true : r.status === filter
  )

  const totalRevenue = reservations
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0)

  const todayRevenue = reservations
    .filter((r) => {
      if (r.status !== 'paid') return false
      const today = new Date().toDateString()
      return new Date(r.created_at).toDateString() === today
    })
    .reduce((sum, r) => sum + r.amount, 0)

  function downloadCSV() {
    const header = ['予約番号', '駐車場', '氏名', 'メール', '電話', '開始', '終了', '金額', 'ステータス', '予約日時']
    const rows = reservations.map((r) => [
      r.id.slice(0, 8).toUpperCase(),
      r.parking_lots?.name ?? '',
      r.user_name,
      r.user_email,
      r.user_phone ?? '',
      new Date(r.start_time).toLocaleString('ja-JP'),
      new Date(r.end_time).toLocaleString('ja-JP'),
      r.amount,
      r.status === 'paid' ? '支払済' : r.status === 'pending' ? '未払い' : '期限切れ',
      new Date(r.created_at).toLocaleString('ja-JP'),
    ])
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reservations_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">管理画面</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchReservations}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            更新
          </button>
          <button
            onClick={downloadCSV}
            className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg"
          >
            CSV
          </button>
        </div>
      </div>

      {/* 売上サマリー */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-gray-400 text-xs mb-1">今日の売上</div>
          <div className="text-2xl font-bold text-blue-700">{todayRevenue.toLocaleString()}円</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-gray-400 text-xs mb-1">累計売上</div>
          <div className="text-2xl font-bold text-green-700">{totalRevenue.toLocaleString()}円</div>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-4">
        {(['all', 'paid', 'pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f === 'all' ? 'すべて' : f === 'paid' ? '支払済' : '未払い'}
            <span className="ml-1 opacity-70">
              ({reservations.filter((r) => f === 'all' ? true : r.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-8">読み込み中...</p>}

      {/* 予約一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">予約がありません</p>
        )}
        {filtered.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : r.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {r.status === 'paid' ? '支払済' : r.status === 'pending' ? '未払い' : '期限切れ'}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  #{r.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <span className="font-bold text-blue-700">{r.amount.toLocaleString()}円</span>
            </div>
            <div className="text-sm font-medium text-gray-800 mb-1">
              {r.parking_lots?.name}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(r.start_time).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {' 〜 '}
              {new Date(r.end_time).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {r.user_name}｜{r.user_email}
              {r.user_phone && `｜${r.user_phone}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
