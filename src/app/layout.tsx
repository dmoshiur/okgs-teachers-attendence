import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: {
    default: "Teacher Attendance Sheet Generator",
    template: "%s · Attendance Sheet"
  },
  description:
    "Generate print-ready teacher attendance sheets for any month, with a live preview and PDF or DOCX download.",
  icons: {
    icon: "/logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2690d1"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
