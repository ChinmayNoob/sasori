import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ConversationDemo from "@/components/landing/ConversationDemo";
import { CloudUpload, Brain, FileCheck } from "lucide-react";

const PIPELINE = [
  {
    icon: CloudUpload,
    title: "Sync",
    desc: "Connect Google Drive. Files are discovered and queued automatically.",
  },
  {
    icon: Brain,
    title: "Index",
    desc: "Documents are chunked, embedded, and stored for semantic search.",
  },
  {
    icon: FileCheck,
    title: "Ask",
    desc: "Ask in plain language. Get cited answers from your knowledge.",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center px-6 md:px-12 lg:px-24 py-8 w-full max-w-[1600px] mx-auto z-10 overflow-x-hidden">

        <section className="w-full relative">
          <div className="flex flex-col gap-16 py-20 lg:flex-row lg:items-center lg:gap-16 lg:py-28">
            <div className="flex flex-col gap-8 lg:w-[40%] relative z-10">
              <div className="flex flex-col gap-6 text-left">
                <h1 className="text-sand-900 text-5xl md:text-6xl lg:text-7xl font-thin leading-[1.15] tracking-tight font-serif">
                  Talk to your <br />
                  <span className="font-normal italic text-stone-600">knowledge.</span>
                </h1>
                <p className="text-stone-500 text-lg md:text-xl font-light leading-relaxed tracking-wide max-w-md font-sans">
                  Sync your Google Drive, ask questions in plain language, and get cited answers from an AI agent that reasons through your documents.
                </p>
              </div>
              <div className="mt-2">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full h-14 px-12 bg-stone-850 hover:bg-stone-800 text-pearl-50 text-sm uppercase tracking-[0.2em] font-medium transition-all shadow-button"
                >
                  Get started free
                </a>
              </div>
            </div>
            <div className="w-full lg:w-[60%] relative">
              <div className="bg-pearl-50 border border-stone-200/60 rounded-2xl p-5 md:p-8 shadow-levitate">
                <ConversationDemo />
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-24 md:py-32 flex flex-col gap-12">
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-16 w-full">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-stone-50 text-stone-400">
                    <step.icon className="size-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-semibold text-stone-300 tracking-widest uppercase">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-lg font-light text-sand-900 font-serif">
                  {step.title}
                </h3>
                <p className="text-stone-500 font-light leading-relaxed text-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full py-16 md:py-20 text-center">
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-sand-900 text-3xl md:text-4xl font-thin tracking-tight font-serif">
              Ready to chat with your docs?
            </h2>
            <a
              href="/login"
              className="inline-flex items-center justify-center bg-stone-850 hover:bg-stone-800 text-pearl-50 h-14 px-12 rounded-full text-sm font-medium uppercase tracking-[0.15em] transition-all shadow-button"
            >
              Get Early Access
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
