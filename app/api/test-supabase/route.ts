import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/test-supabase
 * Test endpoint to verify Supabase client initialization
 */
export async function GET(request: NextRequest) {
  try {
    // Test 1: Check if environment variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const envVarsSet = {
      supabaseUrl: !!supabaseUrl,
      supabaseAnonKey: !!supabaseAnonKey,
      supabaseUrlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : null,
    };

    // Test 2: Try to create the Supabase client
    try {
      const client = createSupabaseClient();
      const clientType = typeof client;
      
      // Verify it's a SupabaseClient by checking for expected properties
      const hasExpectedProperties = 
        typeof client.from === 'function' &&
        typeof client.auth === 'object' &&
        typeof client.rpc === 'function';
      
      // Test 3: Try to query the database tables (if they exist)
      const tableTests: Record<string, { exists: boolean; error?: string }> = {};
      const tablesToTest = ['sessions', 'signals', 'transcript_chunks'];
      
      for (const tableName of tablesToTest) {
        try {
          const { error } = await client.from(tableName).select('*').limit(0);
          tableTests[tableName] = {
            exists: !error || error.code !== 'PGRST116', // PGRST116 = table doesn't exist
            error: error ? error.message : undefined,
          };
        } catch (err) {
          tableTests[tableName] = {
            exists: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Supabase client created successfully',
        tests: {
          environmentVariables: envVarsSet,
          clientCreation: {
            success: true,
            clientType,
            hasExpectedProperties,
          },
          databaseTables: tableTests,
        },
      });
    } catch (error) {
      const clientError = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create Supabase client',
          tests: {
            environmentVariables: envVarsSet,
            clientCreation: {
              success: false,
              error: clientError,
            },
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Test API error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}