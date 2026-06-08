import Link from 'next/link';
import { Nav } from './Nav';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-sm bg-[#003087] flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-tight">D</span>
            </div>
            <span className="font-semibold text-gray-900 text-base leading-tight">
              Duke Sports
              <span className="block text-xs font-normal text-gray-400 leading-tight tracking-wide uppercase">
                Alumni Directory
              </span>
            </span>
          </Link>
          <Nav />
        </div>
      </div>
    </header>
  );
}
