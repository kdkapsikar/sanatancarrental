"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AssistantEvent, ProposalView, QuickReply } from "@cab/assistant/browser";
import { SteeringWheel } from "./SteeringWheel";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "./speech";
import { ChatError, chatInfo, resolveProposal, streamChat } from "./stream";
import { withBase } from "@/lib/base";

/** Open e-Taxi from anywhere, optionally sending a message: openAssistant("Fare to Shirdi?"). */
export const openAssistant = (message?: string) =>
  window.dispatchEvent(new CustomEvent("etaxi:open", { detail: { message } }));

export interface WidgetStrings {
  name: string;
  tagline: string;
  teaserTitle: string;
  teaser: string;
  open: string;
  close: string;
  placeholder: string;
  send: string;
  intro: string;
  basicMode: string;
  privacy: string;
  confirm: string;
  cancel: string;
  confirmed: string;
  cancelled: string;
  proposalTitle: string;
  mic: string;
  listening: string;
  readAloud: string;
  newChat: string;
  beep: string;
  openPage: string;
  error: string;
  rateLimited: string;
  tools: Record<string, string>;
  chips: QuickReply[];
}

type ProposalState = "pending" | "working" | "confirmed" | "cancelled" | "failed";
interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  proposals: (ProposalView & { state: ProposalState; note?: string })[];
  quickReplies: QuickReply[];
  error?: boolean;
}

// One conversation per language, so switching language doesn't mix old replies in.
const storeKey = (locale: string) => `etaxi_chat_v1_${locale}`;
const TEASER_KEY = "etaxi_teaser_closed";
const VOICE_KEY = "etaxi_read_aloud";
let nextId = 1;

/** Turns relative page paths in an answer ("/en/places/ellora-caves") into links. */
function linkify(text: string, label: string): ReactNode[] {
  return text.split(/(\/(?:en|hi|mr)(?:\/[\w-]+)+)/g).map((part, i) =>
    /^\/(en|hi|mr)\//.test(part) ? (
      <a key={i} href={withBase(part)} className="font-medium text-kumkum-700 underline decoration-dotted underline-offset-2">
        {label} →
      </a>
    ) : (
      part
    ),
  );
}

