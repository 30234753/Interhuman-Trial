# Deepgram Integration Test Plan

This document outlines the testing procedure for the Deepgram server-side transcription integration.

## Prerequisites

1. **Environment Setup**
   - Ensure `.env.local` file exists with `DEEPGRAM_API_KEY` set
   - Verify the API key is valid and has sufficient credits
   - Install dependencies: `npm install`

2. **Development Server**
   - Start the dev server: `npm run dev`
   - Verify the server starts without errors
   - Check that all API routes are accessible

## Test Checklist

### 1. Audio Capture Test

**Objective**: Verify that audio is being captured from the microphone stream.

**Steps**:
1. Open the application in a browser (http://localhost:3000)
2. Click "Start Camera" button
3. Grant microphone permissions when prompted
4. Verify the camera and microphone are active (video should be visible)
5. Open browser DevTools Console (F12)
6. Look for console logs:
   - `[Subtitles] Starting transcription session...`
   - `[Subtitles] MediaRecorder started`
   - No errors related to MediaRecorder or audio capture

**Expected Results**:
- ✅ Microphone permission granted
- ✅ MediaRecorder initializes successfully
- ✅ Audio tracks are present in the stream
- ✅ No errors in console related to audio capture

**Failure Indicators**:
- ❌ "MediaRecorder is not supported" error
- ❌ "No audio tracks found in stream" error
- ❌ Permission denied errors

---

### 2. Server Transcription Test

**Objective**: Verify that audio chunks are sent to the server and Deepgram processes them.

**Steps**:
1. With the application running and camera/mic active
2. Speak clearly into the microphone (e.g., "Hello, this is a test")
3. Check browser DevTools Network tab:
   - Look for POST requests to `/api/transcribe` with `action: 'start'`
   - Look for POST requests to `/api/transcribe` with `action: 'audio'`
   - Verify requests are being sent regularly (every ~1 second)
4. Check server console/terminal:
   - Look for logs: `[Transcribe API] Started transcription session: <sessionId>`
   - Look for logs: `[Deepgram] Connection opened for session: <sessionId>`
   - Verify no Deepgram API errors

**Expected Results**:
- ✅ POST `/api/transcribe` with `action: 'start'` returns 200 with SSE stream
- ✅ POST `/api/transcribe` with `action: 'audio'` returns 200 with success message
- ✅ Server logs show Deepgram connection established
- ✅ Audio chunks are being sent regularly (every 1-2 seconds)

**Failure Indicators**:
- ❌ 400/500 errors from `/api/transcribe` endpoint
- ❌ "DEEPGRAM_API_KEY environment variable is not set" error
- ❌ Deepgram authentication errors
- ❌ No audio chunk requests in Network tab

---

### 3. Real-Time Transcript Display Test

**Objective**: Verify that transcripts are received from Deepgram and displayed in real-time.

**Steps**:
1. With the application running and transcription active
2. Speak clearly into the microphone
3. Observe the subtitles area at the bottom of the video player
4. Check for:
   - Interim transcripts (should appear in italic/orange text)
   - Final transcripts (should appear in normal white text)
   - "LIVE" indicator showing when transcription is active
   - Listening indicator when no speech is detected
5. Check browser DevTools Console:
   - Look for SSE stream messages being received
   - Verify transcript events are being parsed correctly
6. Check browser DevTools Network tab:
   - Verify SSE stream is active (EventStream type)
   - Check that transcript data is being received

**Expected Results**:
- ✅ Subtitles appear at the bottom of the video player
- ✅ Interim transcripts appear in italic/orange as you speak
- ✅ Final transcripts appear in normal text after a pause
- ✅ "LIVE" indicator shows when transcription is active
- ✅ Transcripts update in real-time (low latency)
- ✅ No errors in console related to SSE parsing

**Failure Indicators**:
- ❌ No subtitles appear at all
- ❌ "Failed to connect to transcription service" error
- ❌ SSE stream errors in console
- ❌ Transcripts don't update or are delayed significantly
- ❌ "Transcription error" message displayed

---

### 4. Error Handling Test

**Objective**: Verify that errors are handled gracefully.

**Test Cases**:

#### 4.1 Missing API Key
1. Temporarily remove or invalidate `DEEPGRAM_API_KEY` in `.env.local`
2. Restart the dev server
3. Start a transcription session
4. **Expected**: Error message displayed to user, no crashes

#### 4.2 Network Interruption
1. Start transcription
2. Disconnect network (or block `/api/transcribe` in DevTools)
3. **Expected**: Reconnection attempts, error message after max attempts

#### 4.3 Microphone Permission Denied
1. Deny microphone permission when prompted
2. **Expected**: Clear error message, graceful degradation

#### 4.4 Session Cleanup
1. Start transcription
2. Stop the camera/stream
3. **Expected**: Transcription session stops, no memory leaks

---

### 5. Integration Flow Test

**Objective**: Verify the complete end-to-end flow works correctly.

**Steps**:
1. Start the application
2. Start camera (triggers audio capture)
3. Speak continuously for 30 seconds
4. Observe:
   - Audio is captured
   - Transcripts appear in real-time
   - Interim and final transcripts work correctly
   - No performance degradation
5. Stop camera
6. Verify cleanup (no errors, sessions closed)

**Expected Results**:
- ✅ Complete flow works without errors
- ✅ Transcripts are accurate
- ✅ Low latency (< 2 seconds from speech to display)
- ✅ No memory leaks or performance issues
- ✅ Clean shutdown when stopping

---

## Manual Testing Script

Run through this script to verify all components:

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:3000

# 3. In browser console, monitor for:
#    - [Subtitles] logs
#    - [Deepgram] logs (if visible)
#    - Network requests to /api/transcribe

# 4. Test sequence:
#    a. Click "Start Camera"
#    b. Grant permissions
#    c. Speak: "Hello, this is a test of the transcription system"
#    d. Wait 5 seconds
#    e. Speak: "Can you hear me clearly?"
#    f. Wait 5 seconds
#    g. Stop camera
#    h. Verify cleanup
```

---

## Success Criteria

The integration is considered successful if:

1. ✅ Audio capture works reliably
2. ✅ Server receives and processes audio chunks
3. ✅ Deepgram API connection is established
4. ✅ Transcripts are received via SSE
5. ✅ Real-time display updates correctly
6. ✅ Error handling works gracefully
7. ✅ No memory leaks or performance issues
8. ✅ Clean shutdown on session end

---

## Known Issues / Limitations

- MediaRecorder support varies by browser (Chrome, Firefox, Edge supported)
- Requires HTTPS in production (or localhost for development)
- Deepgram API key must be valid and have credits
- Network latency affects real-time display
- Interim results may flicker during rapid speech

---

## Troubleshooting

### No transcripts appearing
1. Check browser console for errors
2. Verify `DEEPGRAM_API_KEY` is set correctly
3. Check Network tab for failed requests
4. Verify microphone permissions are granted
5. Check server logs for Deepgram errors

### High latency
1. Check network connection
2. Verify audio chunk size (should be ~1 second)
3. Check Deepgram API status
4. Monitor server performance

### Connection errors
1. Verify API key is valid
2. Check Deepgram account has credits
3. Verify network connectivity
4. Check server logs for detailed error messages

---

## Test Results

**Date**: _______________
**Tester**: _______________
**Environment**: Development / Production

| Test | Status | Notes |
|------|--------|-------|
| Audio Capture | ⬜ Pass / ⬜ Fail | |
| Server Transcription | ⬜ Pass / ⬜ Fail | |
| Real-Time Display | ⬜ Pass / ⬜ Fail | |
| Error Handling | ⬜ Pass / ⬜ Fail | |
| Integration Flow | ⬜ Pass / ⬜ Fail | |

**Overall Status**: ⬜ Pass / ⬜ Fail

**Notes**:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
