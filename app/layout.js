import { Noto_Sans_KR, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const body = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });

export const metadata = {
    title: 'Portfolio — Ideas into experiences',
    description: '아이디어와 기술, 경험을 연결하는 인터랙티브 포트폴리오. 소개, 프로젝트와 배움의 기록.',
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko" className={`${body.variable} ${display.variable}`}>
            <body>{children}</body>
        </html>
    );
}
