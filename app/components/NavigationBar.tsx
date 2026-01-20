'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="glass-dark border-b border-white/10 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
              Roleplay Analyser
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/')
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-gray-300 hover:text-orange-400 hover:bg-white/5'
              }`}
            >
              Main Screen
            </Link>
            <Link
              href="/test-transcription"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/test-transcription')
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-gray-300 hover:text-orange-400 hover:bg-white/5'
              }`}
            >
              Test Transcription
            </Link>
            <Link
              href="/reports"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/reports')
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-gray-300 hover:text-orange-400 hover:bg-white/5'
              }`}
            >
              Saved Reports
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
