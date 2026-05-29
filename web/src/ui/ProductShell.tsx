import React, { type ReactNode } from "react";

export function ProductShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="studio-app-shell reference-product-shell"
      data-product-shell="reference"
      data-token-sidebar-expanded="326"
      data-token-sidebar-collapsed="64"
    >
      {children}
    </main>
  );
}
