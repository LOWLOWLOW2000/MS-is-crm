import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'IS CRM',
  description: 'IS架電管理CRM',
};

/** 明示 viewport（モバイル等での初期表示を安定） */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
