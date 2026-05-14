import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CloudUpload, Layers, Brain, FileCheck, ArrowRight, Zap, Database, Search, Link2, Activity } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: CloudUpload,
    title: "Sync Your Drive",
    desc: "Connect Google Drive with one click. Your files are discovered and queued for processing automatically.",
  },
  {
    num: "02",
    icon: Layers,
    title: "Smart Indexing",
    desc: "Documents are chunked into 800-token segments, embedded with OpenAI, and stored in a vector database for semantic search.",
  },
  {
    num: "03",
    icon: Brain,
    title: "AI Agent at Work",
    desc: "A ReAct agent plans its approach, picks the right tools, and reasons through your question step by step.",
  },
  {
    num: "04",
    icon: FileCheck,
    title: "Cited Answers",
    desc: "Every response comes with clickable source citations linking directly to the original document and page.",
  },
];

const PILLARS = [
  {
    icon: Database,
    label: "Vector Search",
    desc: "Qdrant-powered retrieval with cosine similarity filtering and per-user data isolation for privacy.",
  },
  {
    icon: Search,
    label: "Web Search",
    desc: "When your docs aren't enough, the agent searches the web via Tavily and scrapes pages for deeper context.",
  },
  {
    icon: Activity,
    label: "Real-Time Streaming",
    desc: "Watch the agent think, plan, and execute live through server-sent events — no waiting in the dark.",
  },
  {
    icon: Link2,
    label: "Verified Sources",
    desc: "Answers are grounded in your actual documents. Every claim links back to its source for full transparency.",
  },
  {
    icon: Zap,
    label: "Background Workers",
    desc: "Drive ingestion runs on independent, auto-scaling workers — your chat is never blocked by indexing.",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center px-6 md:px-12 lg:px-24 py-8 w-full max-w-[1600px] mx-auto z-10 overflow-x-hidden">
        {/* ── Hero ── */}
        <section className="@container w-full relative">
          <div className="flex flex-col gap-16 py-20 lg:flex-row lg:items-center lg:gap-20 lg:py-32">
            <div className="flex flex-col gap-10 lg:w-1/2 relative z-10">
              <div className="flex flex-col gap-8 text-left">
                <h1 className="text-sand-900 text-5xl md:text-6xl lg:text-7xl font-thin leading-[1.15] tracking-tight font-serif">
                  Talk to your <br />
                  <span className="font-normal italic text-stone-600">knowledge.</span>
                </h1>
                <p className="text-stone-500 text-lg md:text-xl font-light leading-relaxed tracking-wide max-w-lg font-sans">
                  Sync your Google Drive, ask questions in plain language, and get cited answers from an AI agent that reasons through your documents.
                </p>
              </div>
              <div className="flex flex-wrap gap-6 mt-4">
                <a href="/login" className="flex items-center justify-center rounded-full h-14 px-12 bg-stone-850 hover:bg-black text-pearl-50 text-sm uppercase tracking-[0.2em] font-medium transition-all shadow-levitate hover:shadow-xl hover:-translate-y-1">
                  Get started free
                </a>
              </div>
              <div className="flex items-center gap-6 text-sm text-stone-400 font-light mt-8 tracking-widest uppercase">
                <div className="flex -space-x-4">
                  <div className="w-12 h-12 rounded-full bg-stone-200 border border-white shadow-sm"></div>
                  <div className="w-12 h-12 rounded-full bg-stone-300 border border-white shadow-sm"></div>
                  <div className="w-12 h-12 rounded-full bg-stone-400 border border-white shadow-sm"></div>
                </div>
                <p>Used by forward-thinking teams</p>
              </div>
            </div>
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-linear-to-tr from-white to-transparent rounded-full blur-3xl opacity-40"></div>
              <div className="relative w-full aspect-4/3 md:aspect-4/3 glass-card rounded-4xl p-4 shadow-levitate animate-float border border-white/60">
                <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative">
                  <div className="w-full h-full bg-cover bg-center opacity-80 mix-blend-multiply" style={{ backgroundImage: 'url("/images/p-13.jpg")', filter: 'sepia(0.1) contrast(0.95) brightness(1.05) grayscale(0.2)' }}></div>
                  <div className="absolute top-10 right-10 bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-float border border-white/40 flex flex-col gap-3 max-w-[200px] animate-float-delayed">
                    <div className="h-1.5 bg-stone-300/50 rounded-full w-3/4"></div>
                    <div className="h-1.5 bg-stone-200/50 rounded-full w-full"></div>
                    <div className="h-1.5 bg-stone-200/50 rounded-full w-1/2"></div>
                  </div>
                  <div className="absolute bottom-10 left-10 bg-white/80 backdrop-blur-2xl p-6 rounded-4xl shadow-levitate border border-white/50 flex items-center gap-5 pr-10 animate-float">
                    <div className="size-12 rounded-full bg-linear-to-tr from-stone-100 to-white border border-white flex items-center justify-center text-stone-500 shadow-sm">
                      <span className="material-symbols-outlined font-light text-[20px]">auto_awesome</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.2em] mb-1.5">Status</div>
                      <div className="text-sm font-light text-stone-800 tracking-wide font-serif italic">Analyzing Context</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="w-full py-24 md:py-36 flex flex-col gap-20">
          <div className="flex flex-col gap-8 text-center items-center">
            <span className="px-5 py-2.5 rounded-full border border-sand-200/50 bg-white/30 backdrop-blur-sm text-stone-500 text-xs font-semibold tracking-[0.25em] uppercase shadow-sm">How It Works</span>
            <h2 className="text-sand-900 text-4xl md:text-5xl lg:text-6xl font-thin tracking-tight max-w-3xl font-serif">
              From Drive to <br /><span className="italic font-normal text-stone-600">cited answer</span>
            </h2>
            <p className="text-stone-500 text-base md:text-lg font-light tracking-wide max-w-2xl font-sans leading-relaxed">
              An AI pipeline that syncs your documents, understands them with vector search, and reasons through questions with a transparent agent.
            </p>
          </div>

          {/* Steps pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {STEPS.map((step, i) => (
              <div key={step.num} className="glass-card group relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 hover:bg-white/50 transition-all duration-700 hover:shadow-levitate shadow-float flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-white shadow-sm text-stone-600">
                    <step.icon className="size-6" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-semibold text-stone-300 tracking-widest">{step.num}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl md:text-2xl font-light text-sand-900 font-serif">{step.title}</h3>
                  <p className="text-stone-500 font-light leading-relaxed tracking-wide text-sm">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 size-6 items-center justify-center rounded-full bg-white shadow-md border border-stone-100 text-stone-400">
                    <ArrowRight className="size-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Architecture Pillars ── */}
        <section className="w-full py-24 md:py-36 flex flex-col gap-20">
          <div className="flex flex-col gap-8 text-center items-center">
            <span className="px-5 py-2.5 rounded-full border border-sand-200/50 bg-white/30 backdrop-blur-sm text-stone-500 text-xs font-semibold tracking-[0.25em] uppercase shadow-sm">Under the Hood</span>
            <h2 className="text-sand-900 text-4xl md:text-5xl lg:text-6xl font-thin tracking-tight max-w-3xl font-serif">
              Built for <span className="italic font-normal text-stone-600">accuracy</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {PILLARS.map((p) => (
              <div key={p.label} className="glass-card group relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 hover:bg-white/50 transition-all duration-700 hover:shadow-levitate shadow-float flex flex-col gap-5">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-white shadow-sm text-stone-600">
                  <p.icon className="size-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl md:text-2xl font-light text-sand-900 font-serif">{p.label}</h3>
                <p className="text-stone-500 font-light leading-relaxed tracking-wide text-sm">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="w-full py-16 md:py-20 px-4">
          <div className="w-full bg-stone-900 rounded-[3rem] md:rounded-[4rem] p-12 md:p-24 lg:p-32 text-center relative overflow-hidden shadow-2xl shadow-stone-900/10">
            <div className="absolute top-0 right-0 w-80 h-80 md:w-[500px] md:h-[500px] bg-stone-800/50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 md:w-[500px] md:h-[500px] bg-stone-700/40 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col items-center gap-8 md:gap-12">
              <h2 className="text-pearl-50 text-3xl md:text-5xl lg:text-7xl font-thin tracking-tight max-w-4xl leading-tight font-serif">
                Ready to chat with your docs?
              </h2>
              <p className="text-stone-400 text-base md:text-lg font-light max-w-sm md:max-w-lg tracking-wide leading-relaxed">
                Get early access today. No credit card required.
              </p>
              <div className="w-full max-w-md mt-4">
                <div className="flex flex-col gap-3 bg-white/5 backdrop-blur-md rounded-3xl md:rounded-full border border-white/10 p-3 shadow-2xl">
                  <input
                    className="w-full bg-transparent border-none outline-none text-white px-5 py-3 placeholder-stone-500 font-light text-sm tracking-wide rounded-2xl"
                    placeholder="Enter your email"
                    type="email"
                  />
                  <a
                    href="/login"
                    className="flex items-center justify-center w-full bg-white hover:bg-stone-100 text-stone-900 px-8 py-4 rounded-2xl md:rounded-full text-xs font-medium uppercase tracking-[0.15em] transition-all"
                  >
                    Get Early Access
                  </a>
                </div>
                <p className="text-stone-600 text-[10px] mt-4 font-light tracking-[0.2em] uppercase">No credit card · Cancel anytime</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
