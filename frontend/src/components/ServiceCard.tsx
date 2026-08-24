"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  accentColor?: string;
  iconColor?: string;
}

export default function ServiceCard({
  icon: Icon,
  title,
  description,
  href,
  accentColor = "bg-sky-50",
  iconColor = "text-sky-600",
}: ServiceCardProps) {
  return (
    <div className="card group flex flex-col p-7 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-sky-100/40 dark:hover:shadow-sky-900/20">
      <div
        className={`icon-box mb-5 flex h-12 w-12 items-center justify-center ${accentColor} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <h3 className="font-heading mb-2 text-[18px] font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mb-6 flex-1 text-[15px] leading-relaxed text-slate-500 dark:text-slate-300">
        {description}
      </p>
      <Link href={href}>
        <Button
          variant="secondary"
          className="group/btn w-full justify-center text-[14px] font-semibold"
        >
          Learn More
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
        </Button>
      </Link>
    </div>
  );
}
