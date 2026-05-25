import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vigil',
  description: 'Single-pane-of-glass security posture dashboard — Defender for Cloud, Graph Security API, Azure Resource Graph',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full flex bg-[#f3f2f1] text-[#323130] overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[#f3f2f1]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
