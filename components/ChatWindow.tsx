"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentType?: string;
  createdAt: string;
  status?: "success" | "stub" | "error";
  imageUrl?: string;
  sources?: any;
  executionOutput?: string | null;
  fileUrl?: string | null;
  audioUrl?: string | null;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  statusText?: string | null;
}

const AGENT_LABELS: Record<string, string> = {
  chat: "🧠 Chat",
  image_generation: "🎨 Image",
  pdf_generation: "📄 PDF",
  code_generation: "💻 Code",
  web_search: "🔍 Search",
  voice_generation: "🔊 Voice",
  unknown: "⚠️ Unknown",
};

export default function ChatWindow({ messages, onSendMessage, isLoading, statusText }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null); // id of message audio currently loading
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({}); // msgId -> audioUrl
  const activeBlobUrlRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReadAloud = async (msg: Message) => {
    // If audioUrl already cached (generated previously or returned from API), use it
    if (audioUrls[msg.id] || msg.audioUrl) {
      setAudioUrls(prev => ({ ...prev, [msg.id]: prev[msg.id] || msg.audioUrl! }));
      return;
    }
    setSpeakingMsgId(msg.id);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id, text: msg.content.replace(/```[\s\S]*?```/g, '').trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrls(prev => ({ ...prev, [msg.id]: data.audioUrl }));
      }
    } catch (error) {
      console.error('[ChatWindow] Voice generation failed:', error);
    } finally {
      setSpeakingMsgId(null);
    }
  };

  // Convert a data: URI → blob: URL so the iframe can render it (browsers block data: in iframes)
  const openPdfModal = (fileUrl: string) => {
    // Revoke any previous blob URL
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    if (fileUrl.startsWith('data:')) {
      const arr = fileUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const binaryStr = atob(arr[1]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = blobUrl;
      setPdfModalUrl(blobUrl);
    } else {
      setPdfModalUrl(fileUrl);
    }
  };

  const closePdfModal = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    setPdfModalUrl(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenPdf = (dataUri: string) => {
    try {
      if (dataUri.startsWith('data:')) {
        const arr = dataUri.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], {type: mime});
        const url = URL.createObjectURL(blob);
        
        // Open in new tab instead of forcing download
        window.open(url, '_blank');
        
        // Clean up URL after the new tab has had time to load it
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        window.open(dataUri, '_blank');
      }
    } catch (err) {
      console.error("Error opening PDF:", err);
    }
  };

  const handleDownloadImage = async (url: string) => {
    try {
      // Fetch the image as a blob to bypass cross-origin download restrictions
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `synthox-image.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error('Image download failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 select-none">
            <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-400 mb-1">Start a conversation</h3>
            <p className="text-sm text-gray-600">Send a message to begin chatting with Synthox AI</p>
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isStub = msg.status === "stub";
          
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              {!isUser && msg.agentType && (
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isStub ? "bg-gray-800 text-gray-400" : "bg-blue-900/50 text-blue-300"}`}>
                    {AGENT_LABELS[msg.agentType] || AGENT_LABELS.unknown}
                  </span>
                  {/* Speaker button for on-demand read-aloud */}
                  {!isStub && msg.agentType !== 'image_generation' && msg.agentType !== 'pdf_generation' && (
                    <button
                      title="Read aloud"
                      onClick={() => handleReadAloud(msg)}
                      disabled={speakingMsgId === msg.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800/80 border border-gray-700/80 text-gray-300 hover:text-blue-400 hover:bg-gray-800 hover:border-blue-500/50 disabled:opacity-50 disabled:cursor-wait transition-all shadow-sm"
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span className="text-blue-400">Generating audio...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M5.5 8.5a8 8 0 000 7" />
                          </svg>
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-blue-600 text-white rounded-br-md whitespace-pre-wrap"
                    : isStub
                      ? "bg-gray-800 text-gray-400 border border-gray-700 rounded-bl-md italic border-dashed whitespace-pre-wrap"
                      : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-md"
                }`}
              >
                {/* Content rendering using ReactMarkdown for assistant messages */}
                {!isUser && !isStub ? (
                  <div className="markdown-content space-y-3 break-words">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}: any) => <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
                        h2: ({node, ...props}: any) => <h2 className="text-lg font-semibold mt-3 mb-2 text-blue-300" {...props} />,
                        h3: ({node, ...props}: any) => <h3 className="text-base font-semibold mt-2 mb-1 text-gray-200" {...props} />,
                        p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}: any) => <li className="" {...props} />,
                        strong: ({node, ...props}: any) => <strong className="font-bold text-white" {...props} />,
                        a: ({node, ...props}: any) => <a className="text-blue-400 hover:text-blue-300 hover:underline" target="_blank" rel="noreferrer" {...props} />,
                        img: ({node, ...props}: any) => (
                          <span className="inline-block relative w-32 h-32 md:w-40 md:h-40 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 m-1 align-top shadow-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img {...props} className="object-cover w-full h-full hover:scale-105 transition-transform duration-300" alt={props.alt || "Image"} />
                          </span>
                        ),
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeText = String(children).replace(/\n$/, '');
                          const blockId = `${msg.id}-${match?.[1] || 'code'}`;
                          
                          return !inline && match ? (
                            <div className="relative group mt-2 mb-2 rounded-md overflow-hidden border border-gray-700">
                              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900 text-xs text-gray-400 border-b border-gray-700">
                                <span>{match[1]}</span>
                                <button 
                                  onClick={() => copyToClipboard(codeText, blockId)}
                                  className="hover:text-white transition-colors flex items-center gap-1"
                                >
                                  {copiedCode === blockId ? (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      <span className="text-green-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                      <span>Copy code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <SyntaxHighlighter
                                {...props}
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '1rem', background: '#1e1e1e', fontSize: '0.85rem' }}
                              >
                                {codeText}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code {...props} className="bg-gray-700 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
                
                {/* Code Execution Output UI */}
                {msg.agentType === 'code_generation' && msg.executionOutput && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Execution Output
                    </p>
                    <div className="bg-black/50 border border-gray-700 rounded-md p-3 overflow-x-auto">
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{msg.executionOutput}</pre>
                    </div>
                  </div>
                )}

                {/* PDF Generation UI */}
                {msg.agentType === 'pdf_generation' && msg.fileUrl && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded bg-red-900/30 text-red-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">Generated_Document.pdf</p>
                        <p className="text-xs text-gray-400">PDF Document</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button 
                        onClick={() => openPdfModal(msg.fileUrl!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View PDF
                      </button>
                      <a 
                        href={msg.fileUrl} 
                        download="Synthox_Document.pdf"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Image Generation UI */}
                {msg.agentType === 'image_generation' && msg.imageUrl && (
                  <div className="mt-3 relative w-full max-w-sm rounded-xl overflow-hidden border border-gray-700 bg-gray-900 group">
                    <div className="relative aspect-square">
                      {/* Loading shimmer — hidden once image loads */}
                      <div
                        id={`img-loader-${msg.id}`}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900 z-10"
                      >
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Generating image…</span>
                      </div>
                      {/* Error overlay — shown on failure */}
                      <div
                        id={`img-error-${msg.id}`}
                        className="absolute inset-0 hidden flex-col items-center justify-center gap-2 bg-gray-900 z-10"
                      >
                        <span className="text-2xl">🖼️</span>
                        <span className="text-xs text-gray-400 text-center px-4">Image failed to load.<br/>The URL may have expired.</span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.imageUrl}
                        alt="Generated"
                        className="object-cover w-full h-full opacity-0 transition-opacity duration-500 cursor-zoom-in"
                        onClick={() => setImageModalUrl(msg.imageUrl!)}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).classList.remove('opacity-0');
                          const loader = document.getElementById(`img-loader-${msg.id}`);
                          if (loader) loader.style.display = 'none';
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const loader = document.getElementById(`img-loader-${msg.id}`);
                          if (loader) loader.style.display = 'none';
                          const errEl = document.getElementById(`img-error-${msg.id}`);
                          if (errEl) errEl.style.display = 'flex';
                        }}
                      />
                      {/* Hover overlay — download button + click hint */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3 z-20 pointer-events-none">
                        <span className="text-white/70 text-xs">Click to expand</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadImage(msg.imageUrl!); }}
                          title="Download image"
                          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 text-white text-xs font-medium transition-all duration-200 hover:scale-105"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Web Search Sources UI */}
                {msg.agentType === 'web_search' && msg.sources && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Sources Used
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {msg.sources.map((src: any, idx: number) => (
                        <a 
                          key={idx} 
                          href={src.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 truncate"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {/* Voice Agent Audio Player UI */}
                {!isUser && (audioUrls[msg.id] || msg.audioUrl) && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M5.5 8.5a8 8 0 000 7" /></svg>
                      Audio
                    </p>
                    <audio
                      controls
                      src={audioUrls[msg.id] || msg.audioUrl!}
                      className="w-full rounded-lg h-10"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start transition-all duration-300">
            <div className="flex items-center gap-2 mb-1 ml-1">
              <span className="text-xs text-blue-400 font-medium animate-pulse">
                {statusText || "Analyzing your request..."}
              </span>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-800 p-4 bg-gray-900/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </form>
      </div>

      {/* PDF Modal Viewer */}
      {pdfModalUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/90">
              <div className="flex items-center gap-2 text-white font-medium">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Document Viewer
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={pdfModalUrl} 
                  download="Synthox_Document.pdf" 
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 text-sm" 
                  title="Download PDF"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">Download</span>
                </a>
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
                <button 
                  onClick={closePdfModal} 
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 hover:text-red-400 rounded-lg transition-colors"
                  title="Close Viewer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body - Iframe */}
            <div className="flex-1 w-full bg-gray-100">
              <iframe 
                src={pdfModalUrl} 
                className="w-full h-full border-none" 
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Modal Viewer */}
      {imageModalUrl && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setImageModalUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex items-center justify-between px-2 pb-3">
              <span className="text-white/70 text-sm">Generated Image</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(imageModalUrl)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <a
                  href={imageModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
                <div className="w-px h-5 bg-white/20" />
                <button
                  onClick={() => setImageModalUrl(null)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageModalUrl}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