export function AssistantWidget({ locale, strings: s }: { locale: string; strings: WidgetStrings }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [mode, setMode] = useState<"claude" | "offline" | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState<{ stop: () => void } | null>(null);
  const [voiceCaps, setVoiceCaps] = useState({ listen: false, speak: false });
  const [honk, setHonk] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();

  // Restore this tab's conversation and preferences (never sent anywhere but our own API).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey(locale)) ?? "null") as Message[] | null;
      if (saved?.length) {
        setMessages(saved.map((m) => ({ ...m, proposals: m.proposals.map((p) => (p.state === "pending" || p.state === "working" ? { ...p, state: "cancelled" as const } : p)) })));
        nextId = Math.max(...saved.map((m) => m.id)) + 1;
      }
      setVoiceOn(localStorage.getItem(VOICE_KEY) === "on");
    } catch {
      /* storage unavailable */
    }
    setVoiceCaps({ listen: canListen(), speak: canSpeak() });
    let closed = false;
    try {
      closed = sessionStorage.getItem(TEASER_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (closed) return;
    const timer = setTimeout(() => setTeaser(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(locale), JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, locale]);

  useEffect(() => {
    if (!open || mode) return;
    chatInfo().then((i) => setMode(i.mode), () => setMode("offline"));
  }, [open, mode]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, activity]);

  useEffect(() => () => {
    abortRef.current?.abort();
    stopSpeaking();
  }, []);

  const closeTeaser = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem(TEASER_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const close = useCallback(() => {
    setOpen(false);
    stopSpeaking();
    launcherRef.current?.focus();
  }, []);

  const patchLast = useCallback((fn: (m: Message) => Message) => {
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1]!)] : ms));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      stopSpeaking();
      const history = messages.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, text: m.text }));
      setDraft("");
      setBusy(true);
      setMessages((ms) => [
        ...ms.map((m) => ({ ...m, quickReplies: [] })),
        { id: nextId++, role: "user", text: message, proposals: [], quickReplies: [] },
        { id: nextId++, role: "assistant", text: "", proposals: [], quickReplies: [] },
      ]);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let answer = "";
      try {
        await streamChat(
          { message, locale, history },
          (e: AssistantEvent) => {
            if (e.type === "text") {
              answer += e.delta;
              setActivity("");
              patchLast((m) => ({ ...m, text: m.text + e.delta }));
            } else if (e.type === "tool") {
              setActivity(e.status === "start" ? (s.tools[e.name] ?? s.tools["default"] ?? "") : "");
            } else if (e.type === "proposal") {
              patchLast((m) => ({ ...m, proposals: [...m.proposals, { ...e.proposal, state: "pending" }] }));
            } else if (e.type === "quick_replies") {
              patchLast((m) => ({ ...m, quickReplies: e.options }));
            } else if (e.type === "notice") {
              setMode("offline");
            } else if (e.type === "done") {
              setMode(e.mode);
            } else if (e.type === "error") {
              patchLast((m) => ({ ...m, text: m.text || e.message, error: true }));
            }
          },
          ctrl.signal,
        );
        if (voiceOn) speak(answer, locale);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const msg = err instanceof ChatError && err.status === 429 ? s.rateLimited : s.error;
        patchLast((m) => ({ ...m, text: m.text || msg, error: true }));
      } finally {
        setBusy(false);
        setActivity("");
        abortRef.current = null;
      }
    },
    [busy, messages, locale, patchLast, s, voiceOn],
  );

  // openAssistant(message?) from anywhere on the site.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      setOpen(true);
      setMounted(true);
      closeTeaser();
      if (msg) void send(msg);
    };
    window.addEventListener("etaxi:open", onOpen);
    return () => window.removeEventListener("etaxi:open", onOpen);
  }, [send]);

  const act = async (msgId: number, pid: string, action: "confirm" | "cancel") => {
    const set = (state: ProposalState, note?: string) =>
      setMessages((ms) =>
        ms.map((m) => (m.id !== msgId ? m : { ...m, proposals: m.proposals.map((p) => (p.id === pid ? { ...p, state, ...(note ? { note } : {}) } : p)) })),
      );
    set("working");
    const r = await resolveProposal(pid, action);
    if (r.ok) set(action === "confirm" ? "confirmed" : "cancelled");
    else set("failed", r.message);
  };

  const toggleMic = () => {
    if (listening) {
      listening.stop();
      setListening(null);
      return;
    }
    const h = listen(
      locale,
      (text) => {
        if (text) void send(text);
      },
      () => setListening(null),
    );
    setListening(h);
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) stopSpeaking();
    try {
      localStorage.setItem(VOICE_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    stopSpeaking();
    setMessages([]);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const chips = messages.length === 0 ? s.chips : (lastAssistant?.quickReplies ?? []);
  const wheelState = honk ? "honk" : busy ? "talk" : "idle";

  return (
    <>
      {teaser && !open && (
        <div className="etaxi-pop fixed right-[7.5rem] bottom-8 z-40 flex max-w-[min(16rem,calc(100vw-9rem))] items-start gap-1 rounded-2xl rounded-br-sm border border-kumkum-600/30 bg-white py-2.5 pr-1 pl-3.5 text-sm shadow-xl max-md:bottom-24 sm:right-32">
          <button type="button" onClick={() => { setOpen(true); setMounted(true); closeTeaser(); }} className="text-left leading-snug text-basalt-800">
            <b className="text-kumkum-700">{s.teaserTitle}</b>
            <br />
            {s.teaser}
          </button>
          <button type="button" onClick={closeTeaser} className="px-1.5 text-basalt-400 hover:text-basalt-800" aria-label={s.close}>
            ×
          </button>
        </div>
      )}

      {mounted && (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={(e) => e.key === "Escape" && close()}
          className={`fixed inset-x-2 bottom-2 z-50 flex h-[min(640px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-3xl border border-basalt-900/10 bg-sand-50 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-28 sm:w-[400px] ${open ? "etaxi-pop" : "hidden"}`}
        >
          <header className="basalt-grain flex items-center gap-3 px-4 py-3 text-sand-50">
            <SteeringWheel size={44} state={busy ? "talk" : "idle"} label="" />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg leading-tight">{s.name}</h2>
              <p className="truncate text-xs text-sand-200/80">{mode === "offline" ? s.basicMode : s.tagline}</p>
            </div>
            {voiceCaps.speak && (
              <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} title={s.readAloud} className={`grid size-9 place-items-center rounded-full transition ${voiceOn ? "bg-marigold-400 text-basalt-950" : "bg-white/10 hover:bg-white/20"}`}>
                <span className="ico ico-speaker" aria-hidden="true"><span /></span>
                <span className="sr-only">{s.readAloud}</span>
              </button>
            )}
            {messages.length > 0 && (
              <button type="button" onClick={reset} title={s.newChat} className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <span className="text-xl leading-none" aria-hidden="true">↻</span>
                <span className="sr-only">{s.newChat}</span>
              </button>
            )}
            <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20" aria-label={s.close}>
              ×
            </button>
          </header>
          <div className="paithani-border" />

          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="flex gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm shadow-sm">{s.intro}</div>
            </div>
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-kumkum-600 px-3.5 py-2.5 text-sm whitespace-pre-wrap text-white">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  {m.text && (
                    <div className={`max-w-[88%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${m.error ? "bg-kumkum-50 text-kumkum-700" : "bg-white"}`}>
                      {linkify(m.text, s.openPage)}
                    </div>
                  )}
                  {m.proposals.map((p) => (
                    <div key={p.id} className="max-w-[92%] overflow-hidden rounded-2xl border border-peacock-600/30 bg-white shadow-sm">
                      <div className="bg-peacock-50 px-3.5 py-2 text-xs font-semibold tracking-wider text-peacock-700 uppercase">{s.proposalTitle}</div>
                      <p className="px-3.5 py-2.5 text-sm">{p.summary}</p>
                      {p.state === "pending" || p.state === "working" ? (
                        <div className="flex gap-2 px-3.5 pb-3">
                          <button type="button" disabled={p.state === "working"} onClick={() => act(m.id, p.id, "confirm")} className="rounded-full bg-peacock-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-peacock-700 disabled:opacity-60">
                            {s.confirm}
                          </button>
                          <button type="button" disabled={p.state === "working"} onClick={() => act(m.id, p.id, "cancel")} className="rounded-full border border-basalt-900/15 px-4 py-1.5 text-sm font-semibold hover:border-basalt-900/40 disabled:opacity-60">
                            {s.cancel}
                          </button>
                        </div>
                      ) : (
                        <p className={`px-3.5 pb-3 text-sm font-semibold ${p.state === "confirmed" ? "text-peacock-700" : "text-basalt-600"}`}>
                          {p.state === "confirmed" ? s.confirmed : p.state === "failed" ? (p.note ?? s.error) : s.cancelled}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ),
            )}
            {busy && !messages.at(-1)?.text && (
              <div className="flex items-center gap-2 text-xs text-basalt-600">
                <span className="etaxi-typing inline-flex gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-3 shadow-sm" aria-hidden="true">
                  <span className="size-1.5 rounded-full bg-basalt-400" />
                  <span className="size-1.5 rounded-full bg-basalt-400" />
                  <span className="size-1.5 rounded-full bg-basalt-400" />
                </span>
                {activity}
              </div>
            )}
          </div>

          {chips.length > 0 && !busy && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={() => send(c.message)} className="shrink-0 rounded-full border border-kumkum-600/25 bg-white px-3 py-1.5 text-xs font-medium text-kumkum-700 transition hover:border-kumkum-600 hover:bg-kumkum-50">
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <form
            className="border-t border-basalt-900/10 bg-white px-3 pt-2 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <div className="flex items-end gap-2">
              {voiceCaps.listen && (
                <button type="button" onClick={toggleMic} aria-pressed={!!listening} title={listening ? s.listening : s.mic} className={`grid size-10 shrink-0 place-items-center rounded-full transition ${listening ? "animate-pulse bg-kumkum-600 text-white" : "bg-sand-100 text-basalt-800 hover:bg-sand-200"}`}>
                  <span className="ico ico-mic" aria-hidden="true"><span /></span>
                  <span className="sr-only">{listening ? s.listening : s.mic}</span>
                </button>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder={listening ? s.listening : s.placeholder}
                aria-label={s.placeholder}
                className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl bg-sand-100 px-3.5 py-2.5 text-sm outline-none placeholder:text-basalt-400 focus:bg-sand-50 focus:ring-2 focus:ring-kumkum-500/40"
              />
              <button type="submit" disabled={busy || !draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-kumkum-600 text-white transition hover:bg-kumkum-700 disabled:opacity-40">
                <span className="text-lg leading-none" aria-hidden="true">➤</span>
                <span className="sr-only">{s.send}</span>
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-snug text-basalt-400">{s.privacy}</p>
          </form>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          // A quick honk, then the panel opens.
          const n = Date.now();
          setHonk(n);
          setTimeout(() => setHonk((h) => (h === n ? 0 : h)), 900);
          setOpen((o) => !o);
          setMounted(true);
          closeTeaser();
        }}
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={open ? s.close : s.open}
        className={`group fixed right-4 bottom-4 z-40 grid place-items-center rounded-full transition hover:-translate-y-0.5 max-md:bottom-20 sm:right-5 ${open ? "max-sm:hidden" : ""}`}
      >
        <SteeringWheel key={honk || "wheel"} size={88} state={wheelState} beep={s.beep} className="max-md:text-[7.2px]!" />
      </button>
    </>
  );
}
