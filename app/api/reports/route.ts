import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';
import { Report } from '@/app/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/reports
 * Create or update a saved report (upsert - one report per session)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sessionId } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report name is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate name length (reasonable limit)
    if (name.trim().length > 255) {
      return NextResponse.json(
        { success: false, error: 'Report name must be 255 characters or less' },
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

    // Check if report already exists for this session
    const { data: existingReport, error: fetchError } = await supabase
      .from('reports')
      .select('id, name, session_id, created_at')
      .eq('session_id', sessionId)
      .single();

    let reportData;
    let operationError;

    if (existingReport) {
      // Update existing report
      const { data: updatedData, error: updateError } = await supabase
        .from('reports')
        .update({
          name: name.trim(),
        })
        .eq('id', existingReport.id)
        .select('id, name, session_id, created_at')
        .single();

      reportData = updatedData;
      operationError = updateError;
    } else {
      // Insert new report record
      const { data: insertedData, error: insertError } = await supabase
        .from('reports')
        .insert({
          name: name.trim(),
          session_id: sessionId,
        })
        .select('id, name, session_id, created_at')
        .single();

      reportData = insertedData;
      operationError = insertError;
    }

    if (operationError) {
      console.error('Error saving report:', operationError);
      
      // Check if the error is due to missing table (migration not run)
      if (operationError.code === 'PGRST205' || operationError.message?.includes("Could not find the table 'public.reports'")) {
        return NextResponse.json(
          { success: false, error: 'Reports table not found. Please run the database migration (supabase-reports-migration.sql) in your Supabase SQL Editor.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to save report' },
        { status: 500 }
      );
    }

    const report: Report = {
      id: reportData.id,
      name: reportData.name,
      session_id: reportData.session_id,
      created_at: reportData.created_at,
    };

    return NextResponse.json({
      success: true,
      report,
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
 * List all saved reports, or fetch a single report by sessionId
 * Query params: sessionId (optional) - if provided, returns single report for that session
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Fetch single report by sessionId
      const { data: reportData, error: fetchError } = await supabase
        .from('reports')
        .select('id, name, session_id, created_at')
        .eq('session_id', sessionId)
        .single();

      if (fetchError) {
        // If no report found, return null (not an error)
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json({
            success: true,
            report: null,
          });
        }
        console.error('Error fetching report:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch report' },
          { status: 500 }
        );
      }

      const report: Report = {
        id: reportData.id,
        name: reportData.name,
        session_id: reportData.session_id,
        created_at: reportData.created_at,
      };

      return NextResponse.json({
        success: true,
        report,
      });
    } else {
      // Fetch all reports ordered by created_at descending
      const { data: reportsData, error: fetchError } = await supabase
        .from('reports')
        .select('id, name, session_id, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching reports:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch reports' },
          { status: 500 }
        );
      }

      const reports: Report[] =
        reportsData?.map((r) => ({
          id: r.id,
          name: r.name,
          session_id: r.session_id,
          created_at: r.created_at,
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
