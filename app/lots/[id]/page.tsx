import { supabase } from '@/lib/supabase'
import { ParkingLot } from '@/types'
import { notFound } from 'next/navigation'
import BookingForm from './BookingForm'

async function getLot(id: string): Promise<ParkingLot | null> {
  const { data } = await supabase
    .from('parking_lots')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()
  return data
}

export default async function LotPage({ params }: { params: { id: string } }) {
  const lot = await getLot(params.id)
  if (!lot) notFound()

  return (
    <div>
      <a href="/" className="text-blue-600 text-sm mb-4 inline-block">← 一覧に戻る</a>

      {/* 駐車場情報 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🅿</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lot.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{lot.address}</p>
            {lot.description && <p className="text-gray-400 text-xs mt-1">{lot.description}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-400">基本</div>
            <div className="font-bold">200円/2時間</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="text-gray-400">昼間上限</div>
            <div className="font-bold text-orange-600">500円</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2">
            <div className="text-gray-400">夜間上限</div>
            <div className="font-bold text-indigo-600">500円</div>
          </div>
        </div>
      </div>

      {/* 予約フォーム */}
      <BookingForm lot={lot} />
    </div>
  )
}
