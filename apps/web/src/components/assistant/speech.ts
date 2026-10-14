// Voice for e-Taxi, following मदतनीस (e-nagarparishad/client/src/bot/speech.js) but browser-only:
// Web Speech API recognition (mic) and synthesis (read aloud). Everything degrades quietly;
// typing and tapping always work.

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

const BCP47: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canListen = () => !!recognitionCtor();
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Listens once; resolves with the transcript ("" if nothing heard). Returns a stop handle. */
export function listen(locale: string, onText: (text: string) => void, onEnd: () => void): { stop: () => void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = BCP47[locale] ?? "en-IN";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => onText(e.results[0]?.[0]?.transcript ?? "");
  r.onerror = () => onEnd();
  r.onend = () => onEnd();
  try {
    r.start();
  } catch {
    onEnd();
    return null;
  }
  return { stop: () => r.stop() };
}

/** Reads text aloud with the best installed voice for the locale (Marathi falls back to Hindi). */
export function speak(text: string, locale: string): void {
  if (!canSpeak() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  const want = BCP47[locale] ?? "en-IN";
  const voice =
    voices.find((v) => v.lang.replace("_", "-") === want) ??
    (locale === "mr" ? voices.find((v) => v.lang.startsWith("hi")) : undefined) ??
    voices.find((v) => v.lang.startsWith(want.slice(0, 2)));
  const u = new SpeechSynthesisUtterance(text.replace(/\/(en|hi|mr)\/\S+/g, ""));
  u.lang = voice?.lang ?? want;
  if (voice) u.voice = voice;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
