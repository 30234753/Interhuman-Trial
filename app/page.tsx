'use client';

import { useRouter } from 'next/navigation';

export default function MainMenu() {
  const router = useRouter();

  const handleStartTrial = () => {
    router.push('/trial');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-realtalk-blue/5 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-4xl w-full items-center justify-center animate-fade-in">
        {/* Main Title */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent px-4"
            style={{
              backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
            Roleplay Body Language Analyser
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mt-4 font-medium">
            Real-time behavioural analysis powered by AI
          </p>
        </div>

        {/* Information Section */}
        <div className="glass-dark rounded-2xl p-6 md:p-8 lg:p-10 backdrop-blur-xl border border-gray-200 shadow-2xl mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-6 text-gray-700">
            <div>
              <h2 className="text-2xl font-bold mb-3 text-realtalk-blue">About This Application</h2>
              <p className="text-base md:text-lg leading-relaxed">
                Welcome to the Roleplay Body Language Analyser. This application uses advanced AI technology 
                to analyze body language and behavioral signals in real-time during roleplay sessions.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-realtalk-dark">Key Features</h3>
              <ul className="list-disc list-inside space-y-2 text-base md:text-lg ml-2">
                <li>Real-time video analysis of body language and behavioral indicators</li>
                <li>Live tracking of emotional and behavioral signals during sessions</li>
                <li>Comprehensive session summaries with detailed analytics</li>
                <li>Timeline reports for reviewing past sessions</li>
                <li>AI-powered insights into non-verbal communication patterns</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-realtalk-dark">How It Works</h3>
              <p className="text-base md:text-lg leading-relaxed">
                Start a trial session to begin analyzing your roleplay interactions. The system will capture 
                video from your webcam and analyze behavioral signals in real-time, providing insights into 
                body language, emotional states, and communication patterns throughout your session.
              </p>
            </div>
          </div>
        </div>

        {/* Start Trial Button */}
        <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={handleStartTrial}
            className="px-8 py-4 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light text-white text-lg md:text-xl font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-realtalk-blue hover:via-realtalk-light hover:to-realtalk-dark"
            style={{
              backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
            }}
          >
            Start Trial
          </button>
        </div>
      </div>
    </main>
  );
}
