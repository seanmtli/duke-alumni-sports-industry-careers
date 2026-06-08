'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/directory', label: 'Directory' },
  { href: '/stats', label: 'Stats' },
  { href: '/submit', label: 'Submit' },
  { href: '/admin', label: 'Admin' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-[#dce6f7] text-[#003087]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
