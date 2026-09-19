import * as React from "react";
import { Slot } from "radix-ui";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/admin/utils";

/**
 * Aligned with the ProHealth / consumer Button: pill radius, gradient primary,
 * press scale. Variants still meet 4.5:1 against their own backgrounds.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-semibold",
    "transition-[transform,box-shadow,background-color,border-color,color,filter] duration-[160ms] ease-out",
    "can-hover:hover:-translate-y-px active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[image:var(--gradient-cta)] text-primary-foreground shadow-brand can-hover:hover:brightness-[1.06]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm can-hover:hover:brightness-110",
        outline:
          "border border-input bg-card text-foreground shadow-sm can-hover:hover:border-primary/40 can-hover:hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground can-hover:hover:bg-blue-100",
        ghost: "text-muted-foreground can-hover:hover:bg-accent can-hover:hover:text-accent-foreground",
        link: "rounded-md text-primary underline-offset-4 can-hover:hover:underline",
        success: "bg-success text-success-foreground shadow-sm can-hover:hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      // A <button> inside a <form> defaults to type="submit". Forgetting that
      // is how a "Cancel" button ends up submitting the form.
      {...(asChild ? {} : { type: type ?? "button" })}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
