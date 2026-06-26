import './globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Providers } from '../components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata = {
  title: "Aether's Dashboard",
  description: "Live console and management dashboard for Aether's Discord bot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} dark`}>
      <body className="bg-neutral-950 text-neutral-50 antialiased font-sans selection:bg-indigo-500/30">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
