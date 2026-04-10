import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '駐車場予約',
  description: '時間貸し駐車場のオンライン予約・PayPay決済',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-blue-600 text-white shadow-md">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-wide">🅿 駐車場予約</a>
            <span className="text-sm opacity-80">PayPay対応</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center text-gray-400 text-xs py-8">
          © 2025 駐車場予約サービス
        </footer>
      </body>
    </html>
  )
}
