'use client';

import dynamic from 'next/dynamic';

// Dynamically import ConsentModal with SSR disabled to avoid build issues
const ConsentModal = dynamic(() => import('./ConsentModal'), {
  ssr: false,
});

export default function ConsentModalWrapper() {
  return <ConsentModal />;
}
