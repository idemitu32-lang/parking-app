// =============================================
// 料金計算ロジック
// ・基本: 100円/時間（2時間200円）
// ・昼間 7:00〜19:00: 上限500円（打ち止め）
// ・夜間 19:00〜7:00: 上限500円（打ち止め）
// =============================================

export type PriceSegment = {
  type: 'day' | 'night'
  label: string
  minutes: number
  cost: number
  capped: boolean
}

export type PriceResult = {
  total: number
  segments: PriceSegment[]
}

const RATE_PER_HOUR = 100  // 100円/時間
const DAY_START = 7         // 7:00
const DAY_END = 19          // 19:00
const DAY_CAP = 500
const NIGHT_CAP = 500

/** 次の昼夜境界時刻を返す */
function getNextBoundary(date: Date): Date {
  const h = date.getHours()
  const next = new Date(date)
  if (h >= DAY_END) {
    // 夜間（19時以降）→ 翌朝7時が次の境界
    next.setDate(next.getDate() + 1)
    next.setHours(DAY_START, 0, 0, 0)
  } else if (h >= DAY_START) {
    // 昼間（7〜19時）→ 今日の19時が次の境界
    next.setHours(DAY_END, 0, 0, 0)
  } else {
    // 夜間（7時前）→ 今日の7時が次の境界
    next.setHours(DAY_START, 0, 0, 0)
  }
  return next
}

function isDay(date: Date): boolean {
  const h = date.getHours()
  return h >= DAY_START && h < DAY_END
}

/** 料金計算（昼夜区分・打ち止め対応） */
export function calculatePrice(start: Date, end: Date): PriceResult {
  const segments: PriceSegment[] = []
  let current = new Date(start)

  while (current < end) {
    const boundary = getNextBoundary(current)
    const segEnd = new Date(Math.min(boundary.getTime(), end.getTime()))
    const minutes = (segEnd.getTime() - current.getTime()) / (1000 * 60)
    const day = isDay(current)
    const cap = day ? DAY_CAP : NIGHT_CAP

    // 1時間未満は1時間として計算（切り上げ）
    const billingHours = Math.ceil(minutes / 60)
    const uncappedCost = billingHours * RATE_PER_HOUR
    const cost = Math.min(uncappedCost, cap)

    segments.push({
      type: day ? 'day' : 'night',
      label: day ? '昼間（7時〜19時）' : '夜間（19時〜7時）',
      minutes,
      cost,
      capped: uncappedCost > cap,
    })

    current = segEnd
  }

  const total = segments.reduce((sum, s) => sum + s.cost, 0)
  return { total, segments }
}

/** 日時フォーマット（日本語） */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
}

/** 時間フォーマット（HH:MM） */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 駐車時間を「○時間○分」形式で表示 */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}
