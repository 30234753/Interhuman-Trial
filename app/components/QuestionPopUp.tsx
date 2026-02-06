'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { metaphone } from 'metaphone';
import type { Question } from '@/app/lib/types';
import { useTranscript } from '@/app/lib/transcript-context';

const DEFAULT_TIMEOUT_SECONDS = 20;

/** Letters that can be parsed (only those in the question's options, e.g. A,B,C). */
const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Phonetic codes for how letter names sound (A=ay, B=bee, C=see, D=dee) – used to match ASR output. */
const LETTER_METAPHONE_CODES: Record<string, string> = {
  A: metaphone('ay'),
  B: metaphone('bee'),
  C: metaphone('see'),
  D: metaphone('dee'),
};

/** 0–19 as words → digit string */
const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
/** Tens → value */
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Convert spoken number (words or digits) to canonical digit string, e.g. "forty two" / "42" → "42". Returns null if not a number. Supports 0–999 (twenty one, one hundred, two hundred and five, etc.). */
function parseSpokenNumber(text: string): string | null {
  const raw = text.trim().toLowerCase().replace(/[.,!?\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  // Already digits only
  if (/^\d+$/.test(raw)) return raw;
  const words = raw.split(/\s+/).filter((w) => w !== 'and');
  if (words.length === 0) return null;
  if (words.length === 1 && words[0] === 'a') return null; // "a" alone not a number

  // "hundred" or "one hundred" → 100
  if (words.length === 1 && words[0] === 'hundred') return '100';
  if (words.length === 2 && words[0] === 'one' && words[1] === 'hundred') return '100';

  // X hundred [and] Y (e.g. "two hundred", "two hundred and five", "two hundred and forty two")
  const hundredIdx = words.indexOf('hundred');
  if (hundredIdx >= 0 && words[0] in ONES) {
    const hundreds = ONES[words[0] as keyof typeof ONES];
    if (hundreds >= 1 && hundreds <= 9) {
      let value = hundreds * 100;
      if (hundredIdx + 1 < words.length) {
        const rest = words.slice(hundredIdx + 1).join(' ');
        const restNum = parseSpokenNumber(rest);
        if (restNum !== null) value += parseInt(restNum, 10);
      }
      return String(value);
    }
  }

  // Single word 0–19
  if (words.length === 1 && words[0] in ONES) return String(ONES[words[0] as keyof typeof ONES]);
  // Single word 20, 30, … 90
  if (words.length === 1 && words[0] in TENS) return String(TENS[words[0] as keyof typeof TENS]);
  // "twenty one", "forty two", etc.
  if (words.length === 2) {
    const first = words[0] in TENS ? TENS[words[0] as keyof typeof TENS] : null;
    const second = words[1] in ONES ? ONES[words[1] as keyof typeof ONES] : null;
    if (first !== null && second !== null && second < 10) return String(first + second);
  }
  return null;
}

/** Normalize option text that might be a number to canonical digit string for comparison. */
function optionTextToNumber(optText: string): string | null {
  const norm = optText.trim().toLowerCase();
  if (/^\d+$/.test(norm)) return norm;
  return parseSpokenNumber(norm);
}

/** Extract a number from anywhere in the chunk (e.g. "At twelve." → "12", "I think forty two" → "42"). */
function extractNumberFromChunk(chunk: string): string | null {
  const t = chunk.trim().toLowerCase().replace(/[.,!?]$/, '').replace(/[^\w\s]/g, ' ').trim();
  const words = t.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const single = parseSpokenNumber(words[i]);
    if (single !== null) return single;
    if (i + 1 < words.length) {
      const pair = parseSpokenNumber(`${words[i]} ${words[i + 1]}`);
      if (pair !== null) return pair;
    }
  }
  return null;
}

/** Normalize transcript chunk to detect MC answer. Matches: A/B/C (or 1/2/3), option text (e.g. "Water" or "42"/"forty two"/"at twelve"), and phonetic letter names (e.g. "see"/"say"/"sea" → C, "bee" → B). */
function parseMultipleChoiceAnswer(
  text: string,
  allowedLetters: readonly string[] = LETTERS,
  options?: { letter: string; text: string }[]
): string | null {
  let t = text.trim().toLowerCase().replace(/[.,!?]$/, '');
  if (!t) return null;
  const allowedSet = new Set(allowedLetters.map((l) => l.toUpperCase()));
  const word = t.replace(/[^\w\s]/g, '').trim();

  // 1. Direct option text: chunk equals or contains option text as a whole word (e.g. "Water" or "I think water")
  if (options?.length) {
    for (const opt of options) {
      const optNorm = opt.text.trim().toLowerCase();
      if (!optNorm) continue;
      if (t === optNorm) return opt.letter;
      const wordBoundary = new RegExp(`\\b${optNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundary.test(t)) return opt.letter;
    }
  }

  // 2. Spoken/digit number ↔ option text (e.g. "twelve" or "42" matches option "12" or "42") – not position-based
  if (options?.length) {
    const chunkNum = parseSpokenNumber(t) ?? extractNumberFromChunk(t);
    if (chunkNum !== null) {
      for (const opt of options) {
        const optNum = optionTextToNumber(opt.text);
        if (optNum !== null && chunkNum === optNum) return opt.letter;
        if (chunkNum === opt.text.trim()) return opt.letter;
      }
    }
  }

  // 3. Single letter A/B/C/D or "option A", "letter B", etc.
  const single = t.match(/^([abcd])$/);
  if (single) {
    const letter = single[1].toUpperCase();
    return allowedSet.has(letter) ? letter : null;
  }
  const optionMatch = t.match(/\b(option\s*)?(a|b|c|d)\b/);
  if (optionMatch) {
    const letter = optionMatch[2].toUpperCase();
    return allowedSet.has(letter) ? letter : null;
  }

  // 4. Phonetic match: word sounds like letter name (e.g. "say"/"see"/"sea" → C, "bee" → B)
  const words = word.split(/\s+/).filter(Boolean);
  const candidateWord = words.length === 0 ? '' : words[words.length - 1];
  if (candidateWord) {
    const code = metaphone(candidateWord);
    for (const letter of ['A', 'B', 'C', 'D'] as const) {
      if (allowedSet.has(letter) && code === LETTER_METAPHONE_CODES[letter]) return letter;
    }
  }

  // 5. Option text: number anywhere in chunk (e.g. "at twelve" → 12 matches option "12")
  if (options?.length) {
    const chunkNum = parseSpokenNumber(t) ?? extractNumberFromChunk(t);
    for (const opt of options) {
      const optNorm = opt.text.trim().toLowerCase();
      if (t === optNorm) return opt.letter;
      if (chunkNum !== null) {
        const optNum = optionTextToNumber(opt.text);
        if (optNum !== null && chunkNum === optNum) return opt.letter;
        if (chunkNum === optNorm) return opt.letter;
      }
    }
  }
  return null;
}

export interface QuestionPopUpProps {
  question: Question;
  /** 1-based index for display (e.g. "Question 1", "Question 2"). Optional. */
  questionNumber?: number;
  /** Called when the answer window starts (on mount). Parent can set answerWindowActive = true, clear transcript, etc. */
  onWindowStart?: () => void;
  /** Called when user answers or timeout. Parent should set answerWindowActive = false and save answer. */
  onAnswer: (
    windowStart: number,
    windowEnd: number,
    spokenAnswer: string,
    correct: boolean | null
  ) => void;
  /** Timeout in seconds; after this, onAnswer is called with current transcript (or empty). Default 20. */
  timeoutSeconds?: number;
}

export default function QuestionPopUp({
  question,
  questionNumber,
  onWindowStart,
  onAnswer,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
}: QuestionPopUpProps) {
  const windowStartRef = useRef<number>(Date.now());
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const [answered, setAnswered] = useState(false);
  /** Highlighted MC option when user says A/B/C; advance only on Done or timeout. */
  const [highlightedLetter, setHighlightedLetter] = useState<string | null>(null);
  const { finalTranscript, subscribeToFinalChunk, clearTranscript } = useTranscript();
  const finalTranscriptRef = useRef<string>(finalTranscript);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);

  finalTranscriptRef.current = finalTranscript;

  const endWindow = useCallback(
    (spokenAnswer: string, correct: boolean | null) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      setAnswered(true);
      const windowEnd = Date.now();
      onAnswer(windowStartRef.current, windowEnd, spokenAnswer.trim(), correct);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    },
    [onAnswer, answered]
  );

  // When question changes (or on mount): start/restart timer so second question gets a fresh 20s
  useEffect(() => {
    answeredRef.current = false;
    setAnswered(false);
    windowStartRef.current = Date.now();
    setHighlightedLetter(null);
    clearTranscript();
    onWindowStart?.();

    setSecondsLeft(timeoutSeconds);
    intervalIdRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timeoutIdRef.current = setTimeout(() => {
      timeoutIdRef.current = null;
      endWindow(finalTranscriptRef.current, null);
    }, timeoutSeconds * 1000);

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    };
  }, [question.id, timeoutSeconds]);

  const allowedLetters = question.type === 'multiple_choice' && question.options?.length
    ? question.options.map((o) => o.letter)
    : LETTERS;

  // MC: only highlight the option when user says A/B/C; do NOT auto-advance
  useEffect(() => {
    if (question.type !== 'multiple_choice' || answered) return;

    const unsubscribe = subscribeToFinalChunk((chunk) => {
      const letter = parseMultipleChoiceAnswer(chunk, allowedLetters, question.options ?? undefined);
      if (letter) setHighlightedLetter(letter);
    });

    return unsubscribe;
  }, [question.id, question.type, question.options, subscribeToFinalChunk, answered, allowedLetters]);

  const handleDone = () => {
    if (question.type === 'multiple_choice' && question.options?.length) {
      const letter = highlightedLetter ?? parseMultipleChoiceAnswer(finalTranscript, allowedLetters, question.options);
      if (letter) {
        const correct = letter === question.correct_answer;
        endWindow(letter, correct);
        return;
      }
    }
    endWindow(finalTranscript, null);
  };

  const isMultipleChoice = question.type === 'multiple_choice';
  const options = question.options ?? [];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto animate-fade-in">
      <div className="glass-dark rounded-t-lg px-4 py-3 backdrop-blur-xl border-t border-gray-300/50 border-l border-r border-gray-300/30 shadow-2xl">
        {/* Question row: prefix + full text, separate above answers */}
        <div className="mb-3">
          <p className="text-gray-900 text-sm font-medium break-words" title={question.text}>
            {questionNumber != null && (
              <span className="text-realtalk-blue font-semibold mr-1.5">Question {questionNumber}:</span>
            )}
            {question.text}
          </p>
        </div>
        {/* Answers row: options (or open-ended hint) + timer + Done */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isMultipleChoice && options.length > 0 && (
            <span className="flex flex-1 flex-shrink-0 items-center gap-1.5 text-gray-700 text-xs sm:text-sm flex-wrap min-w-0">
              {options.map((opt, i) => (
                <span
                  key={opt.letter}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors ${
                    highlightedLetter === opt.letter ? 'bg-realtalk-blue/25 ring-1 ring-realtalk-blue/50' : ''
                  }`}
                >
                  {i > 0 && <span className="text-gray-400">·</span>}
                  <span><span className="font-medium text-realtalk-blue">{opt.letter}.</span> {opt.text}</span>
                </span>
              ))}
            </span>
          )}
          {!isMultipleChoice && (
            <span className="text-gray-600 text-xs sm:text-sm flex-shrink-0">Answer in your own words, then Done.</span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <span className="text-realtalk-blue text-sm font-mono tabular-nums" aria-live="polite">
              {secondsLeft}s
            </span>
            <button
              type="button"
              onClick={handleDone}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors cursor-pointer pointer-events-auto"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
