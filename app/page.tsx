import { supabase } from '@/lib/supabase'
import { ParkingLot } from '@/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getParkingLots(): Promise<ParkingLot[]> {
  const { data, error } = await supabase
    .from('parking_lots')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

// 現在使用中の駐車場IDを取得
async function getOccupiedLotIds(): Promise<Set<string>> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('reservations')
    .select('parking_lot_id')
    .eq('status', 'paid')
    .lte('start_time', now)
    .gte('end_time', now)
  const ids = new Set((data ?? []).map((r: { parking_lot_id: string }) => r.parking_lot_id))
  return ids
}

export default async function HomePage() {
  const [lots, occupiedIds] = await Promise.all([
    getParkingLots(),
    getOccupiedLotIds(),
  ])

  return (
    <div>
      {/* 料金案内 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h2 className="font-bold text-blue-800 mb-2">料金案内</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-gray-500 text-xs">基本料金</div>
            <div className="font-bold text-lg">200円</div>
            <div className="text-gray-500 text-xs">2時間</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-gray-500 text-xs">昼間 7〜19時</div>
            <div className="font-bold text-lg text-orange-600">500円</div>
            <div className="text-gray-500 text-xs">打ち止め</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-gray-500 text-xs">夜間 19〜7時</div>
            <div className="font-bold text-lg text-indigo-600">500円</div>
            <div className="text-gray-500 text-xs">打ち止め</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">※ PayPayでのお支払いのみ対応しています</p>
      </div>

      <h1 className="text-lg font-bold text-gray-800 mb-4">
        駐車場一覧（{lots.length}箇所）
      </h1>

      {lots.length === 0 && (
        <p className="text-gray-500 text-center py-12">駐車場情報を読み込み中...</p>
      )}

      <div className="space-y-3">
        {lots.map((lot) => {
          const occupied = occupiedIds.has(lot.id)
          return (
            <div
              key={lot.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        occupied ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <span className={`text-xs font-medium ${occupied ? 'text-red-600' : 'text-green-600'}`}>
                      {occupied ? '使用中' : '空き'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{lot.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{lot.address}</p>
                  {lot.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{lot.description}</p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  {occupied ? (
                    <span className="inline-block px-4 py-2 bg-gray-100 text-gray-400 text-sm rounded-lg">
                      使用中
                    </span>
                  ) : (
                    <Link
                      href={`/lots/${lot.id}`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
                    >
                      予約する
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          ご不明な点はお気軽にお問い合わせください
        </p>
      </div>
    </div>
  )
}
