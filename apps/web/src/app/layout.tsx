import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScoreCoach — get the score your course needs',
  description:
    'Know your likely JAMB score, see exactly what to study to reach your course cut-off, and keep your parents in the loop.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#0f766e', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="min-h-screen antialiased">
        {children}
        <footer className="mx-auto max-w-2xl px-4 py-8 text-xs text-slate-500">
          ScoreCoach is an independent study service and is not affiliated with JAMB.
        </footer>
      </body>
    </html>
  );
}
