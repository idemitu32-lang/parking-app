export type ParkingLot = {
  id: string
  name: string
  address: string
  description: string | null
  is_active: boolean
  created_at: string
}

export type Reservation = {
  id: string
  parking_lot_id: string
  user_name: string
  user_email: string
  user_phone: string | null
  start_time: string
  end_time: string
  amount: number
  status: 'pending' | 'paid' | 'expired'
  merchant_payment_id: string | null
  created_at: string
  parking_lots?: ParkingLot
}
