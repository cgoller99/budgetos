# Jarvis calling — staged, not live

Current files: lib/ai-team/phoneCalls.ts (Twilio REST transport), lib/ai-team/twilioWebhook.ts (signed webhook validation), app/api/jarvis/voice/route.ts (test greeting), scripts/test-jarvis-voice.mjs (tests).

Server-only environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, JARVIS_VERIFIED_PHONE_NUMBER, JARVIS_PUBLIC_ORIGIN.

Before enabling calls: create and verify Twilio account; purchase a voice-enabled number; configure secrets; deploy HTTPS webhook; create an authenticated admin-only call initiation endpoint with a server-side single-use approval, rate limiting, spend caps, audit logging and quiet hours. A client-supplied approvedByUser boolean is NOT sufficient authorization. Test one approved call to the verified number. For two-way conversation, add a real-time voice bridge and appropriate disclosure/consent handling.

Current status: development only. No Twilio account, number, call or production deployment was created.
