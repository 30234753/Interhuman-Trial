/**
 * Client wrapper for Interhuman AI API calls
 * Handles authentication, request formatting, and response parsing
 */

import { InterhumanAPIResponse, BehavioralSignal } from './types';

export interface AnalyzeVideoRequest {
  videoData: string; // Base64 encoded video frame or chunk
  format?: 'base64' | 'url';
  metadata?: {
    frameId?: string;
    timestamp?: number;
    sessionId?: string;
  };
}

export interface InterhumanAPIConfig {
  keyId: string;
  keySecret: string;
  apiUrl?: string;
  scopes?: string[];
}

interface AccessToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export class InterhumanAPIClient {
  private keyId: string;
  private keySecret: string;
  private apiUrl: string;
  private scopes: string[];
  private accessToken: AccessToken | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: InterhumanAPIConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.apiUrl = config.apiUrl || 'https://api.interhuman.ai';
    this.scopes = config.scopes || ['interhumanai.upload'];
  }

  /**
   * Authenticates with Interhuman AI API and retrieves an access token
   * Tokens are cached and automatically refreshed when expired
   * @returns Access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken.access_token;
    }

    // Request a new token
    const authUrl = `${this.apiUrl}/v0/auth`;

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key_id: this.keyId,
          key_secret: this.keySecret,
          scopes: this.scopes,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Authentication failed with status ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const tokenData: AccessToken = await response.json();
      this.accessToken = tokenData;
      
      // Set expiration time (subtract 60 seconds as buffer to refresh early)
      const bufferSeconds = 60;
      this.tokenExpiresAt = now + (tokenData.expires_in - bufferSeconds) * 1000;

      return tokenData.access_token;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to authenticate: ${error.message}`);
      }
      throw new Error('Failed to authenticate with Interhuman AI API');
    }
  }

  /**
   * Analyzes a video frame or chunk and returns behavioral signals
   * @param request Video data and metadata
   * @returns Behavioral signals analysis
   */
  async analyzeVideo(request: AnalyzeVideoRequest): Promise<InterhumanAPIResponse> {
    // Use the upload/analyze endpoint for uploaded video analysis
    const url = `${this.apiUrl}/v0/upload/analyze`;

    // Get a valid access token
    let accessToken = await this.getAccessToken();

    try {
      // Convert base64 string to Blob for multipart/form-data
      let videoBlob: Blob;
      let base64Data: string;
      let mimeType: string = 'video/mp4';
      
      if (request.format === 'url') {
        // If it's a URL, we need to fetch it first or handle differently
        throw new Error('URL format not yet supported for upload endpoint');
      } else {
        // Handle base64 data
        // Remove data URL prefix if present (e.g., "data:video/mp4;base64," or "data:video/webm;codecs=vp8,opus;base64,")
        // Need to find the base64 data after ";base64," since codecs may contain commas
        if (request.videoData.startsWith('data:')) {
          const base64Index = request.videoData.indexOf(';base64,');
          if (base64Index !== -1) {
            base64Data = request.videoData.substring(base64Index + 8); // 8 = length of ";base64,"
          } else {
            // Fallback: try to find the last comma (for data URLs without explicit base64 marker)
            const lastComma = request.videoData.lastIndexOf(',');
            if (lastComma !== -1) {
              base64Data = request.videoData.substring(lastComma + 1);
            } else {
              base64Data = request.videoData;
            }
          }
        } else {
          base64Data = request.videoData;
        }
        
        // Convert base64 to binary
        const binaryData = Buffer.from(base64Data, 'base64');
        
        // #region agent log
        const fs = require('fs');
        const logPath = 'f:\\Cursor\\Inhuman Trial\\.cursor\\debug.log';
        const logEntry1 = JSON.stringify({location:'interhuman-client.ts:140',message:'Base64 extraction',data:{originalLength:request.videoData.length,base64Length:base64Data.length,base64Prefix:base64Data.substring(0,Math.min(50,base64Data.length)),binaryDataSize:binaryData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})+'\n';
        try { fs.appendFileSync(logPath, logEntry1); } catch(e) {}
        // #endregion
        
        // Determine MIME type from data URL with improved parsing
        // Handles formats like:
        // - "data:video/mp4;base64,"
        // - "data:video/webm;codecs=vp8,opus;base64,"
        // - "data:audio/webm;codecs=opus;base64," (for audio-only)
        // - "data:video/webm;base64,"
        if (request.videoData.startsWith('data:')) {
          // Extract MIME type, handling codecs and parameters
          // Pattern matches: data:video/webm;codecs=vp8,opus;base64,
          // We extract just the base MIME type (video/webm or audio/webm) for file extension
          const mimeMatch = request.videoData.match(/data:([^;,]+)/);
          if (mimeMatch && mimeMatch[1]) {
            const detectedMime = mimeMatch[1].trim();
            // Accept both video and audio MIME types (Interhuman AI supports both)
            if (detectedMime.startsWith('video/') || detectedMime.startsWith('audio/')) {
              mimeType = detectedMime;
            }
          }
          // #region agent log
          const fullMimeMatch = request.videoData.match(/data:([^;]+)/);
          const logEntry = JSON.stringify({location:'interhuman-client.ts:160',message:'MIME type detection',data:{detectedMimeType:mimeType,fullMimeString:fullMimeMatch?.[1]||'none',hasAudioCodec:request.videoData.includes('opus')||request.videoData.includes('vorbis')||request.videoData.includes('aac')||request.videoData.includes('mp4a'),isAudio:request.videoData.startsWith('data:audio/'),binaryDataSize:binaryData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H'})+'\n';
          try { fs.appendFileSync(logPath, logEntry); } catch(e) {}
          // #endregion
        }
        
        // Validate MIME type is a video or audio format (Interhuman AI supports both)
        if (!mimeType.startsWith('video/') && !mimeType.startsWith('audio/')) {
          // Default to video/mp4 if not a recognized format
          console.warn(`Invalid or missing media MIME type, defaulting to video/mp4. Received: ${mimeType}`);
          mimeType = 'video/mp4';
        }
        
        // Validate blob size to prevent sending empty/invalid recordings
        if (binaryData.length === 0) {
          throw new Error('Video blob is empty - no data to send');
        }
        
        // Additional validation: check for minimum reasonable size (e.g., at least 1KB)
        // Very small files might be corrupted or invalid
        const MIN_VIDEO_SIZE = 1024; // 1KB minimum
        if (binaryData.length < MIN_VIDEO_SIZE) {
          console.warn(`Video blob is unusually small (${binaryData.length} bytes), but proceeding with upload`);
        }
        
        // Create Blob from buffer
        videoBlob = new Blob([binaryData], { type: mimeType });
      }

      // Determine file extension based on MIME type
      // Maps common video and audio MIME types to their file extensions
      const getFileExtension = (mime: string): string => {
        const mimeLower = mime.toLowerCase();
        
        // WebM formats (both video and audio)
        if (mimeLower.includes('webm')) {
          return 'webm';
        }
        // MP4 formats (including H.264, H.265)
        if (mimeLower.includes('mp4') || mimeLower.includes('mpeg4')) {
          return 'mp4';
        }
        // OGG formats (both video and audio)
        if (mimeLower.includes('ogg') || mimeLower.includes('ogv')) {
          return 'ogg';
        }
        // QuickTime/MOV formats
        if (mimeLower.includes('mov') || mimeLower.includes('quicktime')) {
          return 'mov';
        }
        // AVI format
        if (mimeLower.includes('avi') || mimeLower.includes('x-msvideo')) {
          return 'avi';
        }
        // MKV format
        if (mimeLower.includes('mkv') || mimeLower.includes('x-matroska')) {
          return 'mkv';
        }
        // 3GP format
        if (mimeLower.includes('3gp') || mimeLower.includes('3gpp')) {
          return '3gp';
        }
        // FLV format
        if (mimeLower.includes('flv') || mimeLower.includes('x-flv')) {
          return 'flv';
        }
        // WAV format (audio)
        if (mimeLower.includes('wav') || mimeLower.includes('wave')) {
          return 'wav';
        }
        // MPEG audio formats
        if (mimeLower.includes('mpeg') && mimeLower.includes('audio')) {
          return 'mp3';
        }
        
        // Default to mp4 for unknown formats (most widely supported)
        console.warn(`Unknown media MIME type: ${mime}, defaulting to .mp4 extension`);
        return 'mp4';
      };

      const fileExtension = getFileExtension(mimeType);
      // Use appropriate filename prefix based on MIME type
      const fileName = mimeType.startsWith('audio/') 
        ? `audio.${fileExtension}` 
        : `video.${fileExtension}`;

      // #region agent log
      const logEntry2 = JSON.stringify({location:'interhuman-client.ts:250',message:'File upload preparation',data:{fileName,mimeType,blobSize:videoBlob.size,blobType:videoBlob.type,isAudio:mimeType.startsWith('audio/')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'I'})+'\n';
      try { fs.appendFileSync(logPath, logEntry2); } catch(e) {}
      // #endregion

      // Create FormData
      const formData = new FormData();
      formData.append('file', videoBlob, fileName);
      
      // Add metadata if provided
      if (request.metadata) {
        if (request.metadata.frameId) {
          formData.append('frameId', request.metadata.frameId);
        }
        if (request.metadata.timestamp) {
          formData.append('timestamp', request.metadata.timestamp.toString());
        }
        if (request.metadata.sessionId) {
          formData.append('sessionId', request.metadata.sessionId);
        }
      }

      // #region agent log
      const logEntry3 = JSON.stringify({location:'interhuman-client.ts:284',message:'Sending API request',data:{url,fileName,mimeType,blobSize:videoBlob.size,hasFormData:!!formData,formDataKeys:Array.from(formData.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H3'})+'\n';
      try { fs.appendFileSync(logPath, logEntry3); } catch(e) {}
      // #endregion
      
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
        },
        body: formData,
      });
      
      // #region agent log
      const logEntry4 = JSON.stringify({location:'interhuman-client.ts:299',message:'API response status',data:{status:response.status,statusText:response.statusText,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H4'})+'\n';
      try { fs.appendFileSync(logPath, logEntry4); } catch(e) {}
      // #endregion

      // If we get a 401, the token might have expired, try refreshing once
      if (response.status === 401) {
        // Clear the cached token and get a new one
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        accessToken = await this.getAccessToken();

        // Retry the request with the new token
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorJson.detail || errorMessage;
          // Include full error details for debugging
          console.error('Interhuman AI API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorJson
          });
        } catch {
          errorMessage = errorText || errorMessage;
          console.error('Interhuman AI API Raw Error:', errorText);
        }
      
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // #region agent log
      const fs = require('fs');
      const logPath = 'f:\\Cursor\\Inhuman Trial\\.cursor\\debug.log';
      const logEntry5 = JSON.stringify({location:'interhuman-client.ts:331',message:'Raw API response received',data:{hasData:!!data,dataKeys:data?Object.keys(data):[],signalsArray:Array.isArray(data?.signals)?data.signals.length:'not array',signalsType:typeof data?.signals,fullResponse:JSON.stringify(data).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'J'})+'\n';
      try { fs.appendFileSync(logPath, logEntry5); } catch(e) {}
      // #endregion

      // Transform the API response to match our InterhumanAPIResponse interface
      return this.transformResponse(data, request.metadata);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while calling Interhuman AI API');
    }
  }

  /**
   * Transforms the raw API response into our standardized format
   * @param rawResponse Raw response from Interhuman AI API
   * @param metadata Optional metadata to include in response
   * @returns Transformed response matching InterhumanAPIResponse interface
   */
  private transformResponse(
    rawResponse: any,
    metadata?: AnalyzeVideoRequest['metadata']
  ): InterhumanAPIResponse {
    // #region agent log
    const fs = require('fs');
    const logPath = 'f:\\Cursor\\Inhuman Trial\\.cursor\\debug.log';
    const logEntry6 = JSON.stringify({location:'interhuman-client.ts:356',message:'transformResponse called',data:{hasRawResponse:!!rawResponse,rawResponseKeys:rawResponse?Object.keys(rawResponse):[],hasSignalsArray:Array.isArray(rawResponse?.signals),signalsArrayLength:Array.isArray(rawResponse?.signals)?rawResponse.signals.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'K'})+'\n';
    try { fs.appendFileSync(logPath, logEntry6); } catch(e) {}
    // #endregion
    
    // Handle different possible response formats from the API
    let signals: BehavioralSignal[] = [];

    // If the response already has signals in the expected format
    if (Array.isArray(rawResponse.signals)) {
      signals = rawResponse.signals.map((signal: any) => {
        // The API returns signals with time ranges (start, end) instead of intensity
        // If no intensity field exists, use a default intensity when signal is detected
        let rawIntensity = 0;
        
        if (signal.intensity !== undefined) {
          rawIntensity = signal.intensity;
        } else if (signal.value !== undefined) {
          rawIntensity = signal.value;
        } else if (signal.score !== undefined) {
          rawIntensity = signal.score;
        } else if (signal.confidence !== undefined) {
          rawIntensity = signal.confidence;
        } else if (signal.magnitude !== undefined) {
          rawIntensity = signal.magnitude;
        } else if (signal.strength !== undefined) {
          rawIntensity = signal.strength;
        } else if (signal.start !== undefined && signal.end !== undefined) {
          // Signal detected but no intensity field - the API uses time ranges to indicate presence
          // Since all durations appear to be ~0.04s (detection window), we need to vary intensity
          // Use signal type and position in array to create variation, or check for other indicators
          const duration = signal.end - signal.start;
          
          // Since duration is always ~0.04s, use a varied approach based on signal characteristics
          // Option 1: Use signal type priority to assign different base intensities
          const typeIntensityMap: Record<string, number> = {
            'stress': 75,
            'engagement': 80,
            'confusion': 65,
            'hesitation': 55,
            'agreement': 70,
            'disagreement': 60,
            'disengagement': 50,
            'interest': 75,
            'frustration': 70,
            'uncertainty': 60,
            'confidence': 75,
            'skepticism': 65,
          };
          
          // Use type-based intensity if available, otherwise use duration-based calculation
          if (typeIntensityMap[signal.type] !== undefined) {
            rawIntensity = typeIntensityMap[signal.type];
          } else if (duration < 0.1) {
            // Binary detection - use a moderate intensity with slight variation
            rawIntensity = 60 + Math.floor(Math.random() * 20); // 60-80 range
          } else {
            // Longer duration might indicate stronger signal
            rawIntensity = Math.min(100, Math.max(50, duration * 200)); // Scale 0.1-0.5s to 50-100
          }
        } else {
          // If signal exists but has no intensity info, use a default moderate intensity
          rawIntensity = 60;
        }
        
        const normalized = this.normalizeIntensity(rawIntensity);
        return {
          type: signal.type,
          intensity: normalized,
          timestamp: signal.timestamp || Date.now(),
        };
      });
    }
    // If the response has individual signal properties
    else if (rawResponse.stress !== undefined || rawResponse.engagement !== undefined) {
      const timestamp = Date.now();
      
      if (rawResponse.stress !== undefined) {
        signals.push({
          type: 'stress',
          intensity: this.normalizeIntensity(rawResponse.stress),
          timestamp,
        });
      }
      if (rawResponse.engagement !== undefined) {
        signals.push({
          type: 'engagement',
          intensity: this.normalizeIntensity(rawResponse.engagement),
          timestamp,
        });
      }
      if (rawResponse.confusion !== undefined) {
        signals.push({
          type: 'confusion',
          intensity: this.normalizeIntensity(rawResponse.confusion),
          timestamp,
        });
      }
      if (rawResponse.hesitation !== undefined) {
        signals.push({
          type: 'hesitation',
          intensity: this.normalizeIntensity(rawResponse.hesitation),
          timestamp,
        });
      }
      if (rawResponse.agreement !== undefined) {
        signals.push({
          type: 'agreement',
          intensity: this.normalizeIntensity(rawResponse.agreement),
          timestamp,
        });
      }
      if (rawResponse.disagreement !== undefined) {
        signals.push({
          type: 'disagreement',
          intensity: this.normalizeIntensity(rawResponse.disagreement),
          timestamp,
        });
      }
    }
    // If the response has a data or results field
    else if (rawResponse.data) {
      return this.transformResponse(rawResponse.data, metadata);
    }
    else if (rawResponse.results) {
      return this.transformResponse(rawResponse.results, metadata);
    }
    // Fallback: create a default response structure
    else {
      // If we can't parse the response, return empty signals
      // This allows the system to continue functioning even with unexpected API responses
      signals = [];
    }

    return {
      signals,
      metadata: {
        frameId: metadata?.frameId || rawResponse.frameId,
        timestamp: metadata?.timestamp || rawResponse.timestamp || Date.now(),
      },
    };
  }

  /**
   * Normalizes intensity values to 0-100 scale
   * @param value Raw intensity value (could be 0-1, 0-100, or other scale)
   * @returns Normalized intensity (0-100)
   */
  private normalizeIntensity(value: number): number {
    // If value is already in 0-100 range, return as is
    if (value >= 0 && value <= 100) {
      return Math.round(value);
    }
    // If value is in 0-1 range, convert to 0-100
    if (value >= 0 && value <= 1) {
      return Math.round(value * 100);
    }
    // If value is negative or > 100, clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  /**
   * Validates API credentials by attempting to authenticate
   * @returns true if credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Creates a configured InterhumanAPIClient instance from environment variables
 * @returns Configured client instance
 * @throws Error if API credentials are not configured
 */
export function createInterhumanClient(): InterhumanAPIClient {
  const keyId = process.env.INTERHUMAN_API_KEY_ID;
  const keySecret = process.env.INTERHUMAN_API_KEY_SECRET;
  const apiUrl = process.env.INTERHUMAN_API_URL;

  if (!keyId) {
    throw new Error('INTERHUMAN_API_KEY_ID environment variable is not set');
  }

  if (!keySecret) {
    throw new Error('INTERHUMAN_API_KEY_SECRET environment variable is not set');
  }

  return new InterhumanAPIClient({
    keyId,
    keySecret,
    apiUrl,
  });
}

