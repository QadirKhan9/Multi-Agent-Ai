"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface AgentUsage {
  limit: number;
  used: number;
  remaining: number;
  resetTime: string;
}

const AGENT_META: Record<string, { name: string; icon: string; description: string }> = {
  chat: { name: "Chat Agent", icon: "🧠", description: "Llama 3.3 70B & Gemini Flash conversational turns" },
  web_search: { name: "Search Agent", icon: "🔍", description: "Real-time web search with Tavily & DuckDuckGo" },
  image_generation: { name: "Image Agent", icon: "🎨", description: "FLUX & SDXL image generation and Cloudinary hosting" },
  code_generation: { name: "Code Agent", icon: "💻", description: "Code generation and Wandbox sandbox execution" },
  pdf_generation: { name: "PDF Agent", icon: "📄", description: "Markdown synthesis and PDF document creation" },
  voice_generation: { name: "Voice Agent", icon: "🔊", description: "Edge TTS text-to-speech audio synthesis" },
};

export default function UsageDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usage, setUsage] = useState<Record<string, AgentUsage>>({});
  const [resetTime, setResetTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data.agents || {});
        // Get reset time from any agent
        const firstAgent = Object.values(data.agents || {})[0] as AgentUsage | undefined;
        if (firstAgent) setResetTime(firstAgent.resetTime);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchConversations();
      fetchUsage();
    }
  }, [session, fetchConversations, fetchUsage]);

  const handleSelectConversation = (id: string) => {
    router.push(`/dashboard?conv=${id}`);
  };

  const handleNewConversation = () => {
    router.push("/dashboard");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold tracking-tight hidden md:block">Synthox AI</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:block">
            {session.user?.name || session.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeConversationId={null}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={() => {}}
          onRenameConversation={() => {}}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Daily Usage</h2>
                <p className="text-sm text-gray-400">
                  Track your usage metrics and quota consumption across all 6 specialized agents.
                </p>
              </div>
              {resetTime && (
                <div className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-400 flex items-center gap-1.5 self-start sm:self-auto">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Resets at {resetTime}</span>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-5 bg-gray-900 border border-gray-800 rounded-xl space-y-3 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-28 bg-gray-800 rounded" />
                      <div className="h-4 w-12 bg-gray-800 rounded" />
                    </div>
                    <div className="h-2.5 w-full bg-gray-800 rounded-full" />
                    <div className="h-3 w-40 bg-gray-800 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {Object.entries(AGENT_META).map(([key, meta]) => {
                  const agentData = usage[key] || { used: 0, limit: 10, remaining: 10 };
                  const percent = Math.min(100, Math.round((agentData.used / agentData.limit) * 100));
                  const isHigh = percent >= 80;

                  return (
                    <div
                      key={key}
                      className="p-5 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <h3 className="text-sm font-semibold text-white">{meta.name}</h3>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isHigh ? "bg-red-900/50 text-red-300" : "bg-blue-900/50 text-blue-300"
                        }`}>
                          {agentData.used} / {agentData.limit}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isHigh ? "bg-red-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate max-w-[200px]">{meta.description}</span>
                        <span>{agentData.remaining} remaining</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
