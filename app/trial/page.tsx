'use client';

import VideoPlayer from '../components/VideoPlayer';
import SessionControls from '../components/SessionControls';
import SessionSummary from '../components/SessionSummary';
import ConsentModal from '../components/ConsentModal';
import QuestionPopUp from '../components/QuestionPopUp';
import CategorySignalsFeedbackModal from '../components/CategorySignalsFeedbackModal';
import type { CategoryFeedbackData } from '../components/CategorySignalsFeedbackModal';
import { useState, useEffect, useRef } from 'react';
import { BehavioralSignal, Question, QuestionCategory } from '../lib/types';
import { useSession } from '../lib/session-context';
import { useRouter } from 'next/navigation';

const QUESTIONS_PER_CATEGORY = 5;

/** Keep signals paused this long after the category feedback modal is dismissed (flush pipeline). */
const SIGNALS_COOLDOWN_MS_AFTER_POPUP = 2500;
/** Pause signals this long before showing the category feedback modal (let in-flight analysis finish). */
const SIGNALS_BUFFER_MS_BEFORE_POPUP = 2500;

/** Category order for the trial: 5 questions per category in this order. */
const CATEGORY_ORDER: QuestionCategory[] = [
  'maths',
  'casual',
  'pub_quiz',
  'open_ended',
  'science',
  'reasoning',
  'sports',
];

/** Fisher–Yates shuffle (mutates array). */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Normalize category for grouping (DB may return "Science" or "science" etc.). */
function normalizeCategory(cat: string): string {
  return (cat || '').toLowerCase().trim();
}

/** Pick up to 5 questions per category (random within category). Uses normalized category so DB casing (e.g. "Science") matches. */
function pickQuestionsByCategory(questions: Question[]): Question[] {
  const byCategory = new Map<string, Question[]>();
  for (const q of questions) {
    const key = normalizeCategory(q.category);
    const list = byCategory.get(key) ?? [];
    list.push(q);
    byCategory.set(key, list);
  }
  const result: Question[] = [];
  for (const category of CATEGORY_ORDER) {
    const key = normalizeCategory(category);
    const list = byCategory.get(key) ?? [];
    if (list.length === 0) continue; // skip categories with no questions in the bank
    const copy = [...list];
    shuffleInPlace(copy);
    result.push(...copy.slice(0, QUESTIONS_PER_CATEGORY));
  }
  return result;
}

