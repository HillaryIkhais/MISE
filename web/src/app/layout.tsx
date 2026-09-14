import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MISE — Don't let 'maybe' become 'done.'",
  description:
    "MISE prevents autonomous agents from declaring real-world work complete based on vague, unsupported, or self-reported claims.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
