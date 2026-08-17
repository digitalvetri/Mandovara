/* eslint-disable max-lines -- FIXME: split into smaller files (currently 350 lines) */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, RotateCcw, User, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  {
    label: "Curtain fabric",
    prompt: "Calculate curtain fabric for 3 windows, each 1.8 m wide × 2.1 m tall, eyelet heading at 2× fullness on 110 cm fabric. No pattern repeat.",
  },
  {
    label: "Wallpaper rolls",
    prompt: "How many wallpaper rolls for a wall 4.2 m wide × 2.7 m tall with a 64 cm straight pattern repeat? Roll size 530 mm × 10.05 m.",
  },
  {
    label: "Flooring boxes",
    prompt: "How many laminate flooring boxes for a room 5.4 m × 3.9 m, straight lay, if each box covers 2.2 sqft?",
  },
  {
    label: "Blind area",
    prompt: "Calculate billable sqft for 4 roller blinds, each window 1 200 mm wide × 1 500 mm tall, outside mount with standard overlap. Minimum charge is 10 sqft per blind.",
  },
  {
    label: "GST on wallpaper",
    prompt: "What GST rate applies to wallpaper sold in Tamil Nadu? What are the HSN code and the CGST + SGST split?",
  },
  {
    label: "Fabric recommendation",
    prompt: "A client wants curtains for their living room in Coimbatore — large south-facing windows, bright light, modern aesthetic. What fabric type and heading style would you recommend?",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function MandovaraAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");
    setBusy(true);

    // Add a placeholder for the streaming reply
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `⚠️ ${errText || "Could not reach Mandovara AI."}` },
        ]);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: snap },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "⚠️ Network error — please try again." },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, busy]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] -mx-5 sm:-mx-7 md:-mx-9 xl:-mx-11 -my-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[8px] border border-gold/30 bg-gold/10 flex items-center justify-center">
            <Sparkles size={16} strokeWidth={1.4} className="text-gold" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-text leading-none">Mandovara AI</p>
            <p className="text-[11px] text-text-muted mt-0.5 leading-none">
              Interior design · material calculations · GST
            </p>
          </div>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text transition-colors px-2.5 py-1.5 rounded-[6px] hover:bg-surface-2"
          >
            <RotateCcw size={12} strokeWidth={2} />
            New chat
          </button>
        )}
      </div>

      {/* ── Messages or empty state ── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onSuggest={send} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((m, i) => (
              <Bubble key={i} message={m} streaming={busy && i === messages.length - 1} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 rounded-[12px] border border-border bg-surface-2 px-4 py-3 focus-within:border-gold/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about calculations, materials, design, GST…"
              rows={1}
              disabled={busy}
              className="flex-1 bg-transparent text-[13.5px] text-text placeholder:text-text-muted outline-none resize-none min-h-[24px] max-h-[140px] leading-relaxed disabled:opacity-60"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || busy}
              className="h-8 w-8 rounded-[8px] bg-gold flex items-center justify-center text-ink transition-all hover:bg-gold-strong disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={14} strokeWidth={2} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-text-subtle text-center">
            Press Enter to send · Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
        isUser
          ? "bg-gold/20 border border-gold/30"
          : "bg-surface border border-border"
      }`}>
        {isUser
          ? <User size={13} strokeWidth={1.8} className="text-gold" />
          : <Sparkles size={13} strokeWidth={1.5} className="text-gold" />}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-[12px] px-4 py-3 text-[13.5px] leading-relaxed ${
          isUser
            ? "bg-gold/15 border border-gold/20 text-text rounded-tr-[4px]"
            : "bg-surface border border-border text-text rounded-tl-[4px]"
        }`}>
          {message.content ? (
            <FormattedText text={message.content} />
          ) : streaming ? (
            <ThinkingDots />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Formatted text — basic markdown-ish rendering ─────────────────────────────

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-text">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="font-display font-semibold text-[15px] text-text">{line.slice(2)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="font-semibold text-[14px] text-text">{line.slice(3)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gold shrink-0 mt-[3px]">·</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) return (
            <div key={i} className="flex gap-2">
              <span className="font-data text-gold shrink-0 tabular-nums">{match[1]}.</span>
              <span>{renderInline(match[2] ?? "")}</span>
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-1.5" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="font-data text-[12.5px] bg-surface-2 px-1 py-0.5 rounded-[3px] text-gold">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ── Thinking animation ────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 h-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-gold/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// ── Empty state with suggestions ──────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (prompt: string) => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Intro */}
      <div className="text-center mb-10">
        <div className="inline-flex h-14 w-14 rounded-[16px] border border-gold/30 bg-gold/10 items-center justify-center mb-4">
          <Sparkles size={26} strokeWidth={1.3} className="text-gold" />
        </div>
        <h2 className="font-display text-[22px] font-semibold text-text mb-2">
          How can I help you today?
        </h2>
        <p className="text-[13.5px] text-text-muted max-w-sm mx-auto leading-relaxed">
          I can calculate material quantities, answer GST questions,
          recommend fabrics, and guide you through any furnishing query.
        </p>
      </div>

      {/* Suggestion grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSuggest(s.prompt)}
            className="group flex items-start gap-3 rounded-[12px] border border-border bg-surface hover:border-gold/30 hover:bg-gold/5 transition-all text-left px-4 py-3.5"
          >
            <ChevronRight
              size={14}
              strokeWidth={2}
              className="text-gold/50 group-hover:text-gold shrink-0 mt-0.5 transition-colors"
            />
            <div>
              <p className="text-[12.5px] font-semibold text-text group-hover:text-gold transition-colors mb-0.5">
                {s.label}
              </p>
              <p className="text-[12px] text-text-muted leading-snug line-clamp-2">
                {s.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
