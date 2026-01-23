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
  const [reportName, setReportName] = useState('');
  const [existingReport, setExistingReport] = useState<{ id: string; name: string; session_id: string; created_at: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

        // Fetch existing report for this session
        const reportResponse = await fetch(`/api/reports?sessionId=${encodeURIComponent(sessionId)}`);
        const reportData = await reportResponse.json();

        if (reportResponse.ok && reportData.success && reportData.report) {
          setExistingReport(reportData.report);
          setReportName(reportData.report.name);
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

  // Handle save/update report
  const handleSaveReport = async () => {
    if (!reportName.trim()) {
      setSaveError('Report name is required');
      return;
    }

    if (!sessionId) {
      setSaveError('Session ID is missing');
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
          name: reportName.trim(),
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save report');
      }

      setExistingReport(data.report);
      setSaveSuccess(true);
      setIsEditing(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving report:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setReportName(existingReport?.name || '');
    setSaveError(null);
    setSaveSuccess(false);
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

        {/* Report Name Section */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="glass-dark rounded-xl p-4 backdrop-blur-xl border border-gray-200">
            {existingReport && !isEditing ? (
              // Display existing report name with edit button
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-realtalk-blue mb-2">
                    Report Name
                  </label>
                  <div className="px-4 py-2.5 bg-gradient-to-r from-realtalk-blue/10 to-purple-500/10 border-2 border-realtalk-blue/30 rounded-lg text-realtalk-blue font-semibold shadow-sm">
                    {existingReport.name}
                  </div>
                </div>
                <button
                  onClick={handleEdit}
                  className="px-5 py-2.5 bg-gradient-to-r from-realtalk-blue/30 to-purple-500/30 hover:from-realtalk-blue/40 hover:to-purple-500/40 border-2 border-realtalk-blue/40 rounded-lg text-realtalk-blue font-bold hover:text-purple-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap mt-6"
                >
                  Edit Name
                </button>
              </div>
            ) : (
              // Edit mode or create new report
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label htmlFor="report-name" className="block text-sm font-semibold text-purple-400 mb-2">
                    {existingReport ? 'Edit Report Name' : 'Save Report As'}
                  </label>
                  <input
                    id="report-name"
                    type="text"
                    value={reportName}
                    onChange={(e) => {
                      setReportName(e.target.value);
                      setSaveError(null);
                      setSaveSuccess(false);
                    }}
                    placeholder="Enter report name..."
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-300 hover:border-realtalk-blue/40 focus:border-realtalk-blue rounded-lg text-realtalk-blue font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-realtalk-blue/30 transition-all shadow-sm"
                    disabled={saving}
                  />
                </div>
                <div className="flex gap-2">
                  {existingReport && isEditing && (
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-5 py-2.5 bg-gradient-to-r from-gray-200 to-gray-100 hover:from-gray-300 hover:to-gray-200 border-2 border-gray-400 rounded-lg text-gray-700 hover:text-gray-900 font-semibold transition-all shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSaveReport}
                    disabled={saving || !reportName.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-purple-600 hover:from-realtalk-blue hover:via-purple-500 hover:to-pink-500 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
                  >
                    {saving ? 'Saving...' : existingReport ? 'Update Report' : 'Save Report'}
                  </button>
                </div>
              </div>
            )}

            {/* Save Status Messages */}
            {saveSuccess && (
              <div className="mt-3 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                ✓ Report {existingReport ? 'updated' : 'saved'} successfully!
              </div>
            )}
            {saveError && (
              <div className="mt-3 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                ✗ {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Timeline Report and Session Summary - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {/* Timeline Report - Left Column (2/3 width on large screens) */}
          <div className="lg:col-span-2">
            <TimelineReport sessionData={sessionData} />
          </div>
          
          {/* Session Summary - Right Column (1/3 width on large screens) */}
          <div className="lg:col-span-1 flex">
            <SessionSummary
              signals={sessionData.signals}
              startTime={sessionData.startTime}
              endTime={sessionData.endTime || Date.now()}
              isLive={false}
              className="w-full"
              sessionId={sessionId}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
