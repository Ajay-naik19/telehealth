"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  accentColor: string;
  iconColor: string;
}

export default function RoleCard({
  icon: Icon,
  title,
  description,
  href,
  accentColor,
  iconColor,
}: RoleCardProps) {
  const router = useRouter();

  const goToRole = () => {
    router.push(href);
  };

  return (
    <div
      className="card group flex h-85 w-85 cursor-pointer flex-col items-center justify-center text-center shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-sky-100/40 dark:hover:shadow-sky-900/20"
      role="button"
      tabIndex={0}
      onClick={goToRole}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToRole();
        }
      }}
    >
        <div
          className={`icon-box mb-5 flex h-14 w-14 items-center justify-center ${accentColor} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>
        <h3 className="font-heading mb-2 text-[20px] font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="mb-5 text-[14px] leading-relaxed text-slate-500 dark:text-slate-300">
          {description}
        </p>
        <Link
          href={href}
          className="primary-btn inline-block min-w-37.5 text-center text-[14px] shadow-lg shadow-sky-500/20 group-hover:shadow-xl group-hover:shadow-sky-500/25"
          onClick={(event) => event.stopPropagation()}
        >
          Continue
        </Link>
      </div>
  );
}
