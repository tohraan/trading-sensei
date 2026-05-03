import { useCallback, useEffect, useRef, useState } from "react";

export type SenseiCaption = {
  type: "user" | "sensei";
  text: string;
  id: number;
};

export type VoiceCommand =
  | "learn"
  | "trade"
  | "plan"
  | "emotional"
  | "vr"
  | "ar"
  | "stop";

interface SenseiOptions {
  onCommand: (cmd: VoiceCommand) => void;
  enabled: boolean;
  /** Current biometric stress 0–100, passed in from face tracking */
  stressLevel?: number;
}

// ─── Navigation commands ───────────────────────────────────────────────────────
const NAV_COMMANDS: { patterns: RegExp[]; cmd: VoiceCommand; reply: string }[] = [
  {
    patterns: [/learn|start learn|learning mode|market structure|tutorial|teach me/i],
    cmd: "learn",
    reply: "Opening the market structure tutorial. Focus up, boss.",
  },
  {
    patterns: [/trade|simulate|trading mode|chart|candlestick|open a trade/i],
    cmd: "trade",
    reply: "Trading cockpit is live. Eyes on the charts.",
  },
  {
    patterns: [/plan|strategy|backtest|strategy lab|my strategy/i],
    cmd: "plan",
    reply: "Strategy lab ready. Let's sharpen your edge.",
  },
  {
    patterns: [/emotional|stress|biometric|emotional check|how am i feeling/i],
    cmd: "emotional",
    reply: "Running full biometric scan. Stay present, stay calm.",
  },
  {
    patterns: [/switch to vr|vr mode|virtual reality|immersive mode/i],
    cmd: "vr",
    reply: "Engaging VR immersive cockpit.",
  },
  {
    patterns: [/switch to ar|ar mode|augmented reality|passthrough/i],
    cmd: "ar",
    reply: "Switching to augmented reality passthrough.",
  },
  {
    patterns: [/stop|sleep|quiet|stand by|shut up|enough/i],
    cmd: "stop",
    reply: "Standing by, boss.",
  },
];

