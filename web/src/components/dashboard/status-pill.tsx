import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function StatusPill({
  variant,
  children,
  className,
}: {
  variant: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          variant === "success" && "bg-success",
          variant === "warning" && "bg-warning",
          variant === "destructive" && "bg-destructive",
          variant === "neutral" && "bg-muted-foreground"
        )}
      />
      {children}
    </span>
  );
}
