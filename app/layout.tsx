import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Keap Pipeline Migration Tool',
  description: 'Analyze opportunities, build pipelines with AI, and migrate deals.',
  icons: {
    icon: [
      {
        url: 'https://assets.thryv.com/prod/media/2024/08/cropped-thryv-favicon-32-32x32.png',
        sizes: '32x32',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
