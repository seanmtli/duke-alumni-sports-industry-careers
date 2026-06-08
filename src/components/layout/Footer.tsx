import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          Duke Sports Alumni Directory &mdash; A community project
        </p>
        <div className="flex items-center gap-4">
          <Link href="/contact" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Contact / Request Removal
          </Link>
          <p className="text-xs text-gray-400">
            Not affiliated with Duke University
          </p>
        </div>
      </div>
    </footer>
  );
}
