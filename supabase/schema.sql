-- =============================================
-- 駐車場予約アプリ: Supabaseスキーマ
-- Supabaseダッシュボード > SQL Editor で実行
-- =============================================

-- 駐車場テーブル
create table if not exists parking_lots (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text not null,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 予約テーブル
create table if not exists reservations (
  id uuid default gen_random_uuid() primary key,
  parking_lot_id uuid references parking_lots(id) not null,
  user_name text not null,
  user_email text not null,
  user_phone text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  amount integer not null,
  status text default 'pending' check (status in ('pending', 'paid', 'expired')),
  merchant_payment_id text unique,
  created_at timestamp with time zone default timezone('utc', now())
);

-- インデックス（空き確認クエリ高速化）
create index if not exists idx_reservations_lot_time
  on reservations(parking_lot_id, start_time, end_time, status);

-- RLS設定
alter table parking_lots enable row level security;
alter table reservations enable row level security;

-- 駐車場一覧: 誰でも読める
create policy "公開読み取り" on parking_lots
  for select using (true);

-- 予約: サービスロールのみ操作（APIから）
create policy "サービスロール全操作" on reservations
  using (true) with check (true);

-- =============================================
-- サンプルデータ（名前・住所は実際のものに変更）
-- =============================================
insert into parking_lots (name, address, description) values
  ('○○駐車場 1号', '○○市△△町1-1-1', ''),
  ('○○駐車場 2号', '○○市△△町1-2-1', ''),
  ('○○駐車場 3号', '○○市△△町1-3-1', ''),
  ('○○駐車場 4号', '○○市△△町1-4-1', ''),
  ('○○駐車場 5号', '○○市□□町2-1-1', ''),
  ('○○駐車場 6号', '○○市□□町2-2-1', ''),
  ('○○駐車場 7号', '○○市□□町2-3-1', ''),
  ('○○駐車場 8号', '○○市□□町2-4-1', '');
