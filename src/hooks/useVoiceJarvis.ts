import { useCallback, useEffect, useRef, useState } from "react";

export type JarvisCaption = {
  type: "user" | "jarvis";
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

interface JarvisOptions {
  onCommand: (cmd: VoiceCommand) => void;
  enabled: boolean;
}

const COMMANDS: { patterns: RegExp[]; cmd: VoiceCommand; reply: string }[] = [
  {
    patterns: [/learn|start learn|learning mode|market structure|tutorial/i],
    cmd: "learn",
    reply: "Launching market structure tutorial. Prepare yourself, trader.",
  },
  {
    patterns: [/trade|simulate a trade|trading mode|chart|candlestick/i],
    cmd: "trade",
    reply: "Opening the trading cockpit. Eyes on the charts.",
  },
  {
    patterns: [/plan|strategy|backtest|simulator|strategy lab/i],
    cmd: "plan",
    reply: "Strategy lab is ready. Let's optimise your edge.",
  },
  {
    patterns: [/emotional|stress|biometric|emotional check/i],
    cmd: "emotional",
    reply: "Running biometric scan. Stay calm. Stay focused.",
  },
  {
    patterns: [/switch to vr|vr mode|virtual reality|immersive/i],
    cmd: "vr",
    reply: "Engaging VR immersive cockpit.",
  },
  {
    patterns: [/switch to ar|ar mode|augmented|passthrough/i],
    cmd: "ar",
    reply: "Switching to augmented reality passthrough.",
  },
  {
    patterns: [/stop|sleep|deactivate|quiet|shut up/i],
    cmd: "stop",
    reply: "Understood. Standing by.",
  },
];

let captionIdCounter = 0;

export function useVoiceJarvis({ onCommand, enabled }: JarvisOptions) {
  const [listening, setListening] = useState(false);
  const [captions, setCaptions] = useState<JarvisCaption[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);

  const addCaption = useCallback((type: "user" | "jarvis", text: string) => {
    const id = captionIdCounter++;
    setCaptions((prev) => [...prev.slice(-6), { type, text, id }]);
    setTimeout(() => {
      setCaptions((prev) => prev.filter((c) => c.id !== id));
    }, 6000);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.pitch = 0.85;
      utt.rate = 0.92;
      utt.volume = 0.95;
      // Prefer a deep male voice
      const voices = synthRef.current.getVoices();
      const preferred =
        voices.find((v) =>
          /google uk english male|daniel|alex|fred/i.test(v.name)
        ) ??
        voices.find((v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("female")) ??
        voices[0];
      if (preferred) utt.voice = preferred;
      utt.onstart = () => setSpeaking(true);
      utt.onend = () => setSpeaking(false);
      synthRef.current.speak(utt);
      addCaption("jarvis", text);
    },
    [addCaption]
  );

  const processTranscript = useCallback(
    (transcript: string) => {
      addCaption("user", transcript);
      const match = COMMANDS.find((c) =>
        c.patterns.some((rx) => rx.test(transcript))
      );
      if (match) {
        onCommand(match.cmd);
        speak(match.reply);
      } else {
        speak(
          "Command not recognised. Try: learn, trade, plan, or strategy lab."
        );
      }
    },
    [onCommand, speak, addCaption]
  );

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      speak("Speech recognition not supported in this browser.");
      return;
    }
    if (recogRef.current) {
      recogRef.current.abort();
    }
    const recog = new SR() as SpeechRecognition;
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    recog.onstart = () => setListening(true);
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      processTranscript(transcript);
    };
    recog.start();
    recogRef.current = recog;
  }, [speak, processTranscript]);

  const stopListening = useCallback(() => {
    recogRef.current?.abort();
    setListening(false);
  }, []);

  // Greet on mount
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      speak(
        "Trading Sensei online. Say learn, trade, or plan to navigate. I'm Jarvis. Your co-pilot."
      );
    }, 1800);
    return () => clearTimeout(t);
  }, [enabled, speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recogRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, []);

  return { listening, speaking, captions, startListening, stopListening };
}
