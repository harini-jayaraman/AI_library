import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from './speech';

export interface UseSpeechReturn {
  sttSupported: boolean;
  ttsSupported: boolean;
  listening: boolean;
  speaking: boolean;
  interim: string;
  error: string | null;
  muted: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  toggleMute: () => void;
  clearError: () => void;
  setOnFinal: (fn: ((text: string) => void) | null) => void;
}

export function useSpeech(): UseSpeechReturn {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  const SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;
  const sttSupported = Boolean(SR);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const setOnFinal = useCallback((fn: ((text: string) => void) | null) => {
    onFinalRef.current = fn;
  }, []);

  const ensureRecognition = useCallback((): SpeechRecognition | null => {
    if (!SR) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const transcript = res.item(0)?.transcript ?? '';
        if (res.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        onFinalRef.current?.(finalText.trim());
      }
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === 'no-speech') {
        setError("I didn't hear anything. Try speaking again.");
      } else if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setError('Microphone access was denied. Allow mic access in your browser, or type your request below.');
      } else if (ev.error === 'aborted') {
        // intentional stop
      } else {
        setError(`Speech recognition error: ${ev.error}`);
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = rec;
    return rec;
  }, [SR]);

  const reallyStart = useCallback(() => {
    const rec = ensureRecognition();
    if (!rec) return;
    setError(null);
    setInterim('');
    try {
      rec.start();
      setListening(true);
    } catch {
      try {
        rec.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, [ensureRecognition]);

  const startListening = useCallback(() => {
    if (!sttSupported) return;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          reallyStart();
        })
        .catch((err: unknown) => {
          const name = (err as { name?: string })?.name ?? '';
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            setError('Microphone access was denied. Allow mic access in your browser, or type your request below.');
          } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            setError('No microphone was found on this device. You can still type your request below.');
          } else {
            setError('Could not access the microphone. You can still type your request below.');
          }
          setListening(false);
        });
    } else {
      reallyStart();
    }
  }, [sttSupported, reallyStart]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || mutedRef.current) return;
      const clean = text
        .replace(/[•·]/g, ',')
        .replace(/^\d+\.\s*/gm, '')
        .replace(/\n+/g, '. ')
        .trim();
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'en-US';
        utter.rate = 1.02;
        utter.pitch = 1;
        utter.onstart = () => setSpeaking(true);
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
      } catch {
        // TTS not available
      }
    },
    [ttsSupported],
  );

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [ttsSupported]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next && ttsSupported) window.speechSynthesis.cancel();
      return next;
    });
  }, [ttsSupported]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  return {
    sttSupported,
    ttsSupported,
    listening,
    speaking,
    interim,
    error,
    muted,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleMute,
    clearError,
    setOnFinal,
  };
}
