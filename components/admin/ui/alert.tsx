import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/admin/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        destructive:
          "border-destructive/40 bg-destructive/10 text-foreground [&>svg]:text-destructive",
        warning: "border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning",
        success: "border-success/40 bg-success/10 text-foreground [&>svg]:text-success",
        info: "border-info/40 bg-info/10 text-foreground [&>svg]:text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h5">) {
  return (
    <h5 className={cn("mb-1 font-display font-semibold leading-none", className)} {...props}>
      {children}
    </h5>
  );
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}
