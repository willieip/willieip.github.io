import type { Metadata } from 'next';
import './globals.css';
import { assetPath } from './asset-path';
export const metadata: Metadata = {
  title: 'Seward Park',
  description: 'Interactive Seward Park diorama.',
  icons: { icon: assetPath('/favicon.svg') },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
