"use client";

import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
     return <div className="min-h-screen bg-pearl-50 flex items-center justify-center">
       <div className="size-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
     </div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-pearl-50">
      <Sidebar />
      <main className="flex-1 h-full relative border-l border-stone-200/60 pt-0 lg:pt-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
