import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '金币奖励',
  description: '行为奖励系统 - 奖励孩子的好行为',
  // Tells iOS/Android the page can run as a standalone PWA when added to home screen.
  // Next.js auto-injects <link rel="icon">, <link rel="apple-touch-icon"> and the
  // manifest based on app/icon.png, app/apple-icon.png, and app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: '金币奖励',
    statusBarStyle: 'black-translucent',
  },
  themeColor: '#4C1D95',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
