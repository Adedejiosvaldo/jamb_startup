import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { SessionProvider } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ScoreCoach — get the score your course needs', template: '%s · ScoreCoach' },
  description:
    'Know your likely JAMB score, see exactly what to study to reach your course cut-off, and keep your parents in the loop.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-lg focus:bg-surface focus:p-2"
        >
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
