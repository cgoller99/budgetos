"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type VoicePhase =
  | "idle"
  | "listening"
  | "thinking"
  | "acting"
  | "speaking"
  | "unsupported"
  | "error";

type SpeechRecognitionResultEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const voiceWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    voiceWindow.SpeechRecognition ??
    voiceWindow.webkitSpeechRecognition ??
    null
  );
}

export function useMissionVoice(planning: boolean) {
  const supported =
    typeof window !== "undefined" &&
    Boolean(speechRecognitionConstructor()) &&
    "speechSynthesis" in window;
  const [phase, setPhase] = useState<VoicePhase>(
    supported ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const speakingRef = useRef(false);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setMicLevel(0);
    if (!speakingRef.current) setPhase(planning ? "acting" : "idle");
  }, [planning]);

  const startListening = useCallback(async () => {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || !navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      return;
    }
    stopListening();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        analyser.getByteTimeDomainData(samples);
        const energy =
          samples.reduce((total, sample) => {
            const normalized = (sample - 128) / 128;
            return total + normalized * normalized;
          }, 0) / samples.length;
        setMicLevel(Math.min(1, Math.sqrt(energy) * 4));
        frameRef.current = requestAnimationFrame(measure);
      };
      measure();

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        setTranscript(text);
      };
      recognition.onerror = () => {
        setPhase("error");
        stopListening();
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) stopListening();
      };
      recognitionRef.current = recognition;
      recognition.start();
      setPhase("listening");
    } catch {
      setPhase("error");
      stopListening();
    }
  }, [stopListening]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utterance.onstart = () => {
        speakingRef.current = true;
        setPhase("speaking");
      };
      utterance.onend = () => {
        speakingRef.current = false;
        setPhase(planning ? "acting" : "idle");
      };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.speak(utterance);
    },
    [planning, supported],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setPhase(planning ? "acting" : "idle");
  }, [planning]);
  const setThinking = useCallback(() => setPhase("thinking"), []);

  useEffect(() => {
    if (phase === "listening" || phase === "speaking") return;
    setPhase(supported ? (planning ? "acting" : "idle") : "unsupported");
  }, [planning, supported, phase]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      void audioContextRef.current?.close();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  return {
    supported,
    phase,
    transcript,
    setTranscript,
    micLevel,
    micActive: phase === "listening",
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setThinking,
  };
}

export function useScreenAwareness(): {
  supported: boolean;
  active: boolean;
  error: string | null;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  capturedFrame: string | null;
  dimensions: { width: number; height: number } | null;
  enable: () => Promise<void>;
  stop: () => void;
  captureFrame: () => string | null;
} {
  const supported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      element.srcObject = streamRef.current;
      void element.play();
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setDimensions(null);
    setCapturedFrame(null);
  }, []);

  const enable = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing is not supported in this browser.");
      return;
    }
    stop();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setDimensions({
        width: settings.width ?? 0,
        height: settings.height ?? 0,
      });
      track.addEventListener("ended", stop, { once: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
      setActive(true);
    } catch {
      setError("Screen access was not enabled.");
      stop();
    }
  }, [stop]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !active || !video.videoWidth || !video.videoHeight) return null;

    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = canvas.toDataURL("image/jpeg", 0.72);
    setCapturedFrame(frame);
    return frame;
  }, [active]);

  useEffect(() => stop, [stop]);

  return {
    supported,
    active,
    error,
    setVideoElement,
    capturedFrame,
    dimensions,
    enable,
    stop,
    captureFrame,
  };
}
