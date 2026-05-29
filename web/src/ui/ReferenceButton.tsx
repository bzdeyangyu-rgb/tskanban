import React, { type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type ReferenceButtonVariant = "nav" | "side" | "icon" | "primary";

type ReferenceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  isActive?: boolean;
  label?: string;
  variant?: ReferenceButtonVariant;
};

export function ReferenceButton({
  children,
  className = "",
  icon: Icon,
  isActive = false,
  label,
  type = "button",
  variant = "side",
  ...props
}: ReferenceButtonProps) {
  const content: ReactNode = children ?? label;
  return (
    <button
      {...props}
      className={`reference-button reference-button-${variant} ${isActive ? "is-active" : ""} ${className}`.trim()}
      type={type}
    >
      {Icon ? <Icon aria-hidden="true" size={variant === "nav" ? 18 : 16} /> : null}
      {content ? <span>{content}</span> : null}
    </button>
  );
}
