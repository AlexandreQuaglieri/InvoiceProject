import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { getBaseUrl } from '@/lib/base-url'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { PostHogAnalytics } from '@/components/analytics/posthog-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'Factur-IA — Facturation française conforme 2026',
    template: '%s · Factur-IA',
  },
  description:
    'Facturation française AI-first, gratuite et open source : Factur-X, ' +
    'facturation électronique 2026, réception fournisseurs, pilotable depuis Claude ou ChatGPT.',
  openGraph: {
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image'],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster />
          </NextIntlClientProvider>
          <PostHogAnalytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
