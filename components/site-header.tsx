"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge, cx, Icon, Logo } from "@/components/ui"

const links = [
  { label: "Overview", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Profile", href: "/profile" },
  { label: "Recognition", href: "/recognition" },
  { label: "Course finder", href: "/courses" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center" aria-label="UniPirate home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 text-[13px] md:flex" aria-label="Primary">
          {links.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cx(
                "rounded-md px-3 py-2",
                pathname === href
                  ? "bg-ink-5 text-ink-90"
                  : "text-ink-50 hover:text-ink-90",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Badge tone="neutral">
          <Icon name="sparkle" size={11} /> Preview
        </Badge>
      </div>
    </header>
  )
}
