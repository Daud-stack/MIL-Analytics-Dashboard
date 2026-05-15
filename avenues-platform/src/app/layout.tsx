import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Healthcare Analytics Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
