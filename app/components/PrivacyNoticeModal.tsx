'use client';

import { useEffect } from 'react';

export default function PrivacyNoticeModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close privacy notice"
      />
      <div
        className="relative z-10 glass-dark rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Trial Privacy Notice (Prototype Trial)
              </h2>
              <p className="text-gray-500 text-sm mt-1">Last updated: 6 February 2026</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg hover:bg-gray-200/80 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 text-realtalk-blue/80 text-sm">
            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">1) Who we are</h3>
              <p className="leading-relaxed">
                This prototype trial is provided by Toby Sinclair Coaching Limited (&quot;we&quot;, &quot;us&quot;). We are the data controller for the processing described in this notice.
                <br />
                Contact: <a href="mailto:privacy@realtalkstudio.com" className="text-realtalk-blue underline hover:no-underline">privacy@realtalkstudio.com</a>
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">2) What this trial does</h3>
              <p className="leading-relaxed">
                This prototype provides roleplay sessions with real-time feedback, including non-verbal feedback generated using camera/microphone signals and speech-to-text transcription.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">3) What data we process</h3>
              <p className="leading-relaxed mb-2">During the trial, we process:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Live camera video and microphone audio (for real-time analysis and feedback)</li>
                <li>Conversation transcript and/or chat log (generated during the session)</li>
                <li>Emotion / non-verbal tags generated during the session</li>
                <li>Basic session metadata (e.g., timestamps, session IDs, technical diagnostics needed to operate the service)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">4) What we store and what we don&apos;t store</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Stored:</strong> We store the transcript/chat log, feedback, emotion/non-verbal tags, and limited session metadata.</li>
                <li><strong>Not stored:</strong> We do not store replayable audio or video recordings of your camera/microphone stream.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">5) Why we use this data</h3>
              <p className="leading-relaxed mb-2">We use the data to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Provide the roleplay experience and real-time feedback</li>
                <li>Evaluate performance and usability of the prototype</li>
                <li>Fix bugs and improve reliability and accuracy of the prototype</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">6) Our lawful basis</h3>
              <p className="leading-relaxed">
                We process camera/microphone signals and store the transcript/tags on the basis of your consent. You can withdraw consent by not participating, closing the page, or revoking camera/microphone permissions in your browser.
                <br />
                If you want stored trial data deleted, contact <a href="mailto:privacy@realtalkstudio.com" className="text-realtalk-blue underline hover:no-underline">privacy@realtalkstudio.com</a>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">7) How long we keep data</h3>
              <p className="leading-relaxed">
                We retain stored trial data (transcripts/chat logs, emotion/non-verbal tags, and relevant session metadata) for up to 30 days, and then delete it.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">8) Service providers (sub-processors)</h3>
              <p className="leading-relaxed mb-2">We use the following service providers to deliver this prototype trial:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Deepgram (<a href="mailto:privacy@deepgram.com" className="text-realtalk-blue underline hover:no-underline">privacy@deepgram.com</a>) — Speech-to-text transcription (AI provider)</li>
                <li>Interhuman (<a href="mailto:privacy@interhuman.ai" className="text-realtalk-blue underline hover:no-underline">privacy@interhuman.ai</a>) — Non-verbal feedback analysis (AI provider)</li>
                <li>Vercel (<a href="mailto:privacy@vercel.com" className="text-realtalk-blue underline hover:no-underline">privacy@vercel.com</a>) — Hosting and deployment (connected provider)</li>
                <li>Supabase (<a href="mailto:privacy@supabase.com" className="text-realtalk-blue underline hover:no-underline">privacy@supabase.com</a>) — Database and authentication services (connected provider)</li>
              </ul>
              <p className="leading-relaxed mt-2">These providers process data only to provide their services to us.</p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">9) International transfers</h3>
              <p className="leading-relaxed">
                Some of our service providers may process data outside the UK. Where applicable, we rely on appropriate safeguards for international transfers (such as contractual protections).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">10) Your choices and rights</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Do not participate:</strong> If you do not consent, choose Decline and do not start the trial.</li>
                <li><strong>Stop anytime:</strong> Close the page at any time and revoke permissions in your browser settings.</li>
                <li><strong>Request deletion:</strong> Email <a href="mailto:privacy@realtalkstudio.com" className="text-realtalk-blue underline hover:no-underline">privacy@realtalkstudio.com</a> with the date/time of your session and we will delete your stored trial data where we can identify it.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">11) Important note</h3>
              <p className="leading-relaxed">
                Please avoid sharing sensitive personal information (e.g., health details) during the roleplay.
              </p>
            </section>

            {/* Include this section only if Interhuman is configured so trial data is not used for model improvement/training */}
            <section>
              <h3 className="font-semibold text-realtalk-blue mb-2">12) Interhuman model improvement/training</h3>
              <p className="leading-relaxed">
                We have configured Interhuman&apos;s service so that data submitted from this trial is not used for Interhuman model improvement/training.
              </p>
            </section>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-6 py-3 glass-dark border border-gray-200 hover:border-gray-300 text-realtalk-blue font-semibold rounded-lg transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
