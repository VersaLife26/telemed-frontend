import Image from "next/image";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
  size?: "md" | "lg";
  fullWidth?: boolean;
  icon?: string;
  iconAlt?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = true,
  icon,
  iconAlt = "",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-[10px] rounded-[32px] px-6 py-3 shadow-[var(--shadow-soft)] transition-opacity";

  const variants = {
    primary: "bg-primary text-white font-bold text-[16px] leading-[1.4]",
    secondary: "bg-bg-gray text-black font-normal text-[16px] leading-[1.4]",
    outline:
      "bg-white border border-border text-text-muted font-normal text-[16px] leading-[1.4]",
  };

  const sizes = {
    md: "",
    lg: "text-[20px] font-medium tracking-[-0.4px] py-3",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? "w-full" : "w-auto"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${className}`}
      disabled={disabled}
      {...props}
    >
      <span>{children}</span>
      {icon ? (
        <span className="relative size-[18px] shrink-0 overflow-hidden">
          <Image src={icon} alt={iconAlt} fill className="object-contain" />
        </span>
      ) : null}
    </button>
  );
}
