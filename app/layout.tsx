import { Inter } from 'next/font/google'
import { Providers } from '@/providers/providers'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Кабінет',
  description: 'Створення виделення і редагування даних курєрів',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>  {/* Now here is your client side part */}
          {children}
        </Providers>
      </body>
    </html>
  )
}
