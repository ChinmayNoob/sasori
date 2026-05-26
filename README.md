# Sasori - System Architecture



## Table of Contents

1. [What is Sasori?](#1-what-is-sasori)
2. [System Overview](#2-system-overview)
3. [Core Concepts](#3-core-concepts)
4. [The RAG Pipeline - Document Ingestion](#4-the-rag-pipeline---document-ingestion)
5. [The Query Flow - How a Question Gets Answered](#5-the-query-flow---how-a-question-gets-answered)
6. [The ReAct Agent Loop](#6-the-react-agent-loop)
7. [Real-Time Streaming (SSE)](#7-real-time-streaming-sse)
8. [Data Model](#8-data-model)
9. [Infrastructure and Services](#9-infrastructure-and-services)
10. [Monorepo Structure](#10-monorepo-structure)
11. [Key Decisions and Tradeoffs](#11-key-decisions-and-tradeoffs)
12. [What I Know vs What I Learned](#12-what-i-know-vs-what-i-learned)

---

## 1. What is Sasori?

Sasori is a RAG (Retrieval-Augmented Generation) application that:

1. Syncs your Google Drive documents
2. Chunks them into small pieces and converts each piece into a vector (embedding)
3. Stores those vectors in a vector database (Qdrant)
4. When you ask a question, an AI agent searches your documents, reasons through the results, and gives you a cited answer

**The three phases of RAG:**

| Phase | What Happens | Where in Sasori |
|-------|-------------|-----------------|
| **Prepare** | Documents are chunked, embedded, stored in vector DB | `worker-drive-fetch` + `worker-drive-vectorize` |
| **Search** | User question is embedded, semantically similar chunks are found | `driveRetrieveTool` + Qdrant |
| **Answer** | Retrieved chunks + question are given to LLM to generate answer | ReAct agent loop in `loop.ts` |

**Why RAG instead of fine-tuning?** Fine-tuning teaches a model a *style*, not *facts*. If you fine-tuned on your documents, the model would sound like them but hallucinate specifics. RAG gives the model the actual text to read before answering.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                       │
│                                                                 │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────────┐  │
│  │PostgreSQL│  │  Redis  │  │ Qdrant  │  │ OpenAI / Tavily  │  │
│  │  (DB)    │  │(Streams)│  │(Vectors)│  │   (LLM APIs)     │  │
│  └──────────┘  └─────────┘  └─────────┘  └──────────────────┘  │
│        ▲            ▲            ▲               ▲              │
└────────┼────────────┼────────────┼───────────────┼──────────────┘
         │            │            │               │
┌────────┼────────────┼────────────┼───────────────┼──────────────┐
│        │            │            │               │              │
│  ┌─────┴─────┐ ┌────┴────┐ ┌────┴─────┐ ┌──────┴──────┐       │
│  │           │ │         │ │          │ │             │       │
│  │  Server   │ │  Fetch  │ │Vectorize │ │    Web      │       │
│  │ (Express) │ │ Worker  │ │  Worker  │ │  (Next.js)  │       │
│  │  :3001    │ │         │ │          │ │   :3000     │       │
│  │           │ │         │ │          │ │             │       │
│  └─────┬─────┘ └────┬────┘ └────┬─────┘ └──────┬──────┘       │
│        │            │           │              │               │
│        └──── HTTP ──┘           └──────────────┘               │
│                                                                 │
│                     SASORI APPLICATION                          │
└─────────────────────────────────────────────────────────────────┘
```

### How Services Communicate

```mermaid
graph LR
    Web["apps/web<br/>(Next.js)"]
    Server["apps/server<br/>(Express)"]
    FetchW["worker-drive-fetch<br/>(Node loop)"]
    VecW["worker-drive-vectorize<br/>(Node loop)"]
    PG[("PostgreSQL")]
    Redis[("Redis<br/>Streams")]
    Qdrant[("Qdrant<br/>Vector DB")]
    OpenAI(("OpenAI<br/>API"))

    Web -- "HTTP REST + SSE" --> Server
    Server -- "read/write" --> PG
    Server -- "enqueue jobs" --> Redis
    Server -- "embed query" --> OpenAI
    Server -- "search vectors" --> Qdrant

    FetchW -- "xReadGroup (poll)" --> Redis
    FetchW -- "read/write" --> PG
    FetchW -- "enqueue next job" --> Redis
    FetchW -- "Google Drive API" --> GDrive(("Google<br/>Drive"))

    VecW -- "xReadGroup (poll)" --> Redis
    VecW -- "read/write" --> PG
    VecW -- "embed chunks" --> OpenAI
    VecW -- "upsert vectors" --> Qdrant
```

**Key principle:** The web frontend never touches PostgreSQL, Qdrant, or Redis directly. The Express server acts as a single gateway (Backend-For-Frontend pattern). This keeps the frontend simple and lets you swap databases without touching UI code.

---

## 3. Core Concepts

### 3.1 Embeddings

An embedding turns text into an array of ~1536 floating-point numbers that capture the *semantic meaning* of the text.

```
"Q3 revenue grew 12%"  →  [0.023, -0.041, 0.892, 0.156, ..., -0.034]  (1536 numbers)
"Sales increased 12%"  →  [0.019, -0.038, 0.887, 0.149, ..., -0.031]  (very similar!)
"The cat sat on a mat" →  [0.412, 0.891, -0.233, 0.056, ..., 0.778]   (very different)
```

If two pieces of text have similar meaning, their vectors point in similar directions in 1536-dimensional space.

**Model used:** `text-embedding-3-small` (OpenAI)

### 3.2 Cosine Similarity

Qdrant uses **Cosine similarity** to compare vectors. It measures the *angle* between two vectors:

```
Cosine Similarity = 1.0  →  Identical meaning
Cosine Similarity = 0.5  →  Loosely related
Cosine Similarity = 0.0  →  Unrelated
Cosine Similarity = -1.0 →  Opposite meaning
```

**Why not Euclidean distance?** Cosine measures *direction* (meaning), Euclidean measures *magnitude* (length). Two sentences with the same meaning but different lengths would have different Euclidean distances but similar cosine similarity. Think of it as arrows - two arrows pointing the same direction = same meaning, regardless of their length.

### 3.3 Score Threshold (0.4)

In `driveRetrieveTool`, we use `score_threshold: 0.4`. This controls the precision-recall tradeoff:

| Threshold | Behavior |
|-----------|----------|
| **0.9** | Strict - only near-identical matches. Misses many useful results. |
| **0.4** | Moderate - accepts remotely related content. Good balance. |
| **0.0** | Loose - returns everything including garbage. |

### 3.4 Chunking

Documents are split into chunks of **800 tokens** with **100-token overlap** using tiktoken's `cl100k_base` encoding.

```
Document: "The quick brown fox jumps over the lazy dog. The dog barked..."
                                   
Chunk 0: [token 0 ──────── 799] + [token 700 ── 799]  ← overlap  
Chunk 1:            [token 700 ── 799] + [token 800 ──────── 1599] + [overlap]  
Chunk 2:                                          [overlap] + [token 1500 ──── 2399]
```

**Why 800 tokens?** Small enough to be semantically focused (a chunk about "revenue" won't also contain paragraphs about "hiring"). Large enough to carry meaningful context. At 100 tokens you'd shred sentences mid-thought. At 4000 you'd have too many topics per chunk - the embedding would be a blur.

**Why 100-token overlap?** Prevents losing information at boundaries. If a key sentence straddles two chunks, the overlap ensures it appears whole in at least one.

**Why prepend the file title?** Each chunk is embedded as `"Title: filename.pdf\n\n{chunk text}"`. This gives the embedding model context about *what document* this chunk belongs to. Without it, a chunk saying "revenue grew 12%" has no idea if it's from the Q3 report or the annual plan.

---

## 4. The RAG Pipeline - Document Ingestion

This is how a Google Drive file goes from a file to a searchable vector.

### Full Ingestion Flow

```mermaid
sequenceDiagram
    participant User
    participant Server as Server (Express)
    participant PG as PostgreSQL
    participant Redis as Redis Streams
    participant FetchW as worker-drive-fetch
    participant VecW as worker-drive-vectorize
    participant Qdrant as Qdrant
    participant OpenAI as OpenAI API
    participant Drive as Google Drive API

    User->>Server: POST /drive/sync
    Server->>Drive: List files (Google Drive API)
    Drive-->>Server: File list

    loop For each supported file
        Server->>PG: INSERT/UPDATE drive_files<br/>(ingestionPhase: "discovered")
        Server->>Redis: XADD drive_fetch:0<br/>{userId, fileId}
    end

    Server-->>User: {summary: {totalFound, supportedCount}}

    Note over FetchW: Worker polls Redis continuously
    FetchW->>Redis: XREADGROUP drive_fetch:0
    Redis-->>FetchW: {userId, fileId}

    FetchW->>PG: UPDATE drive_files<br/>(ingestionPhase: "fetching")
    FetchW->>Drive: Download file content
    Drive-->>FetchW: File buffer

    FetchW->>FetchW: Extract text<br/>(PDF → pdfjs, DOCX → mammoth,<br/>Google Docs → export as text/plain)

    FetchW->>PG: INSERT/UPDATE raw_documents<br/>(extracted text + SHA-256 hash)
    FetchW->>PG: UPDATE drive_files<br/>(ingestionPhase: "chunk_pending")
    FetchW->>Redis: XADD drive_vectorize:0<br/>{userId, fileId}
    FetchW->>Redis: XACK drive_fetch:0

    Note over VecW: Worker polls Redis continuously
    VecW->>Redis: XREADGROUP drive_vectorize:0
    Redis-->>VecW: {userId, fileId}

    VecW->>PG: UPDATE drive_files<br/>(ingestionPhase: "vectorizing")
    VecW->>PG: SELECT text FROM raw_documents

    VecW->>VecW: Chunk text<br/>(800 tokens, 100 overlap)

    loop Batch of 50 chunks
        VecW->>OpenAI: Create embeddings<br/>(text-embedding-3-small)
        OpenAI-->>VecW: 1536-dim vectors
        VecW->>Qdrant: UPSERT points<br/>(vectors + metadata)
        VecW->>PG: INSERT chunks<br/>(text + qdrantPointId)
    end

    VecW->>PG: UPDATE drive_files<br/>(ingestionPhase: "indexed")
    VecW->>Redis: XACK drive_vectorize:0
```

### Ingestion State Machine

Each file goes through a well-defined state machine. This gives observability and retry precision.

```mermaid
stateDiagram-v2
    [*] --> discovered: File found in Drive sync
    discovered --> fetching: Fetch worker picks up job
    fetching --> chunk_pending: Text extracted, saved to raw_documents
    chunk_pending --> vectorizing: Vectorize worker picks up job
    vectorizing --> indexed: Chunks embedded + stored in Qdrant

    discovered --> failed: Unsupported MIME / too large
    fetching --> failed: Download error (permanent)
    fetching --> discovered: Retryable error (re-queued)
    vectorizing --> failed: Embedding error (permanent)
    vectorizing --> chunk_pending: Retryable error (re-queued)
    failed --> discovered: Manual retry (no raw text)
    failed --> chunk_pending: Manual retry (raw text exists)
    indexed --> discovered: File modified in Drive (stale)

    note right of discovered: Entry state
    note right of indexed: Ready for search
    note right of failed: Needs manual retry
```

**Why not just a boolean `isIndexed`?** With 6 states, you know *exactly* where ingestion failed. If a file is stuck at "fetching", the fetch worker crashed. If stuck at "vectorizing", the embedding API had issues. A boolean would tell you it failed, but not whether to retry from fetch or from vectorize.

### Retry Logic

```mermaid
flowchart TD
    A[Job fails] --> B{HTTP status 4xx?}
    B -->|Yes| C[Permanent failure]
    B -->|No| D{retryCount >= 2?}
    D -->|Yes| C
    D -->|No| E[Increment retryCount]
    E --> F[Re-enqueue with exponential backoff<br/>2s → 4s → 8s]
    C --> G[Set ingestionPhase: "failed"]
    G --> H["Manual retry via POST /drive/files/:id/retry"]
    H --> I{raw_documents exists?}
    I -->|Yes| J[Reset to chunk_pending<br/>Re-enqueue vectorize]
    I -->|No| K[Reset to discovered<br/>Re-enqueue fetch]
```

### File Types Supported

| MIME Type | Extraction Method |
|-----------|------------------|
| `application/pdf` | `pdfjs-dist` - extracts text per page |
| `application/vnd.google-apps.document` | Google Drive export as `text/plain` |
| `application/vnd.google-apps.spreadsheet` | Google Drive export as `text/csv` |
| `application/vnd.google-apps.presentation` | Google Drive export as `text/plain` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth` - DOCX to text |
| `text/*`, `application/json`, `application/csv` | Direct UTF-8 decode |

Files are truncated at **100,000 characters** to prevent runaway memory usage.

---

## 5. The Query Flow - How a Question Gets Answered

This is the main user-facing flow - from asking a question to getting a cited answer.

```mermaid
sequenceDiagram
    participant User
    participant Web as Frontend (Next.js)
    participant Server as Server (Express)
    participant PG as PostgreSQL
    participant Redis as Redis
    participant Agent as ReAct Agent Loop
    participant OpenAI as OpenAI API
    participant Qdrant as Qdrant
    participant Tavily as Tavily (Web Search)

    User->>Web: Types a question
    Web->>Server: POST /chats/:chatId/messages<br/>{content: "What did Q3 report say?"}
    Server->>PG: INSERT chat_messages (user message)
    Server->>PG: INSERT agent_tasks<br/>(status: "pending")
    Server-->>Web: {messageId, taskId}

    Note over Web: Frontend immediately opens SSE connection
    Web->>Server: GET /sse/agent/:taskId

    Note over Agent: Server runs agent in background<br/>(not awaited)
    Server->>Agent: runAgentTask(taskId)
    Agent->>PG: UPDATE agent_tasks<br/>(status: "running")
    Agent->>Redis: APPEND event {type: "start"}
    Agent->>Redis: APPEND event {type: "plan"}

    Note over Agent: === ReAct Loop Starts ===

    Agent->>OpenAI: callPlannerLLM (trajectory history)
    OpenAI-->>Agent: {action: "plan", plan_steps: [...]}

    Agent->>Redis: APPEND event {type: "step_complete"}

    Agent->>OpenAI: callPlannerLLM
    OpenAI-->>Agent: {action: "call_tool",<br/>tool: "drive_retrieve",<br/>tool_query: "Q3 revenue"}

    Agent->>Redis: APPEND event {type: "step_executing"}

    Note over Agent: drive_retrieve tool executes
    Agent->>OpenAI: Embed query
    OpenAI-->>Agent: 1536-dim vector
    Agent->>Qdrant: Search vectors<br/>(filter: userId, threshold: 0.4)
    Qdrant-->>Agent: Top K hits with scores
    Agent->>PG: SELECT chunk text from chunks table
    Agent->>Agent: Group by file, top 2 per file, cap at 5
    Agent->>Redis: APPEND event {type: "step_complete",<br/>observationSummary: "..."}

    Agent->>OpenAI: callPlannerLLM (trajectory + tool result)
    OpenAI-->>Agent: {action: "final_answer",<br/>final_answer_markdown: "Based on Q3 report..."}

    Agent->>Redis: APPEND event {type: "finish",<br/>finalAnswerMarkdown, citations}

    Note over Agent: === ReAct Loop Ends ===

    Agent->>PG: INSERT chat_messages (assistant message)
    Agent->>PG: UPDATE agent_tasks<br/>(status: "completed")

    Note over Web: SSE receives "finish" event
    Web-->>User: Shows answer with citations
```

### What Happens When Drive Returns Nothing

```mermaid
flowchart TD
    A[User asks question] --> B[Agent calls drive_retrieve]
    B --> C{Results found?}
    C -->|Yes| D[Agent calls final_answer<br/>using Drive citations]
    C -->|No| E["Agent calls web_search (Tavily)"]
    E --> F{Web results useful?}
    F -->|Yes| G[Agent may call web_scrape<br/>for full page text]
    F -->|No| H[Agent calls final_answer<br/>with whatever context exists]
    G --> I[Agent calls final_answer<br/>using web sources]
```

---

## 6. The ReAct Agent Loop

The agent uses the **ReAct (Reason + Act)** pattern: it thinks, picks a tool, observes the result, then thinks again.

### Loop Flow

```mermaid
flowchart TD
    Start([User question + history]) --> Init[Build system prompt +<br/>trajectory history]
    Init --> Plan[Step 1: LLM outputs plan]

    Plan --> Think[LLM thinks: what tool to call?]
    Think --> Decision{LLM decides action}

    Decision -->|call_tool: drive_retrieve| DR[Execute drive_retrieve]
    Decision -->|call_tool: web_search| WS[Execute web_search]
    Decision -->|call_tool: web_scrape| SC[Execute web_scrape]
    Decision -->|final_answer| Done([Return answer + citations])
    Decision -->|Invalid JSON| Retry[Feed error back to LLM]

    DR --> Observe1[Observation fed back to trajectory]
    WS --> Observe2[Observation fed back to trajectory]
    SC --> Observe3[Observation fed back to trajectory]
    Retry --> Think

    Observe1 --> Check{Step <= 7?<br/>Time < 120s?}
    Observe2 --> Check
    Observe3 --> Check

    Check -->|Yes| Think
    Check -->|No: max steps| Timeout([Return best effort answer])
    Check -->|No: timeout| Timeout
```

### Available Tools

| Tool | Purpose | When Called |
|------|---------|-------------|
| `drive_retrieve` | Semantic search over user's Google Drive documents | **Always first.** Mandatory before any other tool. |
| `web_search` | Search the web via Tavily API | Only after drive_retrieve returns nothing useful. |
| `web_scrape` | Extract text from a specific URL using Puppeteer | After web_search, when full page content is needed. |

### Guardrails

```mermaid
flowchart LR
    A[LLM wants to<br/>call web_search] --> B{Has drive_retrieve<br/>been called this turn?}
    B -->|No| C["SYSTEM OVERRIDE:<br/>Force drive_retrieve first"]
    B -->|Yes| D[Allow web_search]

    E[LLM wants to<br/>call final_answer] --> F{Has drive_retrieve<br/>been called this turn?}
    F -->|No| G["SYSTEM OVERRIDE:<br/>Force drive_retrieve first"]
    F -->|Yes| H[Allow final_answer]
```

The **drive-first guard** exists because LLMs (trained on internet data) gravitate toward web search by default - it's easier for them. But Sasori's value is searching *your documents*. The system prompt and code-level guard both enforce this.

### Trajectory History

The agent maintains a full conversation trajectory:

```
[System prompt]           ← Defines the agent's behavior and available tools
[User message history]    ← Previous messages in the chat
[Current user question]   ← What the user just asked
---
[Assistant: plan JSON]    ← Agent plans
[User: "Proceed"]         ← System acknowledges plan
[Assistant: tool JSON]    ← Agent calls a tool
[User: tool result]       ← Tool output fed back
[Assistant: final JSON]   ← Agent gives final answer
```

Every step appends to this trajectory so the LLM remembers its previous decisions. This is how the agent is "self-aware" of what it has already tried.

### Safety Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max steps | 7 | Enough for plan + retrieve + web_search + scrape + answer. Prevents runaway loops. |
| Max runtime | 120s | Prevents burning tokens forever on stuck tasks. |
| Max concurrent tasks | 10 | Prevents server overload. |
| LLM call timeout | 15s | Prevents waiting on a hung OpenAI API call. |
| Redis xAdd timeout | 5s | Prevents blocking on Redis issues. |
| SSE stream TTL | 15 min | Cleans up Redis streams after the answer is safely in PostgreSQL. |

---

## 7. Real-Time Streaming (SSE)

### How SSE Works

```mermaid
sequenceDiagram
    participant Browser
    participant Server as Express (sse.ts)
    participant Redis as Redis Streams

    Browser->>Server: GET /sse/agent/:taskId<br/>(EventSource API)
    Server-->>Browser: HTTP 200, Content-Type: text/event-stream<br/>(connection stays open)
    Server-->>Browser: data: {"message": "connected"}

    loop Every 100ms
        Server->>Redis: XREAD {key: "agent_events:{taskId}"}<br/>BLOCK 5000ms
        alt New event found
            Redis-->>Server: Event data
            Server-->>Browser: id: {redisId}<br/>data: {event JSON}
        else No new events
            Redis-->>Server: (timeout after 5s, try again)
        end
    end

    Note over Server: Agent sends "type: finish" event
    Server-->>Browser: event: finish<br/>data: {}
    Server->>Browser: (HTTP connection closed)
```

### Why SSE instead of WebSockets?

| | SSE | WebSockets |
|---|---|---|
| Direction | Server → Client only | Bidirectional |
| Protocol | Plain HTTP | Upgrade to WS protocol |
| Auto-reconnect | Built-in | Must implement manually |
| Complexity | Simple | Complex (connection management, ping/pong) |
| Best for | Real-time updates, feeds | Chat apps, multiplayer games |

Sasori's agent never needs to receive data *from* the frontend during execution. It's a one-way firehose of events. SSE is the simpler, correct choice.

### Event Types

The agent emits these event types during execution:

```mermaid
stateDiagram-v2
    [*] --> start: Task begins
    start --> plan: Agent initializing
    plan --> reflecting: Agent is thinking
    reflecting --> step_complete: Plan established
    step_complete --> step_executing: Tool call begins
    step_executing --> step_complete: Tool call finished
    step_complete --> reflecting: Next step
    step_complete --> finish: Agent done / timeout / max_steps
    reflecting --> finish: Agent outputs final_answer
    finish --> [*]
```

Each event is pushed to Redis Stream `agent_events:{taskId}` and has a 15-minute TTL. The final answer is persisted in PostgreSQL independently, so even if the Redis stream expires, the data is not lost.

---

## 8. Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ chatRooms : "owns"
    users ||--o{ chatMessages : "writes"
    users ||--o{ agentTasks : "triggers"
    users ||--o{ driveFiles : "owns"
    users ||--o{ rawDocuments : "owns"
    users ||--o{ chunks : "owns"
    chatRooms ||--o{ chatMessages : "contains"
    chatMessages ||--o| agentTasks : "spawns"
    driveFiles ||--o| rawDocuments : "extracted to"
    driveFiles ||--o{ chunks : "split into"

    users {
        uuid id PK
        string googleId UK
        string email
        string name
        text googleRefreshToken
    }

    chatRooms {
        uuid id PK
        uuid userId FK
        string title
    }

    chatMessages {
        uuid id PK
        uuid chatId FK
        uuid userId FK
        enum role "user | assistant"
        text content
        int sequence
        uuid agentTaskId FK
    }

    agentTasks {
        uuid id PK
        uuid userId FK
        uuid chatId FK
        uuid chatMessageId FK
        text inputPrompt
        enum status "pending | running | completed | error | timeout | max_steps"
        text finalAnswerMarkdown
        jsonb resultJson
        jsonb stepSummaries
        jsonb usedChunkIds
    }

    driveFiles {
        uuid id PK
        uuid userId FK
        string fileId
        string name
        string mimeType
        string hash
        enum ingestionPhase "discovered | fetching | chunk_pending | vectorizing | indexed | failed"
        int retryCount
    }

    rawDocuments {
        uuid id PK
        uuid userId FK
        string fileId
        string mimeType
        text text
        string hash
    }

    chunks {
        uuid id PK
        uuid userId FK
        string fileId
        int chunkIndex
        text text
        string hash
        boolean vectorized
        string qdrantPointId
    }
```

### Why agentTasks is Separate from chatMessages

One message = one task, but the task carries heavy state:
- `stepSummaries` - full ReAct loop history
- `resultJson` - citations and tool results
- `usedChunkIds` - which chunks were referenced
- Retry status, timing, error details

Stuffing all this into `chatMessages` would bloat every row, even simple "thanks" messages. Separation also lets you query tasks independently (e.g., "show me all failed tasks in the last hour").

### Why Hash Everything

Every `driveFile`, `rawDocument`, and `chunk` has a SHA-256 hash. Hashes serve three purposes:

1. **Change detection** - If a Drive file was modified but the text hash is identical, skip re-indexing
2. **Idempotency** - Prevents duplicate chunks from being inserted
3. **Deduplication** - Identical content across files gets the same hash

---

## 9. Infrastructure and Services

### Service Responsibilities

```mermaid
graph TB
    subgraph "Frontend Layer"
        Web["apps/web<br/>Next.js :3000<br/>─────────────<br/>Chat UI, Drive sync UI<br/>SSE EventSource consumer"]
    end

    subgraph "API Layer"
        Server["apps/server<br/>Express :3001<br/>─────────────<br/>REST API, SSE endpoint<br/>Agent orchestration<br/>Drive sync trigger"]
    end

    subgraph "Worker Layer"
        FetchW["worker-drive-fetch<br/>Node.js (no port)<br/>─────────────<br/>Downloads files from Drive<br/>Extracts text (PDF, DOCX, etc.)<br/>Enqueues vectorize jobs"]
        VecW["worker-drive-vectorize<br/>Node.js (no port)<br/>─────────────<br/>Chunks text (800 tok, 100 overlap)<br/>Embeds via OpenAI<br/>Upserts to Qdrant"]
    end

    subgraph "Data Layer"
        PG[("PostgreSQL<br/>─────────────<br/>Users, chats, messages<br/>Drive file metadata<br/>Raw document text<br/>Chunk references")]
        Redis[("Redis<br/>─────────────<br/>Streams: drive_fetch:0<br/>Streams: drive_vectorize:0<br/>Streams: agent_events:{taskId}<br/>Consumer groups")]
        Qdrant[("Qdrant<br/>─────────────<br/>Collection: drive_vectors<br/>1536-dim vectors<br/>Cosine similarity<br/>Payload: user_id, file_name")]
    end

    subgraph "External APIs"
        OpenAI(("OpenAI<br/>─────────────<br/>gpt-4o-mini (planning)<br/>text-embedding-3-small<br/>(embeddings)"))
        Tavily(("Tavily<br/>─────────────<br/>Web search (max 3 results)"))
        GDrive(("Google Drive<br/>─────────────<br/>File listing<br/>File download/export"))
    end

    Web --> Server
    Server --> PG
    Server --> Redis
    Server --> Qdrant
    Server --> OpenAI
    Server --> Tavily
    FetchW --> Redis
    FetchW --> PG
    FetchW --> GDrive
    VecW --> Redis
    VecW --> PG
    VecW --> OpenAI
    VecW --> Qdrant
```

### Redis Stream Topology

```mermaid
flowchart LR
    subgraph "Producers"
        S1["Server<br/>(POST /drive/sync)"]
        S2["Server<br/>(Agent loop)"]
        FW["Fetch Worker<br/>(after extraction)"]
    end

    subgraph "Streams"
        R1[("drive_fetch:0<br/>Consumer group:<br/>drive-fetch-workers")]
        R2[("drive_vectorize:0<br/>Consumer group:<br/>drive-vectorize-workers")]
        R3[("agent_events:{taskId}<br/>TTL: 15 minutes")]
    end

    subgraph "Consumers"
        FW
        VW["Vectorize Worker"]
        SSE["SSE Endpoint<br/>(reads + sends to client)"]
    end

    S1 -- "XADD" --> R1
    R1 -- "XREADGROUP" --> FW
    FW -- "XADD" --> R2
    R2 -- "XREADGROUP" --> VW
    S2 -- "XADD" --> R3
    R3 -- "XREAD" --> SSE
```

### Docker Compose

Currently only Redis is containerized:

```yaml
services:
  redis:
    image: redis:alpine
    container_name: sasori-redis
    restart: always
    ports:
      - "6379:6379"
```

PostgreSQL and Qdrant run externally (or locally installed). All connections are configured via environment variables.

---

## 10. Monorepo Structure

```
sasori/
├── apps/
│   ├── web/                        # Next.js frontend
│   │   ├── app/
│   │   │   ├── chat/               # Chat pages + [id] dynamic route
│   │   │   ├── login/              # Auth page
│   │   │   └── layout.tsx          # Root layout
│   │   ├── components/
│   │   │   ├── chat/               # MessageList, AgentThoughtLoader, CitationModal
│   │   │   ├── drive/              # DriveSyncModal, IndexedDocsModal, DocumentPreview
│   │   │   ├── layout/             # Navbar, Sidebar, Footer
│   │   │   └── auth/               # AuthContext
│   │   └── lib/
│   │       └── apiClient.ts        # HTTP client to Express server
│   │
│   ├── server/                     # Express API server
│   │   └── src/
│   │       ├── agent/
│   │       │   ├── loop.ts         # ReAct agent loop (the brain)
│   │       │   ├── runAgentTask.ts # Agent lifecycle orchestrator
│   │       │   └── runTaskMock.ts  # Mock agent for testing
│   │       ├── llm/
│   │       │   ├── openai.ts       # OpenAI client + callPlannerLLM + getEmbedding
│   │       │   └── embedding.ts    # Batch embedding utility
│   │       ├── tools/
│   │       │   ├── driveRetrieve.ts # Semantic search over Drive docs
│   │       │   ├── web_search.ts   # Tavily web search
│   │       │   ├── web_scrape.ts   # Puppeteer page scraping
│   │       │   └── vectorSearch.ts # Low-level vector search
│   │       ├── chat/
│   │       │   └── service.ts      # Chat CRUD + message + task creation
│   │       ├── drive/
│   │       │   ├── client.ts       # Google Drive API client
│   │       │   └── routes.ts       # Drive sync + file management endpoints
│   │       ├── routes/
│   │       │   ├── chats.ts        # Chat REST endpoints
│   │       │   ├── tasks.ts        # Task status + events endpoints
│   │       │   ├── sse.ts          # SSE streaming endpoint
│   │       │   └── debug.ts        # Debug utilities
│   │       ├── auth/
│   │       │   ├── google.ts       # Google OAuth
│   │       │   └── middleware.ts   # Auth middleware
│   │       └── index.ts            # Express app setup + health check
│   │
│   ├── worker-drive-fetch/         # Background worker: download + extract text
│   │   └── src/
│   │       ├── index.ts            # Redis consumer loop + text extraction
│   │       └── utils/envChecker.ts
│   │
│   └── worker-drive-vectorize/     # Background worker: chunk + embed + upsert
│       └── src/
│           ├── index.ts            # Redis consumer loop + chunking + embedding
│           └── utils/envChecker.ts
│
├── packages/
│   ├── db/                         # Drizzle ORM + PostgreSQL
│   │   └── src/
│   │       ├── schema.ts           # All table definitions
│   │       └── index.ts            # DB client + health check
│   │
│   ├── qdrant/                     # Qdrant vector DB client
│   │   └── src/
│   │       └── index.ts            # Client init, upsert, search, health check
│   │
│   ├── redis/                      # Redis Streams wrapper
│   │   └── src/
│   │       └── index.ts            # Stream ops, consumer groups, agent events
│   │
│   ├── zod-schema/                 # Shared validation schemas
│   │   └── src/
│   │       ├── agent.ts            # AgentEvent, Citation, StepSummary schemas
│   │       └── tools.ts            # Tool input schemas
│   │
│   ├── ui/                         # Shared React components
│   │   └── src/                    # Button, Card, Code components
│   │
│   ├── typescript-config/          # Shared tsconfig files
│   └── eslint-config/              # Shared ESLint configs
│
├── docker-compose.yaml             # Redis container
├── turbo.json                      # Turborepo pipeline config
├── pnpm-workspace.yaml             # Monorepo workspace config
└── package.json                    # Root scripts (build, dev, lint)
```

### Package Dependencies

```mermaid
graph TD
    Web["apps/web"]
    Server["apps/server"]
    FetchW["worker-drive-fetch"]
    VecW["worker-drive-vectorize"]

    DB["@repo/db"]
    Qdrant["@repo/qdrant"]
    Redis["@repo/redis"]
    Zod["@repo/zod-schema"]

    Web --> DB
    Web --> Zod
    Server --> DB
    Server --> Qdrant
    Server --> Redis
    Server --> Zod
    FetchW --> DB
    FetchW --> Redis
    FetchW --> Zod
    VecW --> DB
    VecW --> Qdrant
    VecW --> Redis
    VecW --> Zod
```

---

## 11. Key Decisions and Tradeoffs

| Decision | Choice | Alternative | Why |
|----------|--------|-------------|-----|
| Monorepo | Turborepo + pnpm | Separate repos | Shared packages (db, redis, schemas) across all apps |
| Vector DB | Qdrant | Pinecone, Weaviate | Self-hosted, free, good filtering support |
| Embeddings | text-embedding-3-small | text-embedding-3-large | Cheaper, 1536 dims is sufficient for semantic search |
| LLM | gpt-4o-mini | gpt-4o | 10-30x cheaper. Good enough for ReAct tool selection |
| Job Queue | Redis Streams (raw) | BullMQ | Learning purpose - understanding the primitives. BullMQ is built on Redis anyway |
| Chunking | tiktoken (800 tokens, 100 overlap) | LangChain text splitter | Direct control, no heavy dependency |
| Web search | Tavily | SerpAPI, Brave | Simple API, good for MVP |
| Web scraping | Puppeteer | Cheerio, Playwright | Handles JS-rendered pages |
| Frontend | Next.js | Plain React | File-based routing, SSR if needed |
| ORM | Drizzle | Prisma | Lightweight, SQL-like, good TypeScript support |
| Real-time | SSE | WebSockets | Unidirectional is sufficient. Simpler, auto-reconnects |

---

## 12. What I Know vs What I Learned

### What I Built and Understand Well

- **RAG fundamentals**: Embeddings, vector search, chunking, and why each piece exists
- **ReAct agent pattern**: Dynamic tool selection, trajectory history, self-correction
- **Redis Streams**: Consumer groups, XADD/XREADGROUP/XACK, job queuing
- **PostgreSQL schema design**: Normalized tables, state machines, hash-based deduplication
- **Chunking strategy**: Token-based splitting with overlap, title prepending for context
- **Cosine similarity vs Euclidean**: Direction vs magnitude, and why threshold 0.4 is a good balance
- **Drive-first guard**: Why the LLM must search your docs before the web
- **Separation of concerns**: Frontend → API → DB, workers as independent processes

### What I Learned Through This Project

- **SSE vs WebSockets**: SSE is unidirectional (server→client), simpler, built on plain HTTP. WebSockets are bidirectional and more complex. For a one-way event stream, SSE is the right choice.
- **Why `response_format: { type: "json_object" }` matters**: Forces OpenAI to return valid JSON. Without it, the model wraps output in conversational filler that breaks `JSON.parse`.
- **Defensive backtick stripping**: Even with `json_object` mode, LLMs can be unreliable. The regex that strips markdown codeblocks is a safety net.
- **Context window management**: Capping at 5 files × 2 chunks prevents the "lost in the middle" phenomenon where LLMs forget information in the middle of long prompts.
- **State machine granularity**: 6 ingestion states seem like overkill until you need to know whether to retry from fetch or from vectorize.

### What I Still Need to Learn

- **Production deployment**: How to run each service as a container, horizontal scaling, monitoring
- **PEL recovery**: Redis Streams have a Pending Entries List for crashed workers, but I don't have an XPENDING/XCLAIM sweep in my code yet
- **Advanced RAG techniques**: Re-ranking, hybrid search (keyword + semantic), query transformation
- **Cost optimization**: Batching embeddings, caching frequent queries, smarter chunking strategies
