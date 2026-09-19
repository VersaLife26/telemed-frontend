import * as React from "react";

import { cn } from "@/lib/admin/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow] duration-[160ms] ease-out",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "can-hover:hover:border-primary/35",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
