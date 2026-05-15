import { CheckCircle2 } from "lucide-react";

const DEMO_PLAN = [
  "Search indexed documents for Q3 product review",
  "Analyze and extract key findings",
  "Compile summary with source citations",
];

const DEMO_CITATIONS = [
  "Q3 Product Review.pdf",
  "Customer Satisfaction Report.xlsx",
  "Enterprise Account Analysis.docx",
];

export default function ConversationDemo() {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex w-full justify-end">
        <div className="max-w-[85%]">
          <div className="inline-block px-5 py-3.5 rounded-2xl rounded-tr-sm bg-stone-100 text-sand-900 border border-stone-200/60 shadow-sm text-[15px] leading-relaxed font-light tracking-wide text-left">
            What were the key findings from the Q3 product review?
          </div>
        </div>
      </div>

      <div className="flex w-full">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0">
          <div className="size-8 rounded-full bg-linear-to-tr from-stone-100 to-white flex items-center justify-center border border-white shadow-sm ring-1 ring-black/5">
            <span className="material-symbols-outlined text-[18px] font-thin text-stone-500">auto_awesome</span>
          </div>
        </div>

        <div className="flex flex-col min-h-[40px] max-w-[85%] mt-1 gap-5">
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-stone-200/60 shadow-sm max-w-md">
            <h4 className="text-xs font-medium text-stone-500 uppercase tracking-widest border-b border-stone-200/60 pb-2 mb-1">
              Agent Plan
            </h4>
            {DEMO_PLAN.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-stone-400 mt-0.5" />
                <span className="text-sm tracking-wide text-stone-400 line-through opacity-70">{step}</span>
              </div>
            ))}
          </div>

          <div className="text-sand-900 font-light text-[15px] leading-relaxed tracking-wide space-y-2.5">
            <p>Based on your Q3 product review documents, here are the key findings:</p>
            <p>
              <strong className="font-medium">Customer satisfaction</strong> increased by 12% compared to Q2, driven primarily by improvements in onboarding flow and response time.
            </p>
            <p>
              <strong className="font-medium">Feature adoption</strong> of the new analytics dashboard reached 67% of active users within the first month, exceeding the 50% target.
            </p>
            <p>
              <strong className="font-medium">Churn risk</strong> was identified in 3 enterprise accounts due to unresolved integration issues with their existing CRM systems.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-stone-200/50">
            {DEMO_CITATIONS.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200/60 rounded-xl shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px] text-stone-400">description</span>
                <span className="text-[11px] font-medium text-stone-500 truncate max-w-[140px] uppercase tracking-wider">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
