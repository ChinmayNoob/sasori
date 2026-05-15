"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Send, ArrowLeft } from "lucide-react";
import MessageList, { ChatMessageProps, Citation } from "@/components/chat/MessageList";
import AgentThoughtLoader from "@/components/chat/AgentThoughtLoader";
import { fetchWithAuth } from "@/lib/apiClient";

interface SSEPayload {
  type: string;
  finalAnswerMarkdown?: string;
  citations?: Citation[];
  thought?: string;
  title?: string;
  plan?: string[];
  progress?: { currentStep: number; totalSteps: number };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function* streamSSE(url: string, token: string): AsyncGenerator<SSEPayload> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const dataLine = part.split("\n").find(l => l.startsWith("data:"));
      if (dataLine) {
        try { yield JSON.parse(dataLine.slice(5).trim()); } catch { /* skip malformed */ }
      }
    }
  }
}

export default function ChatRoomPage() {
  const { id: chatId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [agentPlan, setAgentPlan] = useState<string[]>([]);
  const [agentThoughts, setAgentThoughts] = useState<{ id: string, text: string }[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const titleSetRef = useRef(false);
  const autoSentRef = useRef(false);

  const subscribeToTask = useCallback(async (taskId: string, userPrompt: string) => {
    abortRef.current = new AbortController();
    const token = localStorage.getItem("sasori_auth_token") ?? "";
    const url = `${API_URL}/sse/agent/${taskId}`;

    try {
      for await (const event of streamSSE(url, token)) {
        if (event.type === "plan") {
          if (event.plan) {
            setAgentPlan(event.plan);
          }
          const thoughtText = event.thought || "Analyzing your request...";
          setAgentThoughts([{ id: crypto.randomUUID(), text: thoughtText }]);
          if (event.progress) setCurrentStepIndex(event.progress.currentStep);
        } else if (event.type === "step_planned" || event.type === "step_executing" || event.type === "reflecting") {
          const thoughtText = event.thought || event.title || "Thinking...";
          setAgentThoughts(prev => {
            const lastThought = prev[prev.length - 1];
            if (lastThought?.text === thoughtText) {
              return prev;
            }
            return [...prev, { id: crypto.randomUUID(), text: thoughtText }];
          });
          if (event.progress) setCurrentStepIndex(event.progress.currentStep);
        }

        if (event.type === "finish") {
          const aiMsg: ChatMessageProps = {
            id: crypto.randomUUID(),
            content: event.finalAnswerMarkdown || "",
            source: "bot",
            citations: event.citations || [],
          };
          setMessages(prev => [...prev, aiMsg]);
          setIsGenerating(false);

          if (!titleSetRef.current) {
            titleSetRef.current = true;
            fetchWithAuth(`/chats/${chatId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: userPrompt.substring(0, 60) }),
            }).catch(console.error);
          }
          return;
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("SSE error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [chatId]);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessageProps = {
      id: crypto.randomUUID(),
      content,
      source: "user",
      status: "sending",
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setAgentPlan([]);
    setAgentThoughts([{ id: crypto.randomUUID(), text: "Starting agent..." }]);
    setCurrentStepIndex(0);

    try {
      const res = await fetchWithAuth(`/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const { taskId } = await res.json();
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "sent" } : m));
      subscribeToTask(taskId, content);
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "error" } : m));
      setIsGenerating(false);
    }
  }, [chatId, subscribeToTask]);

  useEffect(() => {
    if (!chatId) return;
    setIsLoading(true);
    fetchWithAuth(`/chats/${chatId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.messages) {
          const taskMap: Record<string, any> = {};
          Object.values(data.tasks || {}).forEach((t: any) => { taskMap[t.id] = t; });
          const loaded: ChatMessageProps[] = data.messages.map((m: any) => {
            const task = m.agentTaskId ? taskMap[m.agentTaskId] : null;
            return {
              id: m.id,
              content: m.content,
              source: m.role === "user" ? "user" : "bot",
              citations: task?.resultJson?.citations || [],
            };
          });
          setMessages(loaded);
          if (loaded.length > 0) titleSetRef.current = true;
        }
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        const taskId = searchParams.get("taskId");
        const q = searchParams.get("q");

        if (taskId && q && !autoSentRef.current) {
          autoSentRef.current = true;
          setMessages(prev => {
            const alreadyExists = prev.some(m => m.content === q && m.source === "user");
            if (alreadyExists) return prev;
            
            return [...prev, {
              id: crypto.randomUUID(),
              content: q,
              source: "user",
              status: "sent"
            }];
          });
          setIsGenerating(true);
          setAgentPlan([]);
          setAgentThoughts([{ id: crypto.randomUUID(), text: "Starting agent..." }]);
          setCurrentStepIndex(0);
          subscribeToTask(taskId, q);
        }
      });
  }, [chatId, searchParams, subscribeToTask]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleRetry = useCallback((messageId: string, content: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    sendMessage(content);
  }, [sendMessage]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="sticky top-0 z-10 flex items-center h-14 shrink-0 px-4 lg:px-8
        bg-stone-100 border-b border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 shrink-0 lg:hidden" />
          <a href="/chat" className="flex items-center justify-center size-9 rounded-xl hover:bg-stone-100 transition-colors text-stone-500 hover:text-sand-900" aria-label="Back to conversations">
            <ArrowLeft className="size-4" />
          </a>
        </div>
        <h2 className="text-lg font-serif text-sand-900 tracking-wide ml-3">Conversation</h2>
      </div>

      <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-y-auto px-4 lg:px-8 py-6 scroll-smooth">
        {isLoading ? (
          <div className="flex flex-col gap-6 pt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
                <div className={`h-12 rounded-2xl bg-stone-200/60 animate-pulse ${i % 2 === 0 ? "w-64" : "w-80"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-8 pt-24">
            <div className="flex flex-col items-center gap-5">
              <div className="size-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200/40 shadow-sm">
                <span className="material-symbols-outlined text-[32px] font-thin text-amber-700/70">auto_awesome</span>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-sand-900 text-2xl md:text-3xl font-serif font-light tracking-tight">Start the conversation</h2>
                <p className="text-stone-500 font-light tracking-wide max-w-md text-sm md:text-base">
                  Ask anything about your indexed Google Drive documents and get answers with citations.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} onRetry={handleRetry} />
        )}

        {isGenerating && <AgentThoughtLoader plan={agentPlan} thoughts={agentThoughts} currentStepIndex={currentStepIndex} />}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 w-full px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 pt-4 bg-linear-to-t from-pearl-50 via-pearl-50/90 to-transparent relative z-20">
        <form
          onSubmit={handleSubmit}
          className="relative max-w-3xl mx-auto bg-white border border-stone-200/60 shadow-levitate rounded-3xl sm:rounded-4xl p-1.5 sm:p-2 flex items-end gap-2 transition-all focus-within:shadow-md"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your documents..."
            className={`flex-1 max-h-36 sm:max-h-48 min-h-[48px] sm:min-h-[56px] bg-transparent border-none resize-none py-3 sm:py-4 px-4 sm:px-6 text-sand-900 placeholder:text-stone-400 focus:outline-none text-[15px] sm:text-base font-light tracking-wide overflow-y-auto ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            rows={1}
            disabled={isGenerating}
            onKeyDown={e => {
              if (isGenerating) { e.preventDefault(); return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
          />
          <div className="flex items-center gap-2 pr-2 pb-2">
            <button type="submit" disabled={!input.trim() || isGenerating}
              className="size-10 rounded-full bg-stone-900 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-stone-300 hover:bg-stone-800 transition-all shadow-button disabled:shadow-none"
              aria-label="Send message">
              <Send className="size-4 ml-0.5" strokeWidth={2} />
            </button>
          </div>
        </form>
        <div className="text-center mt-3 text-[10px] text-stone-400 font-light uppercase tracking-widest">
          AI agents can make mistakes. Verify critical citations.
        </div>
      </div>
    </div>
  );
}
