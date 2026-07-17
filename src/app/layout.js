import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "../components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Project Titan — ICD Control Center",
  description: "Internal operations control center for ICD container tracking and demurrage management.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Add suppressHydrationWarning here */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning={true}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
