"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const CONTEXT_WINDOW = 1_048_576;

function estimateTokens(messages: { text: string }[], input: string) {
  const chars = messages.reduce((sum, m) => sum + m.text.length, 0) + input.length;
  return Math.round(chars / 4);
}

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
};

export function AiSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const contextPct = useMemo(() => {
    const tokens = estimateTokens(messages, input);
    return Math.min(100, Math.round((tokens / CONTEXT_WINDOW) * 100));
  }, [messages, input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `msg_${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, message: text }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setMessages((prev) => [
        ...prev,
        { id: `msg_${Date.now()}`, role: "model", text: json.reply },
      ]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Sidebar panel */}
      <aside className="h-full w-[420px] bg-white border-l border-brand-border flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-brand-border shrink-0">
          <div>
            <p className="font-semibold text-brand-dark text-sm">PSM Assistant</p>
            <p className="text-xs text-brand-gray">Powered by Gemini</p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="px-2.5 py-1 rounded-lg border border-brand-border text-xs text-brand-gray hover:bg-gray-50 hover:text-brand-dark transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-gray hover:bg-gray-100 hover:text-brand-dark transition-colors"
              aria-label="Close assistant"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4">
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-brand-gray text-sm text-center px-6">
                Ask anything about PSM operations, onboarding, events, or volunteers.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex chat-message-in ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-shadow duration-200",
                  m.role === "user"
                    ? "bg-brand-red text-white rounded-br-sm whitespace-pre-wrap hover:shadow-md"
                    : "bg-gray-100 text-brand-dark rounded-bl-sm hover:bg-gray-200/70",
                ].join(" ")}
              >
                {m.role === "user" ? m.text : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-1">{children}</ol>,
                      li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start chat-message-in">
              <div className="chat-typing bg-gray-100 text-brand-gray px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
                <span className="inline-flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gray animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gray animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gray animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 px-4 pb-2 shrink-0">{error}</p>
        )}

        {/* Input */}
        <div className="shrink-0 mx-4 mb-4 flex gap-2 items-center border border-brand-border rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-red/30 focus-within:border-brand-red transition-colors">
          <span className={`text-xs font-mono shrink-0 ${contextPct >= 90 ? "text-red-500" : contextPct >= 70 ? "text-yellow-500" : "text-brand-gray"}`}>
            {contextPct}%
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send)"
            rows={1}
            className="flex-1 resize-none text-sm text-brand-dark bg-transparent focus:outline-none placeholder:text-gray-400 leading-relaxed"
            style={{ maxHeight: "6rem", overflowY: "auto" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-3 py-1.5 rounded-xl bg-brand-red text-white text-xs font-semibold hover:bg-brand-red-dark active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shrink-0"
          >
            Send
          </button>
        </div>
      </aside>
    </>
  );
}
