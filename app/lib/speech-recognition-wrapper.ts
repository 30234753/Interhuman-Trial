/**
 * Speech Recognition Wrapper
 * Uses Web Speech API for Chrome/Safari, Vosk for Edge fallback
 */

import { debugLog } from './debug-logger';

export interface SpeechRecognitionConfig {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

export interface SpeechRecognitionCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class SpeechRecognitionWrapper {
  private recognition: any = null;
  private voskRecognizer: any = null;
  private voskModel: any = null; // Store the model to create recognizer with correct sample rate
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private voskAudioStream: MediaStream | null = null; // Separate audio stream for Vosk in Edge
  private processor: ScriptProcessorNode | null = null;
  private isEdge: boolean;
  private useVosk: boolean = false;
  private isInitialized: boolean = false;
  private isStarting: boolean = false;
  private callbacks: SpeechRecognitionCallbacks | null = null;
  private config: SpeechRecognitionConfig;
  private lastProcessedResultIndex: number = -1; // Track which results we've already processed
  private sentFinalSegments: Set<string> = new Set(); // Track individual final segments we've already sent (normalized)
  private cumulativeSentTranscript: string = ''; // Track cumulative transcript we've sent to the user

  constructor(config: SpeechRecognitionConfig = {}) {
    this.config = {
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
      lang: config.lang ?? 'en-US',
    };

    this.isEdge = typeof navigator !== 'undefined' && 
                  navigator.userAgent.includes('Edg/');
    
    // For now, always use Web Speech API
    // Vosk initialization will happen lazily when start() is called for Edge
    // This prevents build-time module resolution issues
    this.initWebSpeech();
  }

