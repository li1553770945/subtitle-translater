import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '字幕翻译工具',
  description: '支持多种字幕格式的在线翻译工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
