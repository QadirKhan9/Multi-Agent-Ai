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

interface Memory {
  id: string;
  memoryText: string;
  createdAt: string;
}

export default function MemoryDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchConversations();
      fetchMemories();
    }
  }, [session, fetchConversations, fetchMemories]);

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

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
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Long-Term Memory</h2>
              <p className="text-sm text-gray-400">
                These are facts, preferences, and details Synthox AI has learned about you across your conversations. You can delete items you no longer want it to remember.
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : memories.length === 0 ? (
              <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-md font-semibold text-gray-400 mb-1">No memories saved yet</h3>
                <p className="text-sm text-gray-600 max-w-sm">
                  Start chatting with the assistant and share facts about yourself (e.g. your stack, project goals) to populate this list.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {memories.map((mem) => (
                  <div 
                    key={mem.id}
                    className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm text-gray-200">{mem.memoryText}</p>
                      <p className="text-xs text-gray-500">Learned on {new Date(mem.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="p-2 rounded-lg bg-gray-800/50 hover:bg-red-950/40 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete Memory"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
