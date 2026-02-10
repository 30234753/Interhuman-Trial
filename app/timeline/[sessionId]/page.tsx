'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SessionData } from '@/app/lib/types';
import TimelineReport from '@/app/components/TimelineReport';
import SessionSummary from '@/app/components/SessionSummary';

export default function TimelineReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingReport, setExistingReport] = useState<{
    id: string;
    session_id: string;
    created_at: string;
    rating?: number | null;
    feedback?: string | null;
    positives?: string | null;
    negatives?: string | null;
    adaptation_rating?: number | null;
    use_cases?: string[] | null;
    use_cases_other?: string | null;
    concerns?: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [positives, setPositives] = useState<string>('');
  const [negatives, setNegatives] = useState<string>('');
  const [rating, setRating] = useState<number | null>(null);
  const [adaptationRating, setAdaptationRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [useCases, setUseCases] = useState<string[]>([]);
  const [useCasesOther, setUseCasesOther] = useState<string>('');
  const [concerns, setConcerns] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);

  // Fetch session data and existing report
  useEffect(() => {
    if (!sessionId) {
      setError('Session ID is required');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch session data
        const sessionResponse = await fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`);
        const sessionData_result = await sessionResponse.json();

        if (!sessionResponse.ok || !sessionData_result.success) {
          throw new Error(sessionData_result.error || 'Failed to fetch session data');
        }

        if (!sessionData_result.sessionData) {
          throw new Error('Session data not found');
        }

        // Validate session has data
        if (!sessionData_result.sessionData.signals || sessionData_result.sessionData.signals.length === 0) {
          setError('Session has no signals. Cannot generate timeline report.');
          setLoading(false);
          return;
        }

        setSessionData(sessionData_result.sessionData);

        // Fetch session data (which now includes rating/feedback)
        const reportResponse = await fetch(`/api/reports?sessionId=${encodeURIComponent(sessionId)}`);
        const reportData = await reportResponse.json();

        if (reportResponse.ok && reportData.success && reportData.report) {
          setExistingReport(reportData.report);
          setPositives(reportData.report.positives ?? '');
          setNegatives(reportData.report.negatives ?? '');
          setRating(reportData.report.rating ?? null);
          setAdaptationRating(reportData.report.adaptation_rating ?? null);
          setFeedback(reportData.report.feedback ?? '');
          setUseCases(Array.isArray(reportData.report.use_cases) ? reportData.report.use_cases : []);
          setUseCasesOther(reportData.report.use_cases_other ?? '');
          setConcerns(reportData.report.concerns ?? '');
          const hasAnyFeedback =
            (reportData.report.positives != null && reportData.report.positives.trim() !== '') ||
            (reportData.report.negatives != null && reportData.report.negatives.trim() !== '') ||
            reportData.report.rating !== null ||
            reportData.report.adaptation_rating !== null ||
            (reportData.report.feedback != null && reportData.report.feedback.trim() !== '') ||
            (Array.isArray(reportData.report.use_cases) && reportData.report.use_cases.length > 0) ||
            (reportData.report.use_cases_other != null && reportData.report.use_cases_other.trim() !== '') ||
            (reportData.report.concerns != null && reportData.report.concerns.trim() !== '');
          setIsLocked(hasAnyFeedback);
        } else {
          setExistingReport({
            id: sessionId,
            session_id: sessionId,
            created_at: new Date().toISOString(),
            rating: null,
            feedback: null,
            positives: null,
            negatives: null,
            adaptation_rating: null,
            use_cases: null,
            use_cases_other: null,
            concerns: null,
          });
          setIsLocked(false);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load session data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  const handleEdit = () => {
    setIsLocked(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSubmitRatingAndFeedback = async () => {
    if (!sessionId) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          positives: positives,
          negatives: negatives,
          rating: rating,
          adaptationRating: adaptationRating,
          feedback: feedback,
          useCases: useCases,
          useCasesOther: useCasesOther,
          concerns: concerns,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save rating and feedback');
      }

      setExistingReport(data.session);
      setPositives(data.session.positives ?? '');
      setNegatives(data.session.negatives ?? '');
      setRating(data.session.rating ?? null);
      setAdaptationRating(data.session.adaptation_rating ?? null);
      setFeedback(data.session.feedback ?? '');
      setUseCases(Array.isArray(data.session.use_cases) ? data.session.use_cases : []);
      setUseCasesOther(data.session.use_cases_other ?? '');
      setConcerns(data.session.concerns ?? '');
      setIsLocked(true);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving rating and feedback:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save rating and feedback');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="z-10 glass-dark rounded-2xl p-8 backdrop-blur-xl border border-gray-200 shadow-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-realtalk-blue mx-auto mb-4"></div>
            <p className="text-gray-400">Loading timeline report...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="z-10 glass-dark rounded-2xl p-8 backdrop-blur-xl border border-white/10 shadow-2xl max-w-2xl w-full">
          <div className="text-center">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Error Loading Report</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gradient-to-r from-realtalk-dark to-realtalk-blue hover:from-realtalk-blue hover:to-realtalk-light text-white font-semibold rounded-lg transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!sessionData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="z-10 glass-dark rounded-2xl p-8 backdrop-blur-xl border border-gray-200 shadow-2xl">
          <div className="text-center">
            <p className="text-gray-400">No session data available</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-7xl w-full animate-fade-in">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 
                className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}>
                Timeline Report
              </h1>
              <p className="text-gray-400 text-sm">
                Session ID: {sessionId}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 text-sm bg-gradient-to-r from-gray-100 to-gray-50 hover:from-realtalk-blue/20 hover:to-purple-500/20 border-2 border-gray-300 hover:border-realtalk-blue/40 rounded-lg text-realtalk-blue font-semibold hover:text-realtalk-blue transition-all shadow-sm hover:shadow-md"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        {/* Save Status Messages */}
        {saveSuccess && (
          <div className="mb-6 animate-fade-in-up px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
            ✓ Feedback saved successfully!
          </div>
        )}
        {saveError && (
          <div className="mb-6 animate-fade-in-up px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            ✗ {saveError}
          </div>
        )}

        {/* Timeline Report and Session Summary - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up items-start" style={{ animationDelay: '0.2s' }}>
          {/* Timeline Report - Left Column (2/3 width on large screens) */}
          <div className="lg:col-span-2">
            <TimelineReport 
              sessionData={sessionData}
              positives={positives}
              onPositivesChange={setPositives}
              negatives={negatives}
              onNegativesChange={setNegatives}
              rating={rating}
              feedback={feedback}
              adaptationRating={adaptationRating}
              onAdaptationRatingChange={setAdaptationRating}
              onRatingChange={setRating}
              onFeedbackChange={setFeedback}
              useCases={useCases}
              onUseCasesChange={setUseCases}
              useCasesOther={useCasesOther}
              onUseCasesOtherChange={setUseCasesOther}
              concerns={concerns}
              onConcernsChange={setConcerns}
              onSubmit={handleSubmitRatingAndFeedback}
              onEdit={handleEdit}
              isSubmitting={saving}
              isLocked={isLocked}
              defaultExpandFeedback={true}
            />
          </div>
        
          
          {/* Session Summary - Right Column (1/3 width on large screens) */}
          <div className="lg:col-span-1">
            <SessionSummary
              signals={sessionData.signals}
              startTime={sessionData.startTime}
              endTime={sessionData.endTime || Date.now()}
              isLive={false}
              className="w-full"
              sessionId={sessionId}
              answersCount={sessionData.answers?.length ?? 0}
              averageCorrect={
                sessionData.answers?.length
                  ? (() => {
                      const mc = sessionData.answers!.filter((a) => a.correct !== null);
                      if (mc.length === 0) return null;
                      const correctCount = mc.filter((a) => a.correct === true).length;
                      return (correctCount / mc.length) * 100;
                    })()
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}
