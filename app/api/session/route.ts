import { NextRequest, NextResponse } from 'next/server';
import { SessionData, BehavioralSignal, TranscriptChunk } from '@/app/lib/types';
import { createSupabaseClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/session
 * Handles session lifecycle: create, update, addTranscriptChunk, end, get
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId } = body;
    const supabase = createSupabaseClient();

    switch (action) {
      case 'create': {
        // Create a new session in the database
        const startTime = new Date().toISOString();
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            start_time: startTime,
          })
          .select('id, start_time')
          .single();

        if (error) {
          console.error('Error creating session:', error);
          return NextResponse.json(
            { success: false, error: 'Failed to create session' },
            { status: 500 }
          );
        }

        const newSessionId = data.id;
        const sessionData: SessionData = {
          id: newSessionId,
          startTime: new Date(data.start_time).getTime(),
          signals: [],
        };

        return NextResponse.json({
          success: true,
          sessionId: newSessionId,
          sessionData,
        });
      }

      case 'update': {
        // Insert new signals into the database in batches
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        if (!body.signals || !Array.isArray(body.signals) || body.signals.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Signals array is required' },
            { status: 400 }
          );
        }

        // Verify session exists
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('id, start_time')
          .eq('id', sessionId)
          .single();

        if (sessionError || !sessionData) {
          // Session not found - create it (upsert behavior for development)
          const startTime = new Date().toISOString();
          const { error: createError } = await supabase
            .from('sessions')
            .insert({
              id: sessionId,
              start_time: startTime,
            });

          if (createError) {
            console.error('Error creating session during update:', createError);
            return NextResponse.json(
              { success: false, error: 'Session not found and could not be created' },
              { status: 404 }
            );
          }
        }

        // Check for existing signals to prevent duplicates
        // Get min and max timestamps from incoming signals
        const timestamps = body.signals.map((s: BehavioralSignal) => s.timestamp);
        const minTimestamp = Math.min(...timestamps) - 100;
        const maxTimestamp = Math.max(...timestamps) + 100;
        
        // Fetch existing signals in the timestamp range for this session
        const { data: existingSignals } = await supabase
          .from('signals')
          .select('type, timestamp')
          .eq('session_id', sessionId)
          .gte('timestamp', minTimestamp)
          .lte('timestamp', maxTimestamp);
        
        // Create a set of existing signal keys (type-timestamp within 100ms)
        const existingSignalsSet = new Set<string>();
        if (existingSignals) {
          body.signals.forEach((signal: BehavioralSignal) => {
            const exists = existingSignals.some((existing) => 
              existing.type === signal.type &&
              Math.abs(existing.timestamp - signal.timestamp) <= 100
            );
            if (exists) {
              existingSignalsSet.add(`${signal.type}-${signal.timestamp}`);
            }
          });
        }

        // Filter out signals that already exist
        const signalsToInsert = body.signals
          .filter((signal: BehavioralSignal) => {
            const key = `${signal.type}-${signal.timestamp}`;
            return !existingSignalsSet.has(key);
          })
          .map((signal: BehavioralSignal) => ({
            session_id: sessionId,
            type: signal.type,
            intensity: signal.intensity,
            timestamp: signal.timestamp,
          }));

        // #region agent log
        const fs = require('fs');
        const logPath = 'c:\\Users\\adamj\\RealTalkStudio\\Cursor\\Projects\\Inhuman-Trial\\.cursor\\debug.log';
        const logEntry = JSON.stringify({location:'route.ts:94',message:'Inserting signals to database (with deduplication)',data:{originalSignalsCount:body.signals.length,signalsToInsertCount:signalsToInsert.length,filteredOutCount:body.signals.length-signalsToInsert.length,signalsToInsert:signalsToInsert.map((s: {type: string; intensity: number; timestamp: number}) => ({type:s.type,intensity:s.intensity,timestamp:s.timestamp})),sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})+'\n';
        try { fs.appendFileSync(logPath, logEntry); } catch(e) {}
        // #endregion

        // Only insert if there are signals to insert
        if (signalsToInsert.length > 0) {
          const { error: signalsError } = await supabase
            .from('signals')
            .insert(signalsToInsert);
          
          // #region agent log
          const logEntry2 = JSON.stringify({location:'route.ts:103',message:'Database insert result',data:{signalsInsertedCount:signalsToInsert.length,error:signalsError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})+'\n';
          try { fs.appendFileSync(logPath, logEntry2); } catch(e) {}
          // #endregion

          if (signalsError) {
            console.error('Error inserting signals:', signalsError);
            return NextResponse.json(
              { success: false, error: 'Failed to update session with signals' },
              { status: 500 }
            );
          }
        } else {
          // #region agent log
          const logEntry2 = JSON.stringify({location:'route.ts:103',message:'Database insert skipped - all signals already exist',data:{signalsInsertedCount:0,error:null},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})+'\n';
          try { fs.appendFileSync(logPath, logEntry2); } catch(e) {}
          // #endregion
        }

        // Fetch all signals for this session to calculate average stress score
        const { data: allSignals, error: fetchError } = await supabase
          .from('signals')
          .select('type, intensity, timestamp')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: true });
        
        // #region agent log
        const logEntry3 = JSON.stringify({location:'route.ts:118',message:'Fetched all signals from database',data:{allSignalsCount:allSignals?.length||0,allSignals:allSignals?.map(s=>({type:s.type,intensity:s.intensity,timestamp:s.timestamp}))||[],error:fetchError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'G'})+'\n';
        try { fs.appendFileSync(logPath, logEntry3); } catch(e) {}
        // #endregion

        if (fetchError) {
          console.error('Error fetching signals:', fetchError);
          // Still return success since signals were inserted
        }

        const signals: BehavioralSignal[] = allSignals?.map((s) => ({
          type: s.type as BehavioralSignal['type'],
          intensity: s.intensity,
          timestamp: Number(s.timestamp),
        })) || [];

        // Calculate average stress score
        const stressSignals = signals.filter((s) => s.type === 'stress');
        const averageStressScore =
          stressSignals.length > 0
            ? Math.round(
                stressSignals.reduce((sum, s) => sum + s.intensity, 0) / stressSignals.length
              )
            : undefined;

        // Get session start time
        const { data: session } = await supabase
          .from('sessions')
          .select('start_time')
          .eq('id', sessionId)
          .single();

        const sessionResponse: SessionData = {
          id: sessionId,
          startTime: session ? new Date(session.start_time).getTime() : Date.now(),
          signals,
          averageStressScore,
        };

        return NextResponse.json({
          success: true,
          sessionData: sessionResponse,
        });
      }

      case 'addTranscriptChunk': {
        // Insert a new transcript chunk into the database
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        if (!body.text || body.chunkOrder === undefined || !body.timestamp) {
          return NextResponse.json(
            { success: false, error: 'text, chunkOrder, and timestamp are required' },
            { status: 400 }
          );
        }

        // Verify session exists
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !sessionData) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // Insert transcript chunk
        const { error: chunkError } = await supabase.from('transcript_chunks').insert({
          session_id: sessionId,
          text: body.text,
          chunk_order: body.chunkOrder,
          timestamp: body.timestamp,
        });

        if (chunkError) {
          console.error('Error inserting transcript chunk:', chunkError);
          return NextResponse.json(
            { success: false, error: 'Failed to save transcript chunk' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
        });
      }

      case 'end': {
        // Update session with end_time
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const endTime = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ end_time: endTime })
          .eq('id', sessionId);

        if (updateError) {
          console.error('Error ending session:', updateError);
          // Still return success - session might not exist, but client has data
          return NextResponse.json({
            success: true,
            sessionData: {
              id: sessionId,
              startTime: Date.now() - 60000, // Fallback timestamp
              endTime: Date.now(),
              signals: [],
            },
          });
        }

        // Fetch session data with all signals and chunks
        const sessionData = await fetchSessionData(supabase, sessionId);

        return NextResponse.json({
          success: true,
          sessionData,
        });
      }

      case 'get': {
        // Get session data with all associated signals and transcript chunks
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const sessionData = await fetchSessionData(supabase, sessionId);

        if (!sessionData) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          sessionData,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to fetch session data with signals and transcript chunks
 */
async function fetchSessionData(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessionId: string
): Promise<SessionData | null> {
  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, start_time, end_time')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return null;
  }

  // Fetch all signals for this session
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('type, intensity, timestamp')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (signalsError) {
    console.error('Error fetching signals:', signalsError);
  }

  // Fetch all transcript chunks for this session
  const { data: chunks, error: chunksError } = await supabase
    .from('transcript_chunks')
    .select('text, chunk_order, timestamp')
    .eq('session_id', sessionId)
    .order('chunk_order', { ascending: true });

  if (chunksError) {
    console.error('Error fetching transcript chunks:', chunksError);
  }

  // Convert signals to BehavioralSignal format
  const behavioralSignals: BehavioralSignal[] =
    signals?.map((s) => ({
      type: s.type as BehavioralSignal['type'],
      intensity: s.intensity,
      timestamp: Number(s.timestamp),
    })) || [];

  // Calculate average stress score
  const stressSignals = behavioralSignals.filter((s) => s.type === 'stress');
  const averageStressScore =
    stressSignals.length > 0
      ? Math.round(stressSignals.reduce((sum, s) => sum + s.intensity, 0) / stressSignals.length)
      : undefined;

  // Convert chunks to TranscriptChunk format
  const transcriptChunks: TranscriptChunk[] =
    chunks?.map((c) => ({
      text: c.text,
      chunkOrder: c.chunk_order,
      timestamp: Number(c.timestamp),
    })) || [];

  return {
    id: session.id,
    startTime: new Date(session.start_time).getTime(),
    endTime: session.end_time ? new Date(session.end_time).getTime() : undefined,
    signals: behavioralSignals,
    averageStressScore,
    transcriptChunks,
  };
}

/**
 * GET /api/session?sessionId=...
 * Get session data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const sessionData = await fetchSessionData(supabase, sessionId);

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionData,
    });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

