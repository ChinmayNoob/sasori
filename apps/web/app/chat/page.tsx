"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft } from "lucide-react";
import { fetchWithAuth } from "@/lib/apiClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SUGGESTIONS = [
  { icon: "summarize", label: "Summarize a document", prompt: "Summarize the key findings from my latest report" },
  { icon: "search", label: "Find specific info", prompt: "Find all documents mentioning quarterly revenue" },
  { icon: "compare_arrows", label: "Compare documents", prompt: "Compare the policies described in my HR handbook and compliance guide" },
  { icon: "lightbulb", label: "Extract insights", prompt: "What are the main action items from my project notes?" },
];

export default function NewChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetchWithAuth("/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialMessage: trimmed })
      });
      if (!res.ok) throw new Error("Failed to create chat");

      const chat = await res.json();
      router.push(`/chat/${chat.id}?taskId=${chat.initialTaskId}&q=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center h-14 shrink-0 px-4 lg:px-8
        bg-stone-100 border-b border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 shrink-0 lg:hidden" />
          <a href="/chat" onClick={e => { e.preventDefault(); router.back(); }} className="flex items-center justify-center size-9 rounded-xl hover:bg-stone-100 transition-colors text-stone-500 hover:text-sand-900" aria-label="Go back">
            <ArrowLeft className="size-4" />
          </a>
        </div>
        <h2 className="text-lg font-serif text-sand-900 tracking-wide ml-3">New Conversation</h2>
      </div>

      {/* Content column */}
      <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-y-auto px-4 lg:px-8 py-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 pb-32 pt-8">
          <div className="flex flex-col items-center gap-5">
            <div className="size-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200/40 shadow-sm">
              <span className="material-symbols-outlined text-[32px] font-thin text-amber-700/70">auto_awesome</span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-sand-900 text-2xl md:text-3xl font-serif font-light tracking-tight">What can I help you find?</h2>
              <p className="text-stone-500 font-light tracking-wide max-w-md text-sm md:text-base">
                Ask questions about your indexed Google Drive documents and get answers with citations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSuggestionClick(s.prompt)}
                className="flex items-center gap-3.5 px-5 py-4 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200/60 hover:border-stone-300 shadow-sm transition-all text-left group"
              >
                <div className="size-9 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center shrink-0 transition-colors">
                  <span className="material-symbols-outlined text-[18px] font-light text-amber-700/70">{s.icon}</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-sand-900 tracking-wide">{s.label}</span>
                  <span className="text-xs text-stone-400 font-light truncate">{s.prompt}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

      {/* Input */}
      <div className="shrink-0 w-full px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 pt-4 bg-linear-to-t from-pearl-50 via-pearl-50/90 to-transparent relative z-20">
        <form
          onSubmit={handleSubmit}
          className="relative max-w-3xl mx-auto bg-white border border-stone-200/60 shadow-levitate rounded-3xl sm:rounded-4xl p-1.5 sm:p-2 flex items-end gap-2 transition-all focus-within:shadow-md"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your documents..."
            className="flex-1 max-h-36 sm:max-h-48 min-h-[48px] sm:min-h-[56px] bg-transparent border-none resize-none py-3 sm:py-4 px-4 sm:px-6 text-sand-900 placeholder:text-stone-400 focus:outline-none focus:ring-0 text-[15px] sm:text-base font-light tracking-wide overflow-y-auto"
            rows={1}
            disabled={isCreating}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
          />
          <div className="flex items-center gap-2 pr-2 pb-2">
            <button
              type="submit"
              disabled={!input.trim() || isCreating}
              className="size-10 rounded-full bg-stone-900 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-stone-300 hover:bg-stone-800 transition-all shadow-button disabled:shadow-none"
              aria-label="Send message"
            >
              <Send className="size-4 ml-0.5" strokeWidth={2} />
            </button>
          </div>
        </form>
        <div className="text-center mt-3 text-[10px] text-stone-400 font-light uppercase tracking-widest">
          AI agents can make mistakes. Verify critical citations.
        </div>
      </div>
      </div>
    </div>
  );
}