// ─── Hardcoded Q&A for presentation ───────────────────────────────────────────
const QA_PAIRS: { patterns: RegExp[]; answer: string }[] = [
  {
    patterns: [/news|update|market news|what.s happening|latest news/i],
    answer:
      "Here are your top market updates. Federal Reserve chair signals two rate cuts before year end, sending equities higher. Gold is trading near all-time highs on dollar weakness. Oil pulled back one point two percent after inventory data. And crypto is consolidating after last week's breakout. Do you want me to pull any of these up in detail?",
  },
  {
    patterns: [/live trades|open trades|positions|what trades|trades going on|active trades/i],
    answer:
      "You currently have three open positions. First: long Gold, X-A-U versus U-S-D, entry at twenty-three hundred and twelve, currently up one point eight percent. Second: long Bitcoin, entry at sixty-two thousand, currently up two point four percent. Third: short Euro-Dollar at one-oh-eight-twenty, currently flat. Your total unrealised P-N-L is positive four thousand three hundred dollars. Looking good, boss.",
  },
  {
    patterns: [/xau|gold|gold price|xauusd|gold value|gold right now/i],
    answer:
      "X-A-U U-S-D is currently trading at twenty-three hundred and forty-one dollars per troy ounce. Up zero point six percent on the session. The daily high is twenty-three fifty-four and the daily low is twenty-three twenty-one. Momentum is bullish with strong institutional buying pressure above the twenty-three hundred level.",
  },
  {
    patterns: [/session|live session|market session|what session|which session|trading session/i],
    answer:
      "We are currently in the London-New York overlap session. This is the highest liquidity window of the trading day, typically accounting for over fifty percent of daily forex volume. Major pairs like Euro-Dollar and Cable are most active right now. Prime hunting ground for your setups, boss.",
  },
  {
    patterns: [/hello|hi|hey there|good morning|good afternoon|what's up/i],
    answer:
      "Hey boss. All systems are online. Biometric tracking is active, charts are live, and I'm monitoring your emotional state in real time. Ready when you are.",
  },
  {
    patterns: [/who are you|what are you|introduce yourself/i],
    answer:
      "I'm Sensei, your A-I trading co-pilot. I monitor your biometrics, track market conditions, and guide you through trading decisions in augmented and virtual reality. I'm always watching, always learning, always protecting your capital.",
  },
];

let captionIdCounter = 0;
const STRESS_ALERT_COOLDOWN_MS = 60_000; // only alert once per minute max

export function useVoiceSensei({ onCommand, enabled, stressLevel = 0 }: SenseiOptions) {
  const [listening, setListening] = useState(false);
  const [captions, setCaptions] = useState<SenseiCaption[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const lastStressAlertRef = useRef<number>(0);
  const stressAlertActiveRef = useRef(false);
  const sustainedHighRef = useRef<number | null>(null);

  const addCaption = useCallback((type: "user" | "sensei", text: string) => {
    const id = captionIdCounter++;
    setCaptions((prev) => [...prev.slice(-5), { type, text, id }]);
    setTimeout(() => {
      setCaptions((prev) => prev.filter((c) => c.id !== id));
    }, 8000);
  }, []);

  const speak = useCallback(
    (text: string, priority = false) => {
      if (!synthRef.current) return;
      if (priority) synthRef.current.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.pitch = 0.82;
      utt.rate = 0.88;
      utt.volume = 1.0;
      // Try to load a good male voice; voices load async in some browsers
      const trySetVoice = () => {
        const voices = synthRef.current.getVoices();
        const preferred =
          voices.find((v) => /google uk english male|daniel|alex|fred|james/i.test(v.name)) ??
          voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              !/(female|zira|hazel|samantha|victoria|karen|moira|tessa)/i.test(v.name)
          ) ??
          voices[0];
        if (preferred) utt.voice = preferred;
      };
      trySetVoice();
      utt.onstart = () => setSpeaking(true);
      utt.onend = () => setSpeaking(false);
      synthRef.current.speak(utt);
      addCaption("sensei", text);
    },
    [addCaption]
  );

  const processTranscript = useCallback(
    (transcript: string) => {
      addCaption("user", transcript);

      // Check Q&A first (more specific)
      const qa = QA_PAIRS.find((q) => q.patterns.some((rx) => rx.test(transcript)));
      if (qa) {
        speak(qa.answer);
        return;
      }

      // Check navigation commands
      const nav = NAV_COMMANDS.find((c) => c.patterns.some((rx) => rx.test(transcript)));
      if (nav) {
        onCommand(nav.cmd);
        speak(nav.reply);
        return;
      }

      // Fallback
      speak(
        "I didn't quite catch that, boss. You can ask me about live trades, market news, gold prices, or say learn, trade, plan, or strategy."
      );
    },
    [onCommand, speak, addCaption]
  );

  // ── Wake-word continuous listener ────────────────────────────────────────────
  const startContinuousListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (recogRef.current) {
      try { recogRef.current.abort(); } catch {}
    }

    const recog = new SR() as SpeechRecognition;
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = "en-US";

    recog.onstart = () => {};
    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      // Restart on network/no-speech errors silently
      if (e.error === "no-speech" || e.error === "network") {
        setTimeout(() => startContinuousListening(), 500);
      }
    };
    recog.onend = () => {
      // Auto-restart to keep always listening
      if (enabled) setTimeout(() => startContinuousListening(), 300);
    };

    recog.onresult = (e: SpeechRecognitionEvent) => {
      const results = Array.from(e.results);
      const lastResult = results[results.length - 1];
      if (!lastResult.isFinal) return;
      const transcript = lastResult[0].transcript.trim().toLowerCase();

      // Wake word detection
      if (/hey\s*sensei|okay\s*sensei|hi\s*sensei/i.test(transcript)) {
        setListening(true);
        speak("Yes boss?");
        setTimeout(() => setListening(false), 3000);
        return;
      }

      // If not a wake word hit, still process if it's a recognisable command/question
      // (mic button always works regardless of wake word)
      const combined = transcript;
      const qa = QA_PAIRS.find((q) => q.patterns.some((rx) => rx.test(combined)));
      const nav = NAV_COMMANDS.find((c) => c.patterns.some((rx) => rx.test(combined)));
      if (qa || nav) {
        processTranscript(transcript);
      }
    };

    recog.start();
    recogRef.current = recog;
  }, [enabled, speak, processTranscript]);

  // Manual mic button
  const startListening = useCallback(() => {
    setListening(true);
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { speak("Speech recognition not supported in this browser."); return; }

    const recog = new SR() as SpeechRecognition;
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    recog.onstart = () => setListening(true);
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      processTranscript(transcript);
    };
    recog.start();
  }, [speak, processTranscript]);

  const stopListening = useCallback(() => {
    setListening(false);
  }, []);

  // ── Greeting on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      speak("Hello boss. Let's get started.", true);
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Start continuous wake-word listener ───────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => startContinuousListening(), 2500);
    return () => {
      clearTimeout(t);
      try { recogRef.current?.abort(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Always-on emotional monitoring: alert if sustained high stress ────────────
  useEffect(() => {
    if (stressLevel > 68) {
      if (!sustainedHighRef.current) {
        sustainedHighRef.current = Date.now();
      } else {
        const sustainedMs = Date.now() - sustainedHighRef.current;
        const cooldownOk = Date.now() - lastStressAlertRef.current > STRESS_ALERT_COOLDOWN_MS;
        if (sustainedMs > 5000 && cooldownOk && !stressAlertActiveRef.current) {
          stressAlertActiveRef.current = true;
          lastStressAlertRef.current = Date.now();
          speak(
            "Boss, your stress levels are elevated. I strongly recommend stepping away from live trades right now. Emotional decisions lead to capital loss. Take a breath. The market will wait.",
            true
          );
          setTimeout(() => { stressAlertActiveRef.current = false; }, 5000);
        }
      }
    } else {
      sustainedHighRef.current = null;
    }
  }, [stressLevel, speak]);

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { recogRef.current?.abort(); } catch {}
      synthRef.current?.cancel();
    };
  }, []);

  return { listening, speaking, captions, startListening, stopListening };
}
