# 駐車場予約アプリ セットアップ手順

## 構成
- **フロントエンド/バックエンド**: Next.js 14
- **データベース**: Supabase（無料）
- **ホスティング**: Vercel（無料）
- **決済**: PayPay

---

## STEP 1: Node.js インストール（未インストールの場合）

https://nodejs.org から LTS版をダウンロード・インストール

---

## STEP 2: パッケージインストール

```bash
cd 駐車場アプリ作成
npm install
```

---

## STEP 3: Supabase セットアップ

1. https://supabase.com にアクセス → 無料アカウント作成
2. 「New Project」でプロジェクト作成
3. 左メニュー「SQL Editor」を開く
4. `supabase/schema.sql` の内容を貼り付けて実行
5. 左メニュー「Settings > API」から以下を取得:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

---

## STEP 4: PayPay 加盟店登録

1. https://developer.paypay.ne.jp にアクセス
2. 加盟店として申し込み（審査に1〜2週間）
3. 審査中はサンドボックス環境で開発可能:
   - Sandbox Client ID / Secret / Merchant ID は登録後にDashboardから取得

---

## STEP 5: 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

`.env.local` を編集して実際の値を入力:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=取得したanon key
SUPABASE_SERVICE_ROLE_KEY=取得したservice_role key

PAYPAY_CLIENT_ID=取得したClient ID
PAYPAY_CLIENT_SECRET=取得したClient Secret
PAYPAY_MERCHANT_ID=取得したMerchant ID
PAYPAY_SANDBOX=true  ← 本番化時はfalse

NEXT_PUBLIC_BASE_URL=http://localhost:3000  ← デプロイ後はVercelのURL

ADMIN_PASSWORD=任意のパスワード
```

---

## STEP 6: ローカルで動作確認

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く

---

## STEP 7: Vercel デプロイ（本番公開）

1. https://vercel.com にアクセス → GitHubと連携
2. このフォルダをGitHubリポジトリにプッシュ
3. Vercelで「Import Project」
4. Environment Variables に `.env.local` の内容を全て入力
5. `NEXT_PUBLIC_BASE_URL` をVercelのURL（例: https://parking.vercel.app）に変更
6. デプロイ完了

---

## 駐車場データの変更

`supabase/schema.sql` の最後のINSERT文を実際の駐車場名・住所に変更して実行してください。
または Supabase ダッシュボード > Table Editor > parking_lots から直接編集できます。

---

## 管理画面

`https://あなたのURL/admin` にアクセス
パスワード: `.env.local` の `ADMIN_PASSWORD` で設定した値

---

## 料金体系（変更する場合）

`lib/pricing.ts` の以下の定数を変更:

```typescript
const RATE_PER_HOUR = 100  // 100円/時間（2時間200円）
const DAY_START = 7         // 昼間開始（7時）
const DAY_END = 19          // 昼間終了（19時）
const DAY_CAP = 500         // 昼間打ち止め（500円）
const NIGHT_CAP = 500       // 夜間打ち止め（500円）
```
