"use client";

import { Sidebar } from "@/components/app-shell/Sidebar";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0c" }}>
      <Sidebar />
      <main style={{ marginLeft: 224, minHeight: "100vh" }}>{children}</main>
    </div>
  );
}
