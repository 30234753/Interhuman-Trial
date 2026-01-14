import { NextRequest, NextResponse } from 'next/server';
import { SessionData } from '@/app/lib/types';

export const runtime = 'nodejs';

// In-memory session storage (in production, use a database)
const sessions = new Map<string, SessionData>();

/**
 * POST /api/session
 * Handles session lifecycle: create, update, end
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId } = body;

    switch (action) {
      case 'create': {
        // Create a new session
        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const sessionData: SessionData = {
          id: newSessionId,
          startTime: Date.now(),
          signals: [],
        };

        sessions.set(newSessionId, sessionData);

        return NextResponse.json({
          success: true,
          sessionId: newSessionId,
          sessionData,
        });
      }

      case 'update': {
        // Update an existing session with new signals
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        let session = sessions.get(sessionId);
        if (!session) {
          // Session not found - this can happen in development mode due to hot reloading
          // Since session updates are non-critical (client state is source of truth),
          // create the session if it doesn't exist (upsert behavior)
          session = {
            id: sessionId,
            startTime: Date.now(),
            signals: [],
          };
          sessions.set(sessionId, session);
        }

        // Update session with new signals if provided
        if (body.signals && Array.isArray(body.signals)) {
          session.signals = [...session.signals, ...body.signals];
        }

        // Calculate average stress score if there are stress signals
        const stressSignals = session.signals.filter((s) => s.type === 'stress');
        if (stressSignals.length > 0) {
          const avgStress =
            stressSignals.reduce((sum, s) => sum + s.intensity, 0) / stressSignals.length;
          session.averageStressScore = Math.round(avgStress);
        }

        sessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          sessionData: session,
        });
      }

      case 'end': {
        // End a session
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const session = sessions.get(sessionId);
        
        // If session not found in server storage, still return success
        // The client has all the session data needed for the summary
        // This handles cases where server state was lost (hot reload, stateless API routes)
        if (!session) {
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

        // Mark session as ended
        session.endTime = Date.now();

        // Calculate final average stress score
        const stressSignals = session.signals.filter((s) => s.type === 'stress');
        if (stressSignals.length > 0) {
          const avgStress =
            stressSignals.reduce((sum, s) => sum + s.intensity, 0) / stressSignals.length;
          session.averageStressScore = Math.round(avgStress);
        }

        sessions.set(sessionId, session);

        return NextResponse.json({
          success: true,
          sessionData: session,
        });
      }

      case 'get': {
        // Get session data
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          sessionData: session,
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

    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionData: session,
    });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