  private async loadVoskFromCDN(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).Vosk) {
        debugLog({location:'speech-recognition-wrapper.ts:52',message:'Vosk already loaded from CDN',data:{hasVosk:!!(window as any).Vosk},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
        resolve((window as any).Vosk);
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[data-vosk-browser]');
      if (existingScript) {
        // Wait for it to load
        existingScript.addEventListener('load', () => {
          if ((window as any).Vosk) {
            resolve((window as any).Vosk);
          } else {
            reject(new Error('Vosk failed to load from CDN'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load Vosk script from CDN'));
        });
        return;
      }

      // Try multiple CDNs as fallback (jsdelivr might be blocked by Edge Tracking Prevention)
      const cdnUrls = [
        'https://unpkg.com/vosk-browser@0.0.8/dist/vosk.js',
        'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js',
      ];
      
      let currentCdnIndex = 0;

      const tryLoadFromCDN = (cdnUrl: string) => {
        debugLog({location:'speech-recognition-wrapper.ts:75',message:'Attempting to load Vosk from CDN',data:{cdnUrl,cdnIndex:currentCdnIndex},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});

        const script = document.createElement('script');
        script.src = cdnUrl;
        script.setAttribute('data-vosk-browser', 'true');
        script.async = true;
        script.crossOrigin = 'anonymous'; // Help with CORS and tracking prevention

        script.onload = () => {
          debugLog({location:'speech-recognition-wrapper.ts:85',message:'Vosk script loaded from CDN',data:{hasVosk:!!(window as any).Vosk,voskKeys:(window as any).Vosk ? Object.keys((window as any).Vosk) : [],cdnUrl},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
          if ((window as any).Vosk) {
            resolve((window as any).Vosk);
          } else {
            // Try next CDN if this one didn't work
            if (currentCdnIndex < cdnUrls.length - 1) {
              currentCdnIndex++;
              tryLoadFromCDN(cdnUrls[currentCdnIndex]);
            } else {
              reject(new Error('Vosk object not found after script load from all CDNs'));
            }
          }
        };

        script.onerror = () => {
          debugLog({location:'speech-recognition-wrapper.ts:95',message:'Vosk script load error, trying next CDN',data:{cdnUrl,failedCdnIndex:currentCdnIndex,remainingCdns:cdnUrls.length - currentCdnIndex - 1},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
          // Try next CDN
          if (currentCdnIndex < cdnUrls.length - 1) {
            currentCdnIndex++;
            tryLoadFromCDN(cdnUrls[currentCdnIndex]);
          } else {
            reject(new Error(`Failed to load Vosk script from all CDNs. Last attempted: ${cdnUrl}`));
          }
        };

        document.head.appendChild(script);
      };

      tryLoadFromCDN(cdnUrls[0]);
    });
  }

  private async initVosk(): Promise<void> {
    try {
      // Ensure we're in the browser (client-side only)
      if (typeof window === 'undefined') {
        throw new Error('Vosk can only be initialized in the browser');
      }
      
      debugLog({location:'speech-recognition-wrapper.ts:95',message:'Attempting Vosk import from CDN',data:{isEdge:this.isEdge,userAgent:typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
      
      // Load Vosk from CDN to avoid Next.js build-time resolution issues
      const Vosk = await this.loadVoskFromCDN();
      
      debugLog({location:'speech-recognition-wrapper.ts:100',message:'Vosk loaded from CDN',data:{hasVosk:!!Vosk,voskKeys:Vosk ? Object.keys(Vosk) : []},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
      
      // Vosk-browser uses createModel API (confirmed from logs)
      const createModel = Vosk.createModel;
      
      if (!createModel) {
        debugLog({location:'speech-recognition-wrapper.ts:127',message:'createModel not found in Vosk',data:{voskKeys:Object.keys(Vosk)},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        throw new Error('createModel not found in vosk-browser module');
      }
      
      // Model path - vosk-browser createModel expects a .tar.gz file URL, not a directory
      // The model must be packaged as a tar.gz archive in the public folder
      const modelPath = '/models/vosk-model-small-en-us-0.15.tar.gz';
      
      console.log('Initializing Vosk with model:', modelPath);
      
      debugLog({location:'speech-recognition-wrapper.ts:166',message:'Creating Vosk model with tar.gz path',data:{modelPath,hasCreateModel:typeof createModel === 'function'},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      
      // Create model - this returns a Model object
      // vosk-browser will download and extract the tar.gz file
      let voskModel;
      try {
        voskModel = await createModel(modelPath);
        debugLog({location:'speech-recognition-wrapper.ts:175',message:'Model creation initiated',data:{modelPath},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      } catch (modelError: any) {
        debugLog({location:'speech-recognition-wrapper.ts:179',message:'Model creation failed',data:{error:modelError?.message,errorStack:modelError?.stack?.substring(0,300),modelPath},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        throw new Error(`Failed to load model from ${modelPath}: ${modelError?.message || 'Unknown error'}. Make sure the model.tar.gz file exists in public/models/`);
      }
      
      debugLog({location:'speech-recognition-wrapper.ts:170',message:'Vosk model created',data:{hasModel:!!voskModel,modelType:typeof voskModel,modelKeys:voskModel ? Object.keys(voskModel) : []},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      
      // Vosk Model object has KaldiRecognizer constructor
      // Sample rate must match the audio context sample rate (typically 48000 Hz for modern browsers)
      if (!voskModel) {
        throw new Error('Vosk model is null or undefined');
      }
      
      // Get the audio context sample rate - this will be set when startVosk is called
      // For now, we'll create the recognizer with a default and recreate it with correct rate in startVosk
      // Most modern browsers use 48000 Hz, but we'll detect it dynamically
      const defaultSampleRate = 48000; // Default to 48kHz for modern browsers
      
      debugLog({location:'speech-recognition-wrapper.ts:198',message:'Creating recognizer from model',data:{defaultSampleRate,hasKaldiRecognizer:!!voskModel.KaldiRecognizer,modelKeys:Object.keys(voskModel)},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      
      // Store the model for later use - we'll create the recognizer in startVosk with correct sample rate
      this.voskModel = voskModel;
      
      debugLog({location:'speech-recognition-wrapper.ts:212',message:'Recognizer created',data:{hasRecognizer:!!this.voskRecognizer,recognizerType:typeof this.voskRecognizer,hasAcceptWaveform:typeof this.voskRecognizer?.acceptWaveform === 'function',recognizerKeys:this.voskRecognizer ? Object.keys(this.voskRecognizer) : []},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      
      console.log('Vosk recognizer initialized successfully');
      this.useVosk = true;
      this.isInitialized = true;
      
      debugLog({location:'speech-recognition-wrapper.ts:123',message:'Vosk initialization complete',data:{hasRecognizer:!!this.voskRecognizer,useVosk:this.useVosk,isInitialized:this.isInitialized},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
    } catch (error: any) {
      debugLog({location:'speech-recognition-wrapper.ts:127',message:'Vosk initialization error caught',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500),errorType:typeof error,errorString:String(error)},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
      console.error('Vosk initialization error:', error);
      throw error; // Re-throw so caller can handle fallback
    }
  }

  private initWebSpeech(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition API not available');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.lang;

    this.isInitialized = true;
  }

  async start(stream: MediaStream | null, callbacks: SpeechRecognitionCallbacks): Promise<void> {
    if (this.isStarting) {
      debugLog({location:'speech-recognition-wrapper.ts:100',message:'Recognition already starting, skipping',data:{isStarting:this.isStarting},sessionId:'debug-session',runId:'run1',hypothesisId:'T9'});
      console.warn('Recognition already starting');
      return;
    }

    this.callbacks = callbacks;
    this.mediaStream = stream;
    
    // Only reset result tracking if recognition is not already running
    // This prevents losing track of processed results when start() is called multiple times
    if (!this.recognition || (this.recognition.state !== 'started' && this.recognition.state !== 'starting')) {
      this.lastProcessedResultIndex = -1;
      this.sentFinalSegments.clear(); // Clear the set of sent final segments
      this.cumulativeSentTranscript = ''; // Reset cumulative transcript
    }

    // For Edge, try to initialize Vosk lazily when start() is called
    // This prevents build-time module resolution issues
    if (this.isEdge && !this.useVosk && !this.voskModel) {
      try {
        await this.initVosk();
      } catch (error) {
        console.warn('Vosk initialization failed, using Web Speech API');
      }
    }

    // Check for voskModel (recognizer is created in startVosk)
    if (this.useVosk && this.voskModel) {
      await this.startVosk();
    } else if (this.recognition) {
      this.startWebSpeech();
    } else {
      callbacks.onError('Speech recognition not initialized');
    }
  }

  private startWebSpeech(): void {
    if (!this.recognition) return;

    const state = this.recognition.state || 'unknown';
    if (state === 'started' || state === 'starting') {
      console.warn('Recognition already started');
      return;
    }

    try {
      this.isStarting = true;

      // Set up event handlers
      this.recognition.onstart = () => {
        this.isStarting = false;
        // Don't reset result tracking on start - only reset on stop
        // This prevents reprocessing old results when recognition restarts in continuous mode
        debugLog({location:'speech-recognition-wrapper.ts:140',message:'Recognition started',data:{lastProcessedResultIndex:this.lastProcessedResultIndex,cumulativeSent:this.cumulativeSentTranscript,continuous:this.config.continuous},sessionId:'debug-session',runId:'run1',hypothesisId:'T5'});
        this.callbacks?.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        debugLog({location:'speech-recognition-wrapper.ts:144',message:'onresult event received',data:{totalResults:event.results.length,lastProcessedIndex:this.lastProcessedResultIndex,sentSegmentsCount:this.sentFinalSegments.size,allResults:Array.from(event.results).map((r:any,i:number)=>({index:i,transcript:r[0].transcript.trim(),isFinal:r.isFinal}))},sessionId:'debug-session',runId:'run1',hypothesisId:'T1'});

        let newFinalTranscript = '';
        let latestInterimTranscript = '';

        // Only process NEW results (those after lastProcessedResultIndex)
        for (let i = this.lastProcessedResultIndex + 1; i < event.results.length; i++) {
          const result = event.results[i][0].transcript.trim(); // Trim to remove leading/trailing spaces
          if (!result) continue; // Skip empty results
          
          if (event.results[i].isFinal) {
            // Normalize the result for duplicate detection
            const normalizedResult = result.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // First check: skip if this exact segment was already sent
            if (this.sentFinalSegments.has(normalizedResult)) {
              // Exact duplicate segment, skip it
              this.lastProcessedResultIndex = i;
              debugLog({location:'speech-recognition-wrapper.ts:177',message:'Skipping exact duplicate segment',data:{result,index:i,normalizedResult},sessionId:'debug-session',runId:'run1',hypothesisId:'T13'});
              continue;
            }
            
            // Build cumulative transcript from all final results up to this point
            // But only include segments we haven't seen before
            let cumulativeUpToThis = '';
            for (let j = 0; j <= i; j++) {
              if (event.results[j].isFinal) {
                const segResult = event.results[j][0].transcript.trim();
                if (segResult) {
                  const normalizedSeg = segResult.toLowerCase().replace(/\s+/g, ' ').trim();
                  // Only include in cumulative if we've already sent it or it's the current segment
                  if (this.sentFinalSegments.has(normalizedSeg) || j === i) {
                    cumulativeUpToThis += segResult + ' ';
                  }
                }
              }
            }
            cumulativeUpToThis = cumulativeUpToThis.trim();
            
            // Normalize for comparison
            const normalizedCumulative = cumulativeUpToThis.toLowerCase().replace(/\s+/g, ' ').trim();
            const normalizedSent = this.cumulativeSentTranscript.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // Extract only the new part that extends our cumulative sent transcript
            let newPart = '';
            if (normalizedCumulative.startsWith(normalizedSent)) {
              // This extends what we've already sent
              newPart = cumulativeUpToThis.substring(this.cumulativeSentTranscript.length).trim();
              if (newPart) {
                this.cumulativeSentTranscript = cumulativeUpToThis;
                this.sentFinalSegments.add(normalizedResult); // Mark this segment as sent
                newFinalTranscript += newPart + ' ';
                this.lastProcessedResultIndex = i;
                
                debugLog({location:'speech-recognition-wrapper.ts:200',message:'Extracting new part from cumulative',data:{result,newPart,cumulativeBefore:this.cumulativeSentTranscript.substring(0,Math.max(0,this.cumulativeSentTranscript.length-newPart.length)).trim(),cumulativeAfter:this.cumulativeSentTranscript},sessionId:'debug-session',runId:'run1',hypothesisId:'T11'});
              } else {
                // No new content, skip
                this.lastProcessedResultIndex = i;
                debugLog({location:'speech-recognition-wrapper.ts:210',message:'Skipping - no new content in cumulative',data:{result,index:i,cumulativeSent:this.cumulativeSentTranscript,cumulativeUpToThis},sessionId:'debug-session',runId:'run1',hypothesisId:'T10'});
              }
            } else if (!normalizedSent || !normalizedCumulative.includes(normalizedSent)) {
              // This is a completely new phrase (doesn't extend what we sent)
              // This can happen if recognition restarts or if segments are truly independent
              // Send the entire result as new
              newPart = result;
              this.cumulativeSentTranscript = (this.cumulativeSentTranscript + ' ' + result).trim();
              this.sentFinalSegments.add(normalizedResult); // Mark this segment as sent
              newFinalTranscript += newPart + ' ';
              this.lastProcessedResultIndex = i;
              
              debugLog({location:'speech-recognition-wrapper.ts:225',message:'New independent phrase detected',data:{result,newPart,cumulativeBefore:this.cumulativeSentTranscript.substring(0,Math.max(0,this.cumulativeSentTranscript.length-newPart.length)).trim(),cumulativeAfter:this.cumulativeSentTranscript},sessionId:'debug-session',runId:'run1',hypothesisId:'T12'});
            } else {
              // Overlap case - cumulative contains sent but doesn't start with it
              // This is likely a duplicate or refinement, skip it
              this.lastProcessedResultIndex = i;
              debugLog({location:'speech-recognition-wrapper.ts:235',message:'Skipping duplicate/overlapping final result',data:{result,index:i,cumulativeSent:this.cumulativeSentTranscript,cumulativeUpToThis},sessionId:'debug-session',runId:'run1',hypothesisId:'T10'});
            }
          } else {
            // For interim results, only use the latest one
            latestInterimTranscript = result;
          }
        }

        debugLog({location:'speech-recognition-wrapper.ts:160',message:'Processing results',data:{newFinalText:newFinalTranscript.trim(),interimText:latestInterimTranscript,newLastProcessedIndex:this.lastProcessedResultIndex},sessionId:'debug-session',runId:'run1',hypothesisId:'T2'});

        const finalText = newFinalTranscript.trim();
        const interimText = latestInterimTranscript;

        // Only send if there's new final text that we haven't sent before
        if (finalText) {
          debugLog({location:'speech-recognition-wrapper.ts:168',message:'Sending final result',data:{finalText},sessionId:'debug-session',runId:'run1',hypothesisId:'T3'});
          this.callbacks?.onResult(finalText, true);
        }
        // Always send interim text if present (it's the latest)
        if (interimText) {
          debugLog({location:'speech-recognition-wrapper.ts:175',message:'Sending interim result',data:{interimText},sessionId:'debug-session',runId:'run1',hypothesisId:'T4'});
          this.callbacks?.onResult(interimText, false);
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isStarting = false;
        
        // Handle InvalidStateError gracefully
        if (event.error === 'no-speech' && this.isEdge) {
          // In Edge, "no-speech" is expected due to browser limitations
          console.warn('Edge Speech Recognition: "no-speech" error - this is a known Edge limitation');
        }
        
        // Don't call onError for "no-speech" in Edge as it's expected
        if (!(event.error === 'no-speech' && this.isEdge)) {
          this.callbacks?.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isStarting = false;
        this.callbacks?.onEnd?.();

        // Auto-restart if continuous and callbacks are still set
        if (this.config.continuous && this.callbacks && this.mediaStream?.active) {
          // Don't reset lastProcessedResultIndex on restart - preserve it to avoid reprocessing old results
          // Add delay for Edge
          const delay = this.isEdge ? 500 : 100;
          setTimeout(() => {
            if (this.callbacks && this.mediaStream?.active) {
              this.startWebSpeech();
            }
          }, delay);
        } else {
          // Only reset if we're actually stopping (not restarting)
          this.lastProcessedResultIndex = -1;
        }
      };

      this.recognition.start();
    } catch (error: any) {
      this.isStarting = false;
      if (error.name === 'InvalidStateError' || error.message?.includes('already started')) {
        // Expected in race conditions, ignore
        return;
      }
      this.callbacks?.onError(error.message || 'Failed to start recognition');
    }
  }

  private async startVosk(): Promise<void> {
    // Check for model and stream - recognizer is created below
    if (!this.voskModel || !this.mediaStream) {
      debugLog({location:'speech-recognition-wrapper.ts:477',message:'Vosk start check failed',data:{hasVoskModel:!!this.voskModel,hasMediaStream:!!this.mediaStream,streamActive:this.mediaStream?.active},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      this.callbacks?.onError('Vosk model or media stream not available');
      return;
    }

    try {
      this.isStarting = true;

      // Edge-specific: Try using original stream first (MediaStreamSource created before MediaRecorder)
      // Edge may allow MediaStreamSource to receive audio if created BEFORE MediaRecorder starts
      // This works in Chrome, so it might work in Edge if timing is correct
      debugLog({location:'speech-recognition-wrapper.ts:490',message:'Edge: Using original stream (MediaStreamSource before MediaRecorder)',data:{isEdge:this.isEdge,hasSeparateStream:!!this.voskAudioStream},sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});

      // Set up audio context for processing
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const audioTracks = this.mediaStream.getAudioTracks();
      debugLog({location:'speech-recognition-wrapper.ts:487',message:'Setting up audio context',data:{audioContextSampleRate:this.audioContext.sampleRate,audioContextState:this.audioContext.state,streamActive:this.mediaStream.active,audioTrackCount:audioTracks.length,audioTracks:audioTracks.map(t=>({id:t.id,enabled:t.enabled,muted:t.muted,readyState:t.readyState,label:t.label}))},sessionId:'debug-session',runId:'run1',hypothesisId:'H2'});
      
      // Resume audio context if suspended (required in some browsers after user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        debugLog({location:'speech-recognition-wrapper.ts:493',message:'AudioContext resumed',data:{newState:this.audioContext.state},sessionId:'debug-session',runId:'run1',hypothesisId:'H2'});
      }
      
      // Get audio track - MediaStream tracks can be consumed by multiple sources
      const audioTrack = audioTracks[0];
      if (!audioTrack) {
        throw new Error('No audio track available in media stream');
      }
      
      // Create script processor for audio processing (deprecated but needed for Vosk)
      // Note: AudioWorklet would be better but requires more setup
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      debugLog({location:'speech-recognition-wrapper.ts:496',message:'ScriptProcessor created',data:{bufferSize,hasProcessor:!!this.processor},sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
      
      // Set up audio processing handler BEFORE connecting
      // Process audio data
      // Only log every 10th buffer to reduce log spam, but always process audio
      let bufferCount = 0;
      this.processor.onaudioprocess = (event) => {
        if (!this.voskRecognizer) return;
        
        bufferCount++;
        const inputData = event.inputBuffer.getChannelData(0);
        const audioLevel = Math.sqrt(inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length);
        const maxAmplitude = Math.max(...Array.from(inputData).map(Math.abs));
        const hasAudio = audioLevel > 0.001;
        
        // Log every 10th buffer, or whenever audio is detected
        if (bufferCount % 10 === 0 || hasAudio) {
          debugLog({location:'speech-recognition-wrapper.ts:536',message:'Audio processing',data:{hasRecognizer:!!this.voskRecognizer,audioLevel:audioLevel,maxAmplitude:maxAmplitude,bufferLength:inputData.length,sampleRate:event.inputBuffer.sampleRate,hasAudio:hasAudio,bufferCount},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        }
        
        // acceptWaveform expects an AudioBuffer, not Int16Array
        // Pass the inputBuffer directly
        try {
          this.voskRecognizer.acceptWaveform(event.inputBuffer);
        } catch (e) {
          console.error('Vosk waveform error:', e);
        }
      };
      
      // Edge-specific: Ensure audio track is explicitly enabled
      // Edge may require explicit track enabling for MediaStreamSource to receive audio
      // Explicitly enable the audio track for Edge
      if (this.isEdge && !audioTrack.enabled) {
        audioTrack.enabled = true;
      }
      
      debugLog({location:'speech-recognition-wrapper.ts:550',message:'Creating MediaStreamSource',data:{isEdge:this.isEdge,audioTrackId:audioTrack.id,audioTrackEnabled:audioTrack.enabled,audioTrackMuted:audioTrack.muted,audioTrackReadyState:audioTrack.readyState,streamActive:this.mediaStream.active,streamId:this.mediaStream.id},sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
      
      // Use separate audio stream for Edge if available, or original stream
      // For Edge, we try original stream first (created before MediaRecorder)
      const streamForVosk = (this.isEdge && this.voskAudioStream) ? this.voskAudioStream : this.mediaStream;
      const streamTracks = streamForVosk.getAudioTracks();
      
      debugLog({location:'speech-recognition-wrapper.ts:578',message:'Stream selection for Vosk',data:{usingSeparateStream:!!this.voskAudioStream,streamId:streamForVosk.id,streamActive:streamForVosk.active,audioTrackCount:streamTracks.length,audioTracks:streamTracks.map(t=>({id:t.id,enabled:t.enabled,muted:t.muted,readyState:t.readyState,label:t.label}))},sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
      
      const source = this.audioContext.createMediaStreamSource(streamForVosk);
      
      debugLog({location:'speech-recognition-wrapper.ts:590',message:'MediaStreamSource created',data:{hasSource:!!source,sourceType:source?.constructor?.name,audioContextState:this.audioContext.state,usingStreamId:streamForVosk.id},sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
      
      // Create recognizer with the correct sample rate matching the audio context
      const sampleRate = this.audioContext.sampleRate;
      
      debugLog({location:'speech-recognition-wrapper.ts:490',message:'Creating recognizer with audio context sample rate',data:{sampleRate,hasVoskModel:!!this.voskModel},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
      
      if (this.voskModel && this.voskModel.KaldiRecognizer && typeof this.voskModel.KaldiRecognizer === 'function') {
        this.voskRecognizer = new this.voskModel.KaldiRecognizer(sampleRate);
      } else {
        throw new Error('Vosk model or KaldiRecognizer not available');
      }
      
      // Set up Vosk recognizer event handlers
      // The event handlers receive a message object with result.text or result.partial, not a string
      this.voskRecognizer.on('result', (message: any) => {
        debugLog({location:'speech-recognition-wrapper.ts:500',message:'Vosk result event received',data:{messageType:typeof message,hasResult:!!message?.result,resultText:message?.result?.text,resultKeys:message ? Object.keys(message) : []},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        const text = message?.result?.text || message?.text || message;
        if (text && typeof text === 'string' && text.trim()) {
          // Vosk provides final results
          this.callbacks?.onResult(text.trim(), true);
        }
      });

      this.voskRecognizer.on('partialresult', (message: any) => {
        debugLog({location:'speech-recognition-wrapper.ts:510',message:'Vosk partialresult event received',data:{messageType:typeof message,hasResult:!!message?.result,resultPartial:message?.result?.partial,resultKeys:message ? Object.keys(message) : []},sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        const text = message?.result?.partial || message?.partial || message?.text || message;
        if (text && typeof text === 'string' && text.trim()) {
          // Vosk provides interim results
          this.callbacks?.onResult(text.trim(), false);
        }
      });

      // Connect audio processing chain
      // ScriptProcessorNode MUST be connected to destination to process audio
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      debugLog({location:'speech-recognition-wrapper.ts:625',message:'Audio chain connected',data:{hasSource:!!source,hasProcessor:!!this.processor,audioContextState:this.audioContext.state,isEdge:this.isEdge},sessionId:'debug-session',runId:'run1',hypothesisId:'H8'});
      
      // Edge-specific: The fundamental issue is that Edge's MediaStreamSource doesn't receive audio
      // when MediaRecorder is using the same stream. This appears to be a browser limitation.
      // All attempts (separate stream, timing, GainNode) have failed.
      // The audio levels remain consistently low (~0.00003) indicating no actual audio signal.

      this.isStarting = false;
      this.callbacks?.onStart?.();
      
      console.log('Vosk recognition started');
    } catch (error: any) {
      this.isStarting = false;
      console.error('Failed to start Vosk recognition:', error);
      this.callbacks?.onError(error.message || 'Failed to start Vosk recognition');
    }
  }

  stop(): void {
    this.isStarting = false;
    // Reset result tracking when stopping (not restarting)
    this.lastProcessedResultIndex = -1;
    this.sentFinalSegments.clear();
    this.cumulativeSentTranscript = '';

    if (this.useVosk && this.voskRecognizer) {
      this.stopVosk();
    } else if (this.recognition) {
      try {
        if (this.recognition.state === 'started' || this.recognition.state === 'starting') {
          this.recognition.stop();
        }
      } catch (error) {
        // Ignore errors when stopping
      }
    }

    // Clean up audio processing if used
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private stopVosk(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    // Clean up separate audio stream for Edge
    if (this.voskAudioStream) {
      this.voskAudioStream.getTracks().forEach(track => track.stop());
      this.voskAudioStream = null;
    }
    // Vosk recognizer doesn't have a stop method, just disconnect audio
    console.log('Vosk recognition stopped');
  }

  isReady(): boolean {
    return this.isInitialized && (this.recognition !== null || this.voskRecognizer !== null);
  }

  getRecognitionType(): 'web-speech' | 'vosk' | 'none' {
    if (this.useVosk && this.voskRecognizer) return 'vosk';
    if (this.recognition) return 'web-speech';
    return 'none';
  }
}