/** Format category for display (e.g. pub_quiz -> Pub quiz). */
function formatCategoryForDisplay(cat: string): string {
  return cat.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/** Alias for pickQuestionsByCategory (kept for compatibility with any cached/bundled references). */
function pickQuestionsForSession(questions: Question[]): Question[] {
  return pickQuestionsByCategory(questions);
}

export default function TrialPage() {
  const router = useRouter();
  const [streamStatus, setStreamStatus] = useState<string>('Not started');
  /** True when VideoPlayer has called onStreamReady (camera rolling). First question shows only after this. */
  const [streamReady, setStreamReady] = useState<boolean>(false);
  /** Questions for this run (loaded from API, 5 per category in order). */
  const [questions, setQuestions] = useState<Question[]>([]);
  /** Per-category question count for this run (e.g. { maths: 5, reasoning: 4 }) so we can show "27 questions (5 Maths, 4 Reasoning, …)". */
  const [questionCountByCategory, setQuestionCountByCategory] = useState<Record<string, number>>({});
  /** Current question index in the script; -1 = none, 0..n-1 = current. */
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  /** Answer windows (start/end time + category) for the current session, used for category feedback. */
  const [answerWindows, setAnswerWindows] = useState<Array<{ startTime: number; endTime: number; category: string }>>([]);
  /** After 5 questions of a category, show this modal; when set, we pause before the next question. */
  const [categoryFeedbackModal, setCategoryFeedbackModal] = useState<{
    category: string;
    startTime: number;
    endTime: number;
  } | null>(null);
  /** When category feedback modal is shown, this is the next index to go to on submit. */
  const [pendingNextIndex, setPendingNextIndex] = useState<number | null>(null);
  /** True for N seconds after user dismisses the category feedback modal (signals stay paused). */
  const [signalsCooldownActive, setSignalsCooldownActive] = useState(false);
  /** When set, we are in the pre-popup buffer; after delay we show categoryFeedbackModal. */
  const [pendingCategoryModal, setPendingCategoryModal] = useState<{
    category: string;
    startTime: number;
    endTime: number;
  } | null>(null);
  const pendingModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Shown for 2s in centre of video when transitioning to next question (or category modal). */
  const [showNextQuestionOverlay, setShowNextQuestionOverlay] = useState(false);
  const nextQuestionOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stored action to run after "Next Question" overlay (advance index or show category modal). */
  const pendingAfterOverlayRef = useRef<(() => void) | null>(null);
  const [summaryData, setSummaryData] = useState<{
    signals: BehavioralSignal[];
    startTime: number;
    endTime: number;
  } | null>(null);
  const [liveEndTime, setLiveEndTime] = useState<number>(Date.now());
  const { updateSignals, isActive: sessionActive, sessionState, stopSession, startSession } = useSession();
  const previousActiveState = useRef<boolean>(false);
  const preservedSessionData = useRef<{ signals: BehavioralSignal[]; startTime: number; sessionId: string | null } | null>(null);

  // Load questions from API on mount; up to 5 per category (only categories with questions in the bank)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/questions')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch questions'))))
      .then((data: Question[]) => {
        if (cancelled) return;
        const list = pickQuestionsForSession(data);
        setQuestions(list);
        const byCategory: Record<string, number> = {};
        for (const q of list) {
          const key = normalizeCategory(q.category);
          byCategory[key] = (byCategory[key] ?? 0) + 1;
        }
        setQuestionCountByCategory(byCategory);
      })
      .catch((err) => {
        if (!cancelled) console.error('Error loading questions:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Show first question only when session is active AND camera stream is ready (so analysis can run)
  useEffect(() => {
    if (sessionActive && streamReady && questions.length > 0 && currentQuestionIndex === -1) {
      setCurrentQuestionIndex(0);
    }
  }, [sessionActive, streamReady, questions.length, currentQuestionIndex]);

  // Clean up signal buffer/cooldown/overlay timeouts on unmount
  useEffect(() => {
    return () => {
      if (pendingModalTimeoutRef.current) clearTimeout(pendingModalTimeoutRef.current);
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      if (nextQuestionOverlayTimeoutRef.current) clearTimeout(nextQuestionOverlayTimeoutRef.current);
    };
  }, []);

  // Answer window: run analysis only while a question pop-up is shown (not during feedback modal, overlay, or pre/post buffer)
  const showingPopUp =
    sessionActive &&
    currentQuestionIndex >= 0 &&
    currentQuestionIndex < questions.length &&
    !categoryFeedbackModal &&
    !pendingCategoryModal &&
    !showNextQuestionOverlay;

  // Preserve session data before it's cleared
  useEffect(() => {
    if (sessionActive && sessionState.signals.length > 0 && sessionState.startTime) {
      preservedSessionData.current = {
        signals: [...sessionState.signals],
        startTime: sessionState.startTime,
        sessionId: sessionState.sessionId,
      };
    }
  }, [sessionActive, sessionState.signals, sessionState.startTime, sessionState.sessionId]);

  // Track session end and prepare summary data, and reset when new session starts
  useEffect(() => {
    // Detect when session transitions from inactive to active (new session starting)
    if (!previousActiveState.current && sessionActive) {
      setSummaryData(null);
      preservedSessionData.current = null;
      setAnswerWindows([]);
      setCategoryFeedbackModal(null);
      setPendingNextIndex(null);
      setSignalsCooldownActive(false);
      setPendingCategoryModal(null);
      setShowNextQuestionOverlay(false);
      if (pendingModalTimeoutRef.current) {
        clearTimeout(pendingModalTimeoutRef.current);
        pendingModalTimeoutRef.current = null;
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
      if (nextQuestionOverlayTimeoutRef.current) {
        clearTimeout(nextQuestionOverlayTimeoutRef.current);
        nextQuestionOverlayTimeoutRef.current = null;
      }
    }
    
    // Detect when session transitions from active to inactive (session ending)
    if (previousActiveState.current && !sessionActive) {
      setCurrentQuestionIndex(-1);
      const endTime = Date.now();
      
      // Use preserved data if current state is already cleared
      const signals = sessionState.signals.length > 0 
        ? sessionState.signals 
        : (preservedSessionData.current?.signals || []);
      const startTime = sessionState.startTime || preservedSessionData.current?.startTime;
      const sessionId = sessionState.sessionId || preservedSessionData.current?.sessionId;
      
      if (signals.length > 0 && startTime && sessionId) {
        setSummaryData({
          signals,
          startTime,
          endTime,
        });
        
        // Navigate to timeline page when session ends
        router.push(`/timeline/${sessionId}`);
        
        // Clear preserved data after using it
        preservedSessionData.current = null;
      }
    }
    
    previousActiveState.current = sessionActive;
  }, [sessionActive, sessionState.startTime, sessionState.signals, sessionState.sessionId, router]);

  // Update live endTime periodically when session is active (to avoid hydration issues)
  useEffect(() => {
    if (sessionActive && !summaryData) {
      // Update immediately on mount
      setLiveEndTime(Date.now());
      
      // Update every second for live display
      const interval = setInterval(() => {
        setLiveEndTime(Date.now());
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      // Reset when session ends
      setLiveEndTime(Date.now());
    }
  }, [sessionActive, summaryData]);

  const handleCloseSummary = () => {
    setSummaryData(null);
  };

  /** Save answer via API and advance to next question, show category feedback after 5, or end session. */
  const handleQuestionAnswer = async (
    windowStart: number,
    windowEnd: number,
    spokenAnswer: string,
    correct: boolean | null
  ) => {
    const sessionId = sessionState.sessionId;
    const question = questions[currentQuestionIndex];
    if (!sessionId || !question) return;

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addAnswer',
          sessionId,
          questionId: question.id,
          startTime: windowStart,
          endTime: windowEnd,
          spokenAnswer,
          correct: correct === true || correct === false ? correct : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save answer');
    } catch (err) {
      console.error('Error saving session answer:', err);
    }

    // Record this answer's window for category feedback
    const newWindow = { startTime: windowStart, endTime: windowEnd, category: question.category };
    setAnswerWindows((prev) => [...prev, newWindow]);

    const nextIndex = currentQuestionIndex + 1;

    // Session ends: no overlay
    if (nextIndex >= questions.length) {
      await stopSession();
      return;
    }

    // Show "Next Question" overlay for 2s in centre of video, then advance or show category modal
    if (nextQuestionOverlayTimeoutRef.current) clearTimeout(nextQuestionOverlayTimeoutRef.current);
    setShowNextQuestionOverlay(true);

    if (nextIndex % QUESTIONS_PER_CATEGORY === 0) {
      const windowsSoFar = answerWindows.length;
      const blockStartTime = windowsSoFar >= 4 ? answerWindows[windowsSoFar - 4].startTime : windowStart;
      const blockEndTime = windowEnd;
      pendingAfterOverlayRef.current = () => {
        setPendingNextIndex(nextIndex);
        if (pendingModalTimeoutRef.current) clearTimeout(pendingModalTimeoutRef.current);
        setPendingCategoryModal({ category: question.category, startTime: blockStartTime, endTime: blockEndTime });
        pendingModalTimeoutRef.current = setTimeout(() => {
          pendingModalTimeoutRef.current = null;
          setPendingCategoryModal((prev) => {
            if (prev) setCategoryFeedbackModal(prev);
            return null;
          });
        }, SIGNALS_BUFFER_MS_BEFORE_POPUP);
      };
    } else {
      pendingAfterOverlayRef.current = () => setCurrentQuestionIndex(nextIndex);
    }

    nextQuestionOverlayTimeoutRef.current = setTimeout(() => {
      nextQuestionOverlayTimeoutRef.current = null;
      setShowNextQuestionOverlay(false);
      pendingAfterOverlayRef.current?.();
      pendingAfterOverlayRef.current = null;
    }, 2000);
  };

  /** Called when user submits the category signals feedback modal; save to API, start cooldown, then advance or end session. */
  const handleCategoryFeedbackSubmit = async (data: CategoryFeedbackData) => {
    const next = pendingNextIndex;
    const modal = categoryFeedbackModal;
    const sessionId = sessionState.sessionId;

    setCategoryFeedbackModal(null);
    setPendingNextIndex(null);

    // Post-popup cooldown: keep signals paused for a few seconds so pipeline flushes before next question block
    setSignalsCooldownActive(true);
    if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
    cooldownTimeoutRef.current = setTimeout(() => {
      cooldownTimeoutRef.current = null;
      setSignalsCooldownActive(false);
    }, SIGNALS_COOLDOWN_MS_AFTER_POPUP);

    if (sessionId && modal) {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'addCategoryFeedback',
            sessionId,
            category: modal.category,
            accurate: data.accurate,
            missedSignals: data.missedSignals ?? [],
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error('Error saving category feedback:', res.status, errBody);
        }
      } catch (err) {
        console.error('Error saving category feedback:', err);
      }
    }

    if (next === null) return;
    if (next >= questions.length) {
      stopSession();
    } else {
      setCurrentQuestionIndex(next);
    }
  };

  return (
    <>
      <ConsentModal trialMode />
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-turquoise-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 max-w-6xl w-full items-center justify-between animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up pt-4">
          <h1 
            className="text-2xl sm:text-2xl md:text-5xl lg:text-5xl font-bold mb-4 leading-normal pb-2 bg-gradient-to-r from-realtalk-dark via-realtalk-blue to-realtalk-light bg-clip-text px-4"
            style={{
              backgroundImage: 'linear-gradient(to right, #5442b3, #6164F0, #8272e5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
            Roleplay Body Language Analyser
          </h1>
          <p 
            className="text-realtalk-blue text-lg sm:text-lg md:text-xl mt-2 font-medium">
            Real-time behavioural analysis powered by AI
          </p>
          {questions.length > 0 && (
            <p className="text-gray-500 text-sm mt-2" title="Question count depends on how many are in the bank per category (up to 5 each).">
              This session: <span className="font-semibold text-realtalk-blue">{questions.length} questions</span>
              {Object.keys(questionCountByCategory).length > 0 && (
                <span className="ml-1">
                  ({Object.entries(questionCountByCategory)
                    .sort((a, b) => CATEGORY_ORDER.indexOf(a[0] as QuestionCategory) - CATEGORY_ORDER.indexOf(b[0] as QuestionCategory))
                    .map(([cat, n]) => `${formatCategoryForDisplay(cat)} ${n}`)
                    .join(', ')})
                </span>
              )}
            </p>
          )}
        </div>
        
        {/* Session Controls */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SessionControls streamStatus={streamStatus} />
        </div>

        {/* Video Player and Session Summary - Side by Side */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6 animate-fade-in-up items-start" style={{ animationDelay: '0.2s' }}>
          {/* Video Player Container - Main Focus */}
          <div className="w-full relative">
            <div className="glass-dark rounded-2xl p-4 md:p-6 backdrop-blur-xl border border-gray-200 shadow-2xl relative">
              <VideoPlayer
                autoStart={sessionActive}
                enabled={true}
                answerWindowActive={showingPopUp}
                signalsPaused={!!categoryFeedbackModal || signalsCooldownActive || !!pendingCategoryModal || showNextQuestionOverlay}
                analysisInterval={5000}
                idleButtonLabel="Start Session"
                onIdleButtonClick={startSession}
                sessionActive={sessionActive}
                onStreamReady={(stream) => {
                  console.log('Stream ready:', stream);
                  setStreamStatus('Streaming active - Analysis enabled');
                  setStreamReady(true);
                }}
                onStreamError={(error) => {
                  console.error('Stream error:', error);
                  setStreamStatus(`Error: ${error.message}`);
                }}
                onStreamStop={() => {
                  console.log('Stream stopped');
                  setStreamStatus('Stream stopped');
                  setStreamReady(false);
                }}
                onSignalsUpdate={(signals) => {
                  console.log('Signals updated:', signals);
                  // Update session with signals if session is active
                  if (sessionActive) {
                    updateSignals(signals);
                  }
                }}
                className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200"
              />
              {showingPopUp && questions[currentQuestionIndex] && (
                <QuestionPopUp
                  question={questions[currentQuestionIndex]}
                  questionNumber={currentQuestionIndex + 1}
                  onAnswer={handleQuestionAnswer}
                  timeoutSeconds={questions[currentQuestionIndex].type === 'open_ended' ? null : 30}
                  position="top"
                />
              )}
              {(pendingCategoryModal || (signalsCooldownActive && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length)) && !categoryFeedbackModal && (
                <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto animate-fade-in">
                  <div className="glass-dark rounded-t-lg px-4 py-4 backdrop-blur-xl border-t border-gray-300/50 border-l border-r border-gray-300/30 shadow-2xl text-center">
                    <p className="text-realtalk-blue font-medium">Please wait...</p>
                    <p className="text-gray-500 text-sm mt-0.5">Preparing next section</p>
                  </div>
                </div>
              )}
              {categoryFeedbackModal && (
                <CategorySignalsFeedbackModal
                  category={categoryFeedbackModal.category}
                  categoryLabel=""
                  signals={sessionState.signals}
                  startTime={categoryFeedbackModal.startTime}
                  endTime={categoryFeedbackModal.endTime}
                  onSubmit={handleCategoryFeedbackSubmit}
                />
              )}
            </div>
          </div>

          {/* Session Summary - Sidebar, fixed height with scroll so it doesn't jolt the page */}
          <div className="w-full flex h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)] min-h-0 lg:sticky lg:top-4">
            <SessionSummary
              signals={summaryData?.signals || (sessionActive ? sessionState.signals : [])}
              startTime={summaryData?.startTime || sessionState.startTime || null}
              endTime={summaryData?.endTime || (sessionActive ? liveEndTime : Date.now())}
              isLive={sessionActive && !summaryData}
              onClose={summaryData ? handleCloseSummary : undefined}
              sessionId={sessionState.sessionId}
              className="w-full h-full min-h-0"
            />
          </div>
        </div>
                  {/* Instructions */}
                  <div className="mt-6 glass-dark rounded-2xl p-6 backdrop-blur-xl border border-white/10 shadow-2xl text-left">
            <h3 className="text-xl font-semibold mb-4 text-realtalk-dark">Session Instructions</h3>
            <ol className="list-decimal list-outside pl-5 space-y-2.5 text-base md:text-md text-gray-700 leading-relaxed">
              <li>Click &quot;Start Recording&quot; and grant microphone permissions.</li>
              <li>Speak clearly into your microphone and ensure the camera captures your body language.</li>
              <li>Watch the Live Transcription area and body language analysis in the video player.</li>
              <li>Answer each question as best you can.</li>
              <li>After 5 questions of a category, you will be shown a brief feedback page to review the body language analysis.</li>
              <li>When you have answered all the questions, you will be shown the report page.</li>
              <li>In the timeline report, you can review your results and give feedback.</li>
            </ol>
          </div>
      </div>
    </main>
    </>
  );
}
