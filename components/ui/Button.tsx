import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "cta" | "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  block = false,
  icon,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = [
    "sbd-btn",
    `sbd-btn--${variant}`,
    block ? "sbd-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} {...rest}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
