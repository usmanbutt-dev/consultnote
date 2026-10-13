import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConsultNote — Consultation workspace",
  description:
    "A considered workspace for reviewing doctor-patient conversations and consultation notes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
