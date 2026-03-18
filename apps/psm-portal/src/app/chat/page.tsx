"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useUser } from "@/components/userContext";

const CONTEXT_WINDOW = 1_048_576;

function estimateTokens(messages: { text: string }[], input: string) {
  const chars = messages.reduce((sum, m) => sum + m.text.length, 0) + input.length;
  return Math.round(chars / 4);
}

export default function ChatPage() {
  const { messages, setMessages } = useUser();
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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: `msg_${Date.now()}`, role: "user" as const, text };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, message: text })
      });

      const json = await resp.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");

      setMessages((prev) => [
        ...prev,
        { id: `msg_${Date.now()}`, role: "model" as const, text: json.reply }
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
    <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">PSM Assistant</h1>
          <p className="text-brand-gray text-sm">Powered by Gemini</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="px-3 py-1.5 rounded-lg border border-brand-border text-sm text-brand-gray hover:bg-gray-50 hover:text-brand-dark transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 pr-1">
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-brand-gray text-sm text-center">
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
                "max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-shadow duration-200",
                m.role === "user"
                  ? "bg-brand-red text-white rounded-br-sm whitespace-pre-wrap hover:shadow-md"
                  : "bg-gray-100 text-brand-dark rounded-bl-sm hover:bg-gray-200/70"
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
        <p className="text-sm text-red-600 mb-2 shrink-0">{error}</p>
      )}

      {/* Input */}
      <div className="shrink-0 flex gap-3 items-center border border-brand-border rounded-2xl p-3 focus-within:ring-2 focus-within:ring-brand-red/30 focus-within:border-brand-red transition-colors">
        <span className={`text-xs font-mono shrink-0 ${contextPct >= 90 ? "text-red-500" : contextPct >= 70 ? "text-yellow-500" : "text-brand-gray"}`}>
          {contextPct}%
        </span>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message PSM Assistant... (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none text-sm text-brand-dark bg-transparent focus:outline-none placeholder:text-gray-400 leading-relaxed"
          style={{ maxHeight: "8rem", overflowY: "auto" }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-semibold hover:bg-brand-red-dark active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shrink-0"
        >
          Send
        </button>
      </div>
    </main>
  );
}
