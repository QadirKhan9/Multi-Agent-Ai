"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onClose,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pathname = usePathname();

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleConfirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirmRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditTitle("");
    }
  };

  const handleDelete = (id: string) => {
    onDeleteConversation(id);
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          background: "rgba(11,11,18,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-white text-sm tracking-tight">Synthox AI</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat button */}
        <div className="p-3 pb-1">
          <button
            onClick={() => {
              if (pathname === "/dashboard/memory") {
                window.location.href = "/dashboard";
              } else {
                onNewConversation();
              }
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)"
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>

        {/* AI Memory Nav link */}
        <div className="px-3 py-1">
          <Link
            href={pathname === "/dashboard/memory" ? "#" : "/dashboard/memory"}
            className={`w-full flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              pathname === "/dashboard/memory"
                ? "text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
            style={{
              background: pathname === "/dashboard/memory" ? "rgba(99, 102, 241, 0.15)" : undefined,
              border: pathname === "/dashboard/memory" ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent"
            }}
            onClick={onClose}
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Memory
          </Link>
        </div>

        {/* Daily Usage Nav link */}
        <div className="px-3 pt-1 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link
            href={pathname === "/dashboard/usage" ? "#" : "/dashboard/usage"}
            className={`w-full flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              pathname === "/dashboard/usage"
                ? "text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
            style={{
              background: pathname === "/dashboard/usage" ? "rgba(99, 102, 241, 0.15)" : undefined,
              border: pathname === "/dashboard/usage" ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent"
            }}
            onClick={onClose}
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 012 2h2a2 2 0 002-2z" />
            </svg>
            Daily Usage
          </Link>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 mt-2">
          {conversations.length === 0 && (
            <div className="text-center py-10 px-2 space-y-2">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-500">
                💬
              </div>
              <p className="text-xs font-semibold text-zinc-400">Start your first conversation</p>
              <p className="text-[11px] text-zinc-600">Ask a question, generate images, or write code to begin.</p>
            </div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative flex items-center rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                activeConversationId === conv.id
                  ? "text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
              style={{
                background: activeConversationId === conv.id ? "rgba(255,255,255,0.06)" : undefined,
                border: activeConversationId === conv.id ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent"
              }}
              onClick={() => {
                if (!editingId && !deletingId) {
                  if (pathname === "/dashboard/memory") {
                    window.location.href = `/dashboard?conv=${conv.id}`;
                  } else {
                    onSelectConversation(conv.id);
                  }
                  onClose();
                }
              }}
            >
              {editingId === conv.id ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleConfirmRename}
                  autoFocus
                  className="flex-1 bg-zinc-800 text-white text-sm rounded px-2 py-1 outline-none ring-1 ring-indigo-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : deletingId === conv.id ? (
                <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-red-400">Delete?</span>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-500"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded hover:bg-gray-600"
                  >
                    No
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{conv.title}</p>
                    <p className="text-xs text-gray-600">{formatDate(conv.updatedAt)}</p>
                  </div>
                  {/* Action buttons */}
                  <div className="hidden group-hover:flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRename(conv); }}
                      className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(conv.id); }}
                      className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
