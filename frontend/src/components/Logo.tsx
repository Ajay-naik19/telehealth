import { ShieldPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}

export default function Logo({ className, textClassName, iconClassName, size = "md" }: LogoProps) {
  const sizing = {
    sm: {
      wrapper: "gap-1.5",
      iconBox: "h-7 w-7",
      icon: "h-3.5 w-3.5",
      text: "text-[18px]",
    },
    md: {
      wrapper: "gap-2",
      iconBox: "h-8 w-8",
      icon: "h-4 w-4",
      text: "text-[22px]",
    },
    lg: {
      wrapper: "gap-2.5",
      iconBox: "h-9 w-9",
      icon: "h-[18px] w-[18px]",
      text: "text-[24px]",
    },
  }[size];

  return (
    <span className={cn("inline-flex items-center", sizing.wrapper, className)}>
      <span
        className={cn(
          "icon-box inline-flex items-center justify-center border border-(--primary-border) dark:border-white/45 dark:bg-slate-800",
          sizing.iconBox,
          iconClassName,
        )}
        aria-hidden="true"
      >
        <ShieldPlus className={cn(sizing.icon, "text-primary dark:text-white")} strokeWidth={2.1} />
      </span>
      <span className={cn("font-logo font-medium tracking-tight text-foreground", sizing.text, textClassName)}>
        Tele<span className="text-primary">Health</span>
        <span className="text-accent">x</span>
      </span>
    </span>
  );
}
