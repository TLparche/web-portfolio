import { Noto_Sans_KR, Noto_Serif_KR, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import content from '../content/portfolio.json' with { type: 'json' };

const body = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const archive = Noto_Serif_KR({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-archive', display: 'swap' });

export const metadata = {
    title: `${content.profile.name} | AI·데이터 개발 포트폴리오`,
    description: content.profile.tagline,
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko" className={`${body.variable} ${display.variable} ${archive.variable}`}>
            <body>{children}</body>
        </html>
    );
}
