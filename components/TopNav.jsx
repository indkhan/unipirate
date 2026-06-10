'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo, cx } from './ui';
import AuthControls from './AuthControls';

const NAV_ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/onboarding', label: 'Profile' },
  { href: '/result', label: 'Recognition' },
  { href: '/finder', label: 'Course finder' },
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                'px-3 py-2 rounded-md transition-colors',
                pathname === item.href ? 'text-ink-90 bg-ink-5' : 'text-ink-50 hover:text-ink-90'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
