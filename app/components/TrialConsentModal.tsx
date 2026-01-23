'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrialConsentModal() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Always show modal when component mounts (trial page opened)
    setShowModal(true);
  }, []);

  const handleAccept = () => {
    setShowModal(false);
  };

  const handleDecline = () => {
    router.push('/');
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted || !showModal) {
    return <></>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={(e) => {
          // Prevent closing by clicking backdrop - user must accept
          e.stopPropagation();
        }}
      />

      {/* Modal */}
      <div className="relative z-10 glass-dark rounded-2xl p-6 md:p-8 max-w-2xl w-full border border-gray-200 shadow-2xl animate-scale-in">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 
              className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}>
              Camera & Microphone Consent
            </h2>
            <p className="text-gray-500 text-sm">
              Please read and accept the following terms to continue
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 text-realtalk-blue/80">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Facial Tracking & Analysis
              </h3>
              <p className="text-sm leading-relaxed">
                This application uses your camera and microphone to perform real-time facial tracking and behavioral analysis. 
                Your facial expressions, movements, and voice will be analyzed to provide feedback during your roleplay sessions.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Streaming (Not Recording)
              </h3>
              <p className="text-sm leading-relaxed">
                <strong className="text-realtalk-blue">Important:</strong> This application uses <strong>streaming technology</strong> rather than recording. 
                Your audio and video data is processed in real-time and is <strong>not stored or recorded</strong> on your device or our servers. 
                The data is analyzed on-the-fly and immediately discarded after processing.
              </p>
            </div>

            <div className="bg-realtalk-blue/10 rounded-lg p-4 border border-realtalk-blue/30">
              <p className="text-sm leading-relaxed text-realtalk-blue/80">
                <strong className="text-realtalk-blue">By clicking &quot;I Accept&quot;,</strong> you confirm that you understand and consent to:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-realtalk-blue/70 list-disc list-inside">
                <li>Allowing access to your camera and microphone</li>
                <li>Real-time facial tracking and behavioral analysis</li>
                <li>Streaming (not recording) of your audio and video data</li>
                <li>Processing of your data for analysis purposes</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleAccept}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-realtalk-dark to-realtalk-blue hover:from-realtalk-blue hover:to-realtalk-light text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-realtalk-blue/50 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              I Accept
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 px-6 py-3 glass-dark border border-gray-200 hover:border-gray-300 text-realtalk-blue/70 hover:text-realtalk-blue font-semibold rounded-lg transition-all duration-200"
            >
              Decline
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 pt-2">
            This consent is required each time you access the trial page
          </p>
        </div>
      </div>
    </div>
  );
}
