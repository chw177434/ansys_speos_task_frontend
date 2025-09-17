import './globals.css';

export const metadata = {
  title: 'SPEOS 异步求解',
  description: 'Celery + Redis + Next.js 前端',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
