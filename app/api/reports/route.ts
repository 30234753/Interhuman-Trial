import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/reports
 * Update rating and feedback for a session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, rating, feedback } = body;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

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

    // Update session with rating and feedback
    const updateData: { rating?: number | null; feedback?: string | null } = {};
    
    // Only update rating/feedback if provided
    if (rating !== undefined) {
      updateData.rating = rating === null || rating === '' ? null : Number(rating);
      // Validate rating is between 1-5 if provided
      if (updateData.rating !== null && (updateData.rating < 1 || updateData.rating > 5)) {
        return NextResponse.json(
          { success: false, error: 'Rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    }
    
    if (feedback !== undefined) {
      updateData.feedback = feedback === null || feedback === '' ? null : String(feedback).trim();
    }
    
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select('id, start_time, end_time, created_at, rating, feedback')
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update session rating/feedback' },
        { status: 500 }
      );
    }

    if (!updatedSession) {
      return NextResponse.json(
        { success: false, error: 'Failed to update session: no data returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        session_id: updatedSession.id,
        created_at: updatedSession.created_at,
        rating: updatedSession.rating ?? null,
        feedback: updatedSession.feedback ?? null,
      },
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports
 * List all sessions (as reports), or fetch a single session by sessionId
 * Query params: sessionId (optional) - if provided, returns single session for that sessionId
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Fetch single session by sessionId
      const { data: sessionData, error: fetchError } = await supabase
        .from('sessions')
        .select('id, start_time, end_time, created_at, rating, feedback')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        // If no session found, return null (not an error)
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json({
            success: true,
            report: null,
          });
        }
        
        console.error('Error fetching session:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch session' },
          { status: 500 }
        );
      }

      if (!sessionData) {
        return NextResponse.json({
          success: true,
          report: null,
        });
      }

      return NextResponse.json({
        success: true,
        report: {
          id: sessionData.id,
          session_id: sessionData.id,
          created_at: sessionData.created_at,
          rating: sessionData.rating ?? null,
          feedback: sessionData.feedback ?? null,
        },
      });
    } else {
      // Fetch all sessions ordered by created_at descending
      const { data: sessionsData, error: fetchError } = await supabase
        .from('sessions')
        .select('id, start_time, end_time, created_at, rating, feedback')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching sessions:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch sessions' },
          { status: 500 }
        );
      }

      const reports = sessionsData?.map((s) => ({
        id: s.id,
        session_id: s.id,
        created_at: s.created_at,
        rating: s.rating ?? null,
        feedback: s.feedback ?? null,
      })) || [];

      return NextResponse.json({
        success: true,
        reports,
      });
    }
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
