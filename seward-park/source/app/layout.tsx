import type { Metadata } from 'next';
import './globals.css';
import { assetPath } from './asset-path';
const pageUrl = 'https://willieip.me/seward-park';
const previewUrl = `${pageUrl}/park-preview-v4.jpg`;
const title = 'Seward Park 3D Diorama';
const description = 'Explore an interactive 3D diorama of Seward Park’s table tennis area.';
const previewAlt = 'An isometric rendering of Seward Park’s table tennis court, curved stone bench, and surrounding trees.';
export const metadata: Metadata = {
  metadataBase: new URL('https://willieip.me'),
  title,
  description,
  openGraph: {
    type: 'website',
    title,
    description,
    siteName: 'willieip.me',
    locale: 'en_US',
    images: [{ url: previewUrl, secureUrl: previewUrl, width: 1200, height: 750, type: 'image/jpeg', alt: previewAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [{ url: previewUrl, alt: previewAlt }],
  },
  other: { 'twitter:url': pageUrl },
  icons: {
    icon: [
      { url: assetPath('/favicon.svg'), type: 'image/svg+xml' },
      { url: assetPath('/apple-touch-icon.png'), type: 'image/png', sizes: '180x180' },
    ],
    apple: [{ url: assetPath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
  },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href={pageUrl} />
        <meta property="og:url" content={pageUrl} />
      </head>
      <body>{children}</body>
    </html>
  );
}
