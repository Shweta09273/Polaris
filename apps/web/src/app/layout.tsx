import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "../styles/globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "POLARIS — Decision Operating System",
  description: "Living Digital Twin mission control for cities",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="mission-dark" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body
        style={
          {
            ["--polaris-font-sans" as string]: "var(--font-plex-sans), 'IBM Plex Sans', sans-serif",
            ["--polaris-font-mono" as string]: "var(--font-plex-mono), 'IBM Plex Mono', monospace",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
