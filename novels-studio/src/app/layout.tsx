import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'استوديو الروايات | MIRAX NOVELS',
  description: 'منصة احترافية لكتابة الروايات — حساب لكل كاتب، تحقق من عضوية جروب ميراكس، نشر الفصول، ونظام نقاط.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
