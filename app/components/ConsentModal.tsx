'use client';

import { useState, useEffect } from 'react';
import PrivacyNoticeModal from './PrivacyNoticeModal';

const CONSENT_STORAGE_KEY = 'inhuman-trial-consent-accepted';

export default function ConsentModal() {
  const [showModal, setShowModal] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has already accepted (only on client side)
    if (typeof window !== 'undefined') {
      try {
        const hasAccepted = localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
        if (!hasAccepted) {
          setShowModal(true);
        }
      } catch (error) {
        // If localStorage is not available, show the modal
        setShowModal(true);
      }
    } else {
      // During SSR, don't show modal
      setShowModal(false);
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      } catch (error) {
        console.error('Failed to save consent to localStorage:', error);
      }
    }
    setShowModal(false);
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
          e.stopPropagation();
        }}
      />

      {showPrivacyNotice && (
        <PrivacyNoticeModal onClose={() => setShowPrivacyNotice(false)} />
      )}

      {/* Consent Modal */}
      <div className="relative z-10 glass-dark rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl animate-scale-in">
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
              }}
            >
              Camera, Microphone & Session Data Consent (Prototype Trial)
            </h2>
            <p className="text-gray-500 text-sm">
              Please read and accept to continue.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 text-realtalk-blue/80">
            <p className="text-sm leading-relaxed">
              This prototype uses your camera and microphone for real-time non-verbal analysis to provide feedback during the roleplay.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-2">What we store (30 days)</h3>
              <p className="text-sm leading-relaxed">
                We store the conversation transcript/chat log, feedback, and emotion / non-verbal tags generated during the session for up to 30 days, to evaluate and improve the prototype.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-2">What we don&apos;t store</h3>
              <p className="text-sm leading-relaxed">
                We do not store a replayable video or audio recording of your camera/microphone stream.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-2">Third-party processing</h3>
              <p className="text-sm leading-relaxed">
                We use service providers to run the prototype, including Interhuman (non-verbal analysis), Deepgram (speech-to-text), Vercel (hosting), and Supabase (database).
              </p>
            </div>

            <p className="text-sm leading-relaxed">
              Please don&apos;t share sensitive personal information (e.g., health details) during the roleplay.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-realtalk-blue mb-2">Delete request</h3>
              <p className="text-sm leading-relaxed">
                If you want your trial session data deleted earlier, email{' '}
                <a href="mailto:privacy@realtalkstudio.com" className="text-realtalk-blue underline hover:no-underline">
                  privacy@realtalkstudio.com
                </a>{' '}
                with the date/time of your session.
              </p>
            </div>

            <div className="bg-realtalk-blue/10 rounded-lg p-4 border border-realtalk-blue/30">
              <p className="text-sm leading-relaxed text-realtalk-blue/80 mb-3">
                <strong className="text-realtalk-blue">By clicking I Agree,</strong> you consent to:
              </p>
              <ul className="space-y-2 text-sm text-realtalk-blue/70 list-disc list-inside">
                <li>Access to your camera and microphone for real-time analysis</li>
                <li>Processing by our providers (Interhuman and Deepgram) to generate feedback and transcription</li>
                <li>Storage of the transcript/chat log, feedback,and generated tags for prototype evaluation (up to 30 days)</li>
              </ul>
            </div>

            <p className="text-sm">
              <button
                type="button"
                onClick={() => setShowPrivacyNotice(true)}
                className="text-realtalk-blue underline hover:no-underline font-medium"
              >
                Read the Trial Privacy Notice
              </button>
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleAccept}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-realtalk-dark to-realtalk-blue hover:from-realtalk-blue hover:to-realtalk-light text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-realtalk-blue/50 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              I Agree
            </button>
            <button
              onClick={() => {
                alert('You must accept the terms to use this application.');
              }}
              className="flex-1 px-6 py-3 glass-dark border border-gray-200 hover:border-gray-300 text-realtalk-blue/70 hover:text-realtalk-blue font-semibold rounded-lg transition-all duration-200"
            >
              Decline
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 pt-2">
            You can revoke this consent at any time by clearing your browser&apos;s local storage or revoking camera/microphone permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
