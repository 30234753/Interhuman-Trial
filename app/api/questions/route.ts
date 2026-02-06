import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';
import type { Question } from '@/app/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/questions
 * Returns questions from Supabase. Optional query params:
 * - category: filter by category (e.g. maths, pub_quiz, open_ended)
 * - ids: comma-separated question UUIDs (e.g. ids=uuid1,uuid2,uuid3)
 * - No params: return all questions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const idsParam = searchParams.get('ids');

    const supabase = createSupabaseClient();

    let query = supabase.from('questions').select('id, type, category, text, options, correct_answer, created_at, updated_at');

    if (category) {
      query = query.eq('category', category);
    }

    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        query = query.in('id', ids);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching questions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    const questions: Question[] = (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      text: row.text,
      options: row.options ?? null,
      correct_answer: row.correct_answer ?? null,
      ...(row.created_at && { created_at: row.created_at }),
      ...(row.updated_at && { updated_at: row.updated_at }),
    }));

    return NextResponse.json(questions);
  } catch (err) {
    console.error('GET /api/questions error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}
