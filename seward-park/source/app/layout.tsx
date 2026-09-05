import type { Metadata } from 'next';
import './globals.css';
import { assetPath } from './asset-path';
const pageUrl = 'https://willieip.me/seward-park/';
const previewUrl = `${pageUrl}park-preview.png`;
const description = 'Explore an interactive 3D diorama of Seward Park’s table tennis area.';
const previewAlt = 'An isometric rendering of Seward Park’s table tennis court, curved stone bench, and surrounding trees.';
export const metadata: Metadata = {
  metadataBase: new URL('https://willieip.me'),
  title: 'Seward Park',
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: 'website',
    url: pageUrl,
    title: 'Seward Park',
    description,
    images: [{ url: previewUrl, width: 1200, height: 750, type: 'image/png', alt: previewAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seward Park',
    description,
    images: [{ url: previewUrl, alt: previewAlt }],
  },
  icons: { icon: assetPath('/favicon.svg') },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
