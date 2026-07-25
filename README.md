# Synthox AI — Multi-Agent AI Assistant Platform

> A single web interface where an intelligent Router Agent delegates your requests to specialized AI capabilities — Chat, Web Search, Image Generation, Code Execution, PDF Export, and Voice Speech — all with persistent long-term memory and zero subscription costs.

---

## 🌟 Screenshots & Demo

![Synthox AI Dashboard Overview](https://www.linkedin.com/posts/abdul-qadir-khan-9b32a22bb_ai-webdevelopment-nextjs-activity-7486796841338966017-0VT4?utm_source=share&utm_medium=member_desktop&rcm=ACoAAEzARRcBMC0HpGrVlUVZGOU0j0hn3HLsCE0)
---

## ✨ Features

- 🧠 **Intelligent Intent Router**: Automatically analyzes user intent (using Groq / Llama 3.3 70B) and routes requests to the optimal specialized agent.
- 💬 **Streaming Chat Agent**: Real-time word-by-word streaming responses powered by Groq Llama 3.3 70B with automatic fallback to Gemini 2.5 Flash.
- 🔍 **Real-Time Web Search Agent**: Synthesizes current web info using Tavily API with automatic fallback to DuckDuckGo and Google Images.
- 🎨 **Image Generation Agent**: Creates high-resolution images via Pollinations.ai FLUX model with Stable Diffusion XL fallback, saved automatically to Cloudinary.
- 💻 **Code Generation & Execution Agent**: Generates syntax-highlighted code and sandboxes execution via Wandbox/Judge0, featuring an auto-debugging loop that fixes compilation/runtime errors autonomously.
- 📄 **PDF Document Exporter**: Synthesizes conversations into structured PDF documents rendered with `pdf-lib` (100% serverless ready).
- 🔊 **Voice Speech Agent**: Text-to-speech synthesis using Microsoft Edge TTS with Google Translate TTS fallback, allowing on-demand audio playback for any message.
- 💾 **Vector Long-Term Memory**: Persistent memory across separate conversations powered by PostgreSQL `pgvector` and 768-dimensional embeddings.
- 🛡️ **System-Wide Fallback & Daily Rate Limiting**: Shared `withFallback` runner and Redis/in-memory rate limiting per user per agent.
- 📊 **Usage Dashboard**: Real-time tracking of daily quota consumption across all 6 specialized agents.
- 🩺 **Health Check API**: Instant system status and database ping latency verification via `/api/health`.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([User Request]) --> Router[Router Agent - Llama 3.3 70B]
    Router --> |Classify Intent| Dispatcher[Dispatcher & Rate Limiter]
    
    subgraph Memory Layer
        Memory[pgvector Store] --> |Retrieve Top-K Facts| Router
    end

    subgraph Agents
        Dispatcher --> |chat| Chat[Chat Agent - Groq / Gemini]
        Dispatcher --> |web_search| Search[Search Agent - Tavily / DDG]
        Dispatcher --> |image_generation| Image[Image Agent - Pollinations / SDXL]
        Dispatcher --> |code_generation| Code[Code Agent - Wandbox / Judge0]
        Dispatcher --> |pdf_generation| PDF[PDF Agent - pdf-lib]
        Dispatcher --> |voice_generation| Voice[Voice Agent - Edge TTS / Google]
    end

    subgraph Storage & Cloud Services
        Image --> Cloudinary[(Cloudinary Storage)]
        Voice --> Cloudinary
        Memory --> Neon[(PostgreSQL / pgvector DB)]
    end
```

---

## 🛠️ Tech Stack

| Component | Technology / Service |
|---|---|
| **Framework** | Next.js 14+ / 16 App Router (TypeScript) |
| **Styling** | Tailwind CSS |
| **Authentication** | NextAuth.js (Auth.js v5 JWT strategy) |
| **Database & ORM** | PostgreSQL (Neon / Supabase), Prisma ORM |
| **Vector Engine** | `pgvector` extension (768d cosine distance) |
| **Primary LLM** | Groq (Llama 3.3 70B) |
| **Fallback LLM** | Google Gemini (Gemini 2.5 Flash) |
| **Embeddings** | Gemini `text-embedding-004` (Fallback: HuggingFace `all-mpnet-base-v2`) |
| **Web Search** | Tavily Search API (Fallback: DuckDuckGo) |
| **Image Generation** | Pollinations.ai FLUX (Fallback: Stable Diffusion XL) |
| **Code Execution** | Wandbox API / Judge0 API |
| **PDF Rendering** | `pdf-lib` (Pure JS, serverless ready) |
| **Text-to-Speech** | `msedge-tts` (Fallback: Google Translate TTS) |
| **Cloud Storage** | Cloudinary |
| **Rate Limiter** | Redis (`ioredis`) with in-memory Map fallback |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.x or higher
- PostgreSQL database with `pgvector` extension enabled (e.g. Neon, Supabase, or local PG)

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in the required keys:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Auth
NEXTAUTH_SECRET="generate-secret-with-npx-auth-secret"
NEXTAUTH_URL="http://localhost:3000"

# LLM Keys
GROQ_API_KEY="your_groq_key"
GEMINI_API_KEY="your_gemini_key"

# Search & Fallbacks
TAVILY_API_KEY="your_tavily_key"
HUGGINGFACE_API_KEY="your_hf_key"

# Storage
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"

# Optional Redis for multi-instance Rate Limiting
REDIS_URL="redis://localhost:6379"
```

### 3. Database Migration & Setup
Run the following commands to set up database schemas and generate the Prisma Client:

```bash
# Push schema changes to your database
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

Ensure `pgvector` extension is enabled on your PostgreSQL instance:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX ON "UserMemory" USING ivfflat (embedding vector_cosine_ops);
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment Guide (Vercel + Supabase / Neon)

1. **Push Code to GitHub**.
2. **Deploy to Vercel**: Connect your GitHub repository to Vercel.
3. **Configure Environment Variables in Vercel Dashboard**:
   - Add `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, `HUGGINGFACE_API_KEY`, and `CLOUDINARY_URL`.
4. **Health Check**: Once deployed, visit `https://your-domain.vercel.app/api/health` to confirm database connectivity and app status.

---

## 🔮 Future Roadmap

- 🧩 **Custom Agent Builder**: Allow users to create custom agents with specific system prompts and tool bindings.
- 👁️ **Multi-Modal Vision Input**: Image attachment analysis in chat turns.
- 👥 **Team Workspaces & Shared Memories**: Collaborate with team members with shared long-term memory pools.
- 📊 **Token & Cost Tracking Dashboard**: Detailed breakdown of token usage and estimated cost savings.

---

## 📄 License
MIT License.
