"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Benchmarks" },
  { href: "/run", label: "Run Eval" },
  { href: "/results", label: "Results" },
  { href: "/compare", label: "Compare" },
  { href: "/dataset", label: "RAGTruth" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--grounded)]" aria-hidden />
          <span className="font-mono text-sm font-semibold uppercase tracking-widest text-[var(--text)]">
            Halo Eval
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
