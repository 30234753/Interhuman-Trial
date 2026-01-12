/**
 * API route handler for video analysis
 * Accepts video frames/chunks and forwards them to Interhuman AI API
 * Returns behavioral signal analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createInterhumanClient } from '@/app/lib/interhuman-client';
import { InterhumanAPIResponse } from '@/app/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30; // Maximum execution time in seconds

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.videoData) {
      return NextResponse.json(
        { error: 'Missing required field: videoData' },
        { status: 400 }
      );
    }

    // Extract request parameters
    const { videoData, format, metadata } = body;

    // Validate videoData format
    if (typeof videoData !== 'string') {
      return NextResponse.json(
        { error: 'videoData must be a string (base64 encoded or URL)' },
        { status: 400 }
      );
    }

    // Create Interhuman AI client
    let client;
    try {
      client = createInterhumanClient();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize API client';
      console.error('API client initialization error:', errorMessage);
      
      return NextResponse.json(
        { 
          error: 'API configuration error',
          message: errorMessage,
          details: 'Please check your INTERHUMAN_API_KEY_ID and INTERHUMAN_API_KEY_SECRET environment variables'
        },
        { status: 500 }
      );
    }

    // Call Interhuman AI API
    let analysisResult: InterhumanAPIResponse;
    try {
      analysisResult = await client.analyzeVideo({
        videoData,
        format: format || 'base64',
        metadata: metadata || {},
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      console.error('Interhuman AI API error:', errorMessage);

      // Handle specific error cases
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            error: 'Authentication failed',
            message: 'Invalid API credentials. Please check your INTERHUMAN_API_KEY_ID and INTERHUMAN_API_KEY_SECRET environment variables'
          },
          { status: 401 }
        );
      }

      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.'
          },
          { status: 429 }
        );
      }

      if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        return NextResponse.json(
          { 
            error: 'Network error',
            message: 'Failed to connect to Interhuman AI API. Please check your connection and try again.'
          },
          { status: 503 }
        );
      }

      // Generic API error
      return NextResponse.json(
        { 
          error: 'Analysis failed',
          message: errorMessage
        },
        { status: 502 }
      );
    }

    // Return successful response
    return NextResponse.json(analysisResult, { status: 200 });
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error in analyze route:', errorMessage);

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to analyze video.' },
    { status: 405 }
  );
}

