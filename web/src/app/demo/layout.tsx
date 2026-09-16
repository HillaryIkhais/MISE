"use client";

import { Sidebar } from "@/components/app-shell/Sidebar";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ds-shell">
      <Sidebar />
      <main className="ds-main">{children}</main>
    </div>
  );
}