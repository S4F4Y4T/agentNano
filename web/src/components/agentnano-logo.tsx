import Image from "next/image";
import { cn } from "@/lib/utils";

export function AgentNanoLogo({
  className,
  iconOnly = false,
  size = 28,
}: {
  className?: string;
  iconOnly?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/brand/icon-mark.png"
        alt="AgentNano"
        width={size}
        height={size}
        className="shrink-0 rounded-md"
        priority
      />
      {!iconOnly && (
        <span className="font-heading text-[15px] font-bold tracking-[-0.01em]">
          <span className="text-foreground">Agent</span>
          <span className="text-primary">Nano</span>
        </span>
      )}
    </div>
  );
}
