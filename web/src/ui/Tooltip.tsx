import React, { type ReactNode } from "react";

export function Tooltip({ children, text }: { children: ReactNode; text: string }) {
  return (
    <span className="reference-tooltip" data-tooltip={text} aria-label={text}>
      {children}
    </span>
  );
}
