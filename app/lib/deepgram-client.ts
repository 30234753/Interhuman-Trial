/**
 * Deepgram client utility for managing live transcription connections
 * Handles connection lifecycle, audio streaming, and transcript events
 */

import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';

export interface TranscriptEvent {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface DeepgramConnectionConfig {
  model?: string;
  language?: string;
  smartFormat?: boolean;
  interimResults?: boolean;
  endpointing?: number;
  utteranceEndMs?: number;
  vadEvents?: boolean;
}

export interface DeepgramConnection {
  connection: LiveClient;
  sessionId: string;
  isConnected: boolean;
  onTranscript?: (event: TranscriptEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

/**
 * Deepgram client utility class
 * Manages multiple concurrent live transcription sessions
 */
export class DeepgramClient {
  private apiKey: string;
  private connections: Map<string, DeepgramConnection> = new Map();
  private defaultConfig: DeepgramConnectionConfig;

  constructor(apiKey: string, defaultConfig?: DeepgramConnectionConfig) {
    if (!apiKey) {
      throw new Error('Deepgram API key is required');
    }
    this.apiKey = apiKey;
    this.defaultConfig = {
      model: 'nova-3',
      language: 'en-US',
      smartFormat: true,
      interimResults: true,
      ...defaultConfig,
    };
  }

  /**
   * Create a new Deepgram live transcription connection
   * @param sessionId Unique identifier for this transcription session
   * @param config Optional configuration to override defaults
   * @param callbacks Optional callbacks for transcript events, errors, and connection close
   * @returns The created connection
   */
  createConnection(
    sessionId: string,
    config?: DeepgramConnectionConfig,
    callbacks?: {
      onTranscript?: (event: TranscriptEvent) => void;
      onError?: (error: Error) => void;
      onClose?: () => void;
    }
  ): DeepgramConnection {
    // Check if connection already exists
    if (this.connections.has(sessionId)) {
      throw new Error(`Connection with session ID "${sessionId}" already exists`);
    }

    // Create Deepgram client
    const deepgram = createClient(this.apiKey);

    // Merge config with defaults
    const connectionConfig = {
      ...this.defaultConfig,
      ...config,
    };

    // Create live connection
    const connection = deepgram.listen.live(connectionConfig);

    // Create connection object
    const deepgramConnection: DeepgramConnection = {
      connection,
      sessionId,
      isConnected: false,
      onTranscript: callbacks?.onTranscript,
      onError: callbacks?.onError,
      onClose: callbacks?.onClose,
    };

    // Set up event handlers
    connection.on(LiveTranscriptionEvents.Open, () => {
      deepgramConnection.isConnected = true;
      console.log(`[Deepgram] Connection opened for session: ${sessionId}`);
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      try {
        // Parse transcript data
        const transcriptEvent: TranscriptEvent = {
          transcript: data.channel?.alternatives?.[0]?.transcript || '',
          isFinal: data.is_final || false,
          confidence: data.channel?.alternatives?.[0]?.confidence,
          words: data.channel?.alternatives?.[0]?.words?.map((word: any) => ({
            word: word.word || '',
            start: word.start || 0,
            end: word.end || 0,
            confidence: word.confidence || 0,
          })),
        };

        // Only emit if there's actual transcript text
        if (transcriptEvent.transcript && deepgramConnection.onTranscript) {
          deepgramConnection.onTranscript(transcriptEvent);
        }
      } catch (error) {
        console.error('[Deepgram] Error parsing transcript:', error);
        if (deepgramConnection.onError) {
          deepgramConnection.onError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      console.error(`[Deepgram] Error for session ${sessionId}:`, error);
      deepgramConnection.isConnected = false;
      
      const errorObj = error instanceof Error 
        ? error 
        : new Error(error?.message || 'Unknown Deepgram error');
      
      if (deepgramConnection.onError) {
        deepgramConnection.onError(errorObj);
      }
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[Deepgram] Connection closed for session: ${sessionId}`);
      deepgramConnection.isConnected = false;
      
      // Remove from connections map
      this.connections.delete(sessionId);
      
      if (deepgramConnection.onClose) {
        deepgramConnection.onClose();
      }
    });

    connection.on(LiveTranscriptionEvents.Metadata, (metadata: any) => {
      console.debug(`[Deepgram] Metadata for session ${sessionId}:`, metadata);
    });

    // Store connection
    this.connections.set(sessionId, deepgramConnection);

    return deepgramConnection;
  }

  /**
   * Send audio data to a Deepgram connection
   * @param sessionId Session ID of the connection
   * @param audioData Audio data as ArrayBuffer or Buffer
   * @returns true if sent successfully, false if connection not found
   */
  sendAudio(sessionId: string, audioData: ArrayBuffer | Buffer): boolean {
    const connection = this.connections.get(sessionId);
    
    if (!connection) {
      console.warn(`[Deepgram] Connection not found for session: ${sessionId}`);
      return false;
    }

    if (!connection.isConnected) {
      console.warn(`[Deepgram] Connection not ready for session: ${sessionId}`);
      return false;
    }

    try {
      connection.connection.send(audioData);
      return true;
    } catch (error) {
      console.error(`[Deepgram] Error sending audio for session ${sessionId}:`, error);
      if (connection.onError) {
        connection.onError(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      return false;
    }
  }

  /**
   * Close a specific Deepgram connection
   * @param sessionId Session ID of the connection to close
   * @returns true if closed successfully, false if connection not found
   */
  closeConnection(sessionId: string): boolean {
    const connection = this.connections.get(sessionId);
    
    if (!connection) {
      console.warn(`[Deepgram] Connection not found for session: ${sessionId}`);
      return false;
    }

    try {
      connection.connection.finish();
      // Connection will be removed from map in the Close event handler
      return true;
    } catch (error) {
      console.error(`[Deepgram] Error closing connection for session ${sessionId}:`, error);
      // Force remove from map if close fails
      this.connections.delete(sessionId);
      return false;
    }
  }

  /**
   * Get connection status for a session
   * @param sessionId Session ID to check
   * @returns Connection status or null if not found
   */
  getConnectionStatus(sessionId: string): { isConnected: boolean; exists: boolean } | null {
    const connection = this.connections.get(sessionId);
    
    if (!connection) {
      return null;
    }

    return {
      isConnected: connection.isConnected,
      exists: true,
    };
  }

  /**
   * Close all active connections
   */
  closeAllConnections(): void {
    const sessionIds = Array.from(this.connections.keys());
    console.log(`[Deepgram] Closing ${sessionIds.length} active connection(s)`);
    
    for (const sessionId of sessionIds) {
      this.closeConnection(sessionId);
    }
  }

  /**
   * Get the number of active connections
   * @returns Number of active connections
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists
   * @param sessionId Session ID to check
   * @returns true if connection exists
   */
  hasConnection(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }
}

/**
 * Factory function to create a DeepgramClient instance
 * Reads API key from environment variable
 * @param config Optional default configuration
 * @returns DeepgramClient instance
 */
export function createDeepgramClient(
  config?: DeepgramConnectionConfig
): DeepgramClient {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'DEEPGRAM_API_KEY environment variable is not set. ' +
      'Please set it in your .env file.'
    );
  }

  return new DeepgramClient(apiKey, config);
}
