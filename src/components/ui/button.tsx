import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-primary shadow-outline hover:bg-accent-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  secondary:
    "bg-accent-subtle text-accent hover:bg-accent-muted/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  outline:
    "border border-border/70 bg-surface text-on-surface hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  ghost:
    "text-on-muted hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      icon,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200 ease-brand disabled:cursor-not-allowed disabled:opacity-65",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

