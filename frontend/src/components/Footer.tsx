import Link from "next/link";
import { Github, Linkedin } from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card px-[5%] py-3">
      <div className="mx-auto grid max-w-350 grid-cols-[auto_1fr_auto] items-center gap-3 max-md:flex max-md:flex-col max-md:gap-1.5">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <Logo size="sm" />
          </Link>
        </div>

        <div className="text-center">
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Built by{" "}
            <a
              href="https://ajaynaikportfolio.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:underline"
            >
              Ajay Naik M
            </a>
            .
          </span>
          <div className="mt-1 flex items-center justify-center gap-3 text-xs font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/services" className="hover:text-foreground">Services</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
            <Link href="/auth" className="hover:text-foreground">Login</Link>
          </div>
        </div>

        <div className="flex justify-end gap-3 text-muted-foreground max-md:justify-center">
          <a
            href="https://www.linkedin.com/in/ajaynaikm/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="transition hover:text-primary"
          >
            <Linkedin className="h-5 w-5" />
          </a>
          <a
            href="https://github.com/Ajay-naik19"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="transition hover:text-primary"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
