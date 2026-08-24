"use client";

import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
  iconColor?: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  accentColor = "bg-secondary",
  iconColor = "text-primary",
}: FeatureCardProps) {
  return (
    <div className="card group p-7 shadow-sm transition-all duration-300 hover:shadow-lg">
      <div
        className={`icon-box mb-4 flex h-11 w-11 items-center justify-center ${accentColor} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className={`h-5.5 w-5.5 ${iconColor}`} />
      </div>
      <h3 className="font-heading mb-2 text-[17px] font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
