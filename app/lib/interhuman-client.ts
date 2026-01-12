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
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          video: request.videoData,
          format: request.format || 'base64',
          metadata: request.metadata,
        }),
      });

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
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            video: request.videoData,
            format: request.format || 'base64',
            metadata: request.metadata,
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

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
    // Handle different possible response formats from the API
    let signals: BehavioralSignal[] = [];

    // If the response already has signals in the expected format
    if (Array.isArray(rawResponse.signals)) {
      signals = rawResponse.signals.map((signal: any) => ({
        type: signal.type,
        intensity: this.normalizeIntensity(signal.intensity || signal.value || signal.score || 0),
        timestamp: signal.timestamp || Date.now(),
      }));
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

