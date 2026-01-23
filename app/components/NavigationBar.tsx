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
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <div className="flex-shrink-0">
            <Link 
              href="/" 
              className="text-xl font-bold bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}>
              Roleplay Analyser
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/') && pathname === '/'
                  ? 'bg-realtalk-blue/10 text-realtalk-blue border border-realtalk-blue/20'
                  : 'text-realtalk-blue/70 hover:text-realtalk-blue hover:bg-realtalk-blue/5'
              }`}
            >
              Main Menu
            </Link>
            <Link
              href="/trial"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/trial')
                  ? 'bg-realtalk-blue/10 text-realtalk-blue border border-realtalk-blue/20'
                  : 'text-realtalk-blue/70 hover:text-realtalk-blue hover:bg-realtalk-blue/5'
              }`}
            >
              Start Trial
            </Link>
            <Link
              href="/test-transcription"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/test-transcription')
                  ? 'bg-realtalk-blue/10 text-realtalk-blue border border-realtalk-blue/20'
                  : 'text-realtalk-blue/70 hover:text-realtalk-blue hover:bg-realtalk-blue/5'
              }`}
            >
              Test Transcription
            </Link>

          </div>
        </div>
      </div>
    </nav>
  );
}
