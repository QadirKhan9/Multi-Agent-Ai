"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow, { Message } from "@/components/ChatWindow";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load conversation from query parameter if it exists
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const convId = params.get("conv");
      if (convId && convId !== activeConversationId) {
        loadConversation(convId);
        // Clear param to keep URL clean but maintain session state
        window.history.replaceState({}, "", "/dashboard");
      }
    }
  }, [activeConversationId]);

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

  useEffect(() => {
    if (session) {
      fetchConversations();
    }
  }, [session, fetchConversations]);

  const loadConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            agentType: m.agentType,
            createdAt: m.createdAt,
            imageUrl: m.imageUrl,
            sources: m.sources,
            fileUrl: m.fileUrl,
            executionOutput: m.executionOutput,
            audioUrl: m.audioUrl,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const [statusText, setStatusText] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    const tempId = `temp-${Date.now()}`;
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStatusText("Analyzing your request...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: content,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to send message");
      }

      if (!res.body) throw new Error("No response stream received");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentStreamId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === "status") {
              setStatusText(data.status);
            } else if (data.type === "intent") {
              if (data.agentType === "chat") {
                setStatusText(null);
                const streamMsgId = "streaming-assistant-msg";
                currentStreamId = streamMsgId;
                setMessages((prev) => {
                  const filtered = prev.filter((m) => m.id !== streamMsgId);
                  return [
                    ...filtered,
                    {
                      id: streamMsgId,
                      role: "assistant",
                      content: "",
                      agentType: "chat",
                      createdAt: new Date().toISOString(),
                    },
                  ];
                });
              }
            } else if (data.type === "token") {
              setStatusText(null);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === "streaming-assistant-msg" || msg.id === currentStreamId
                    ? { ...msg, content: msg.content + data.token }
                    : msg
                )
              );
            } else if (data.type === "message_done") {
              setStatusText(null);
              setMessages((prev) => {
                const hasExactMsg = prev.some((m) => m.id === data.message.id);
                if (hasExactMsg) {
                  return prev.map((m) => (m.id === data.message.id ? data.message : m));
                }

                const hasStreamPlaceholder = prev.some(
                  (m) => m.id === "streaming-assistant-msg" || m.id === currentStreamId
                );
                if (hasStreamPlaceholder) {
                  return prev.map((m) =>
                    m.id === "streaming-assistant-msg" || m.id === currentStreamId
                      ? data.message
                      : m
                  );
                }

                return [...prev, data.message];
              });
              currentStreamId = null;
            } else if (data.type === "done") {
              if (data.conversationId) {
                setActiveConversationId(data.conversationId);
              }
              fetchConversations();
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${(err as Error).message}`,
          status: "error",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStatusText(null);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
        );
      }
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
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

  if (!session) {
    return null;
  }

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
          activeConversationId={activeConversationId}
          onSelectConversation={loadConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            statusText={statusText}
          />
        </main>
      </div>
    </div>
  );
}
