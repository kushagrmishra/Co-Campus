# CoCampus Token Reduction Changes

Date: 2026-09-12

This document lists the token-reduction changes actually implemented in the project, where they were made, and their expected impact. Token savings are estimated from prompt structure and repeated-request behavior. They are not provider billing measurements because provider tokenizers, image-token costs, and cache billing were not instrumented.

## Summary

The implemented work is concentrated in `services/llm.ts`. It reduces repeated prompt instructions and redundant JSON formatting while preserving the same model providers, provider order, output contracts, fallback behavior, and user-facing features.

Estimated impact:

- One-time prompt/context overhead: approximately 10-45% fewer text tokens, depending on the request.
- Repeated identical Q&A or MCQ requests: 100% fewer new model-request tokens when the in-memory cache hits.
- Image input tokens: unchanged. Images are still sent to the vision model because they are required for accurate extraction.
- Tool-schema tokens: no change because the app does not send model tool/function schemas.
- YouTube retrieval tokens: no LLM-token reduction was implemented there; the existing API retrieval remains unchanged.

## Detailed Changes

| Area | File / location | What changed | Expected help | Quality / risk |
|---|---|---|---|---|
| Context formatting | `services/llm.ts` - `compactExtractionContext` | Replaced repeated `JSON.stringify` packaging with labeled, compact fields for subject, title, summary, topics, tasks, and OCR. | Estimated 10-30% fewer text tokens for extracted-note context. | Low. Required semantic fields are retained. |
| Context formatting | `services/llm.ts` - `compactNoteContext` | Added one reusable compact representation for Q&A note context instead of separately repeating metadata and serialized arrays. | Estimated 10-30% fewer Q&A input tokens. | Low. Summary, topics, tasks, OCR, and flashcards remain available. |
| Extraction prompt | `services/llm.ts` - `extractStudyMaterial` | Removed verbose schema comments, repeated prose, markdown warnings, and redundant explanatory text. Kept the exact extraction fields and constraints. | Estimated 25-45% reduction in instruction/schema overhead. | Low. JSON shape and due-date behavior are unchanged. |
| Append-note context | `services/llm.ts` - existing-note handling | Replaced verbose existing-note instructions and serialized topics with compact labeled context. Existing OCR is intentionally not resent, matching the previous behavior. | Estimated 15-25% fewer existing-context tokens. | Low. Existing summary, topics, tasks, title, and subject remain available. |
| Flashcard prompt | `services/llm.ts` - `generateFlashcards` | Replaced long instructions and serialized full extraction object with a compact instruction and labeled extraction context. | Estimated 20-35% fewer prompt overhead/context tokens. | Low. Still requests at least 10 flashcards with the same JSON response shape. |
| MCQ prompt | `services/llm.ts` - `generateMCQs` | Reduced repeated schema prose and kept the existing 1,200-character note limit. | Estimated 25-40% fewer instruction tokens per MCQ request. | Low. Subject, difficulty, four options, answer index, and explanation remain required. |
| MCQ caching | `services/llm.ts` - `generateMCQs` | Added cache lookup before provider calls and cache writes after successful valid responses. Cache key includes subject, level, and source note text. | 100% fewer new request tokens for an identical cache hit. | Low. Failed or malformed requests are not cached. |
| Q&A prompt | `services/llm.ts` - `askNoteAiDirectly` | Replaced repeated role, metadata, JSON-array, and instruction blocks with a concise grounded-answer contract and compact note context. | Estimated 15-30% fewer Q&A input tokens. | Low. Direct-answer, formula/definition, concise-response, and no-emoji requirements remain. |
| Q&A caching | `services/llm.ts` - `askNoteAiDirectly` | Added cache lookup and successful-response caching. Cache key includes note ID, note creation timestamp, and normalized question. | 100% fewer new request tokens for repeated questions while the process cache is alive. | Low. Note identity/version prevents ordinary cross-note leakage. |
| Cache size control | `services/llm.ts` - response cache helpers | Added a bounded 50-entry LRU-style in-memory cache. Recently used entries are retained; oldest entries are evicted. | Prevents unbounded memory growth; reduces duplicate provider calls. | Low. Cache is intentionally process-local and non-persistent. |
| Provider behavior | `services/llm.ts` - all provider calls | Provider order, models, temperatures, response parsing, local fallback answers, and public function signatures were preserved. | No direct token reduction, but prevents quality regressions from routing changes. | Low. Existing fallback behavior remains. |

## What Was Not Changed

These areas were reviewed but did not receive token-reduction code changes:

- Tool/function schemas: none are sent by this app, so there was no schema bloat to remove.
- Conversation history: requests are single-turn prompts; no chat-history transcript is transmitted.
- RAG/vector retrieval: no vector database or semantic retrieval pipeline exists in the current app.
- YouTube retrieval: `services/youtube.ts` still performs the existing per-topic YouTube API calls. This affects API quota and latency, but not LLM prompt tokens.
- Image payloads: vision images remain unchanged because removing or reducing image data could reduce extraction accuracy.
- Model routing: no extra classifier call was added. The existing OpenRouter/Gemini/Groq fallback chain remains deterministic.
- Intermediate AI stages: extraction, flashcard generation, and Q&A are separate user-visible functions, so none was removed.

## How Much It Helped

### Per-request prompt reduction

The exact savings depend on the note length and number of topics/tasks. The estimates below describe text prompt overhead only:

- Extraction: approximately 25-45% fewer instruction/schema tokens.
- Existing-note append context: approximately 15-25% fewer context tokens.
- Flashcard generation: approximately 20-35% fewer instruction/context overhead tokens.
- MCQ generation: approximately 25-40% fewer instruction tokens.
- Q&A: approximately 15-30% fewer repeated metadata/instruction tokens.

### Repeated-request reduction

For identical requests during the same app process:

- Cached Q&A: avoids the entire second provider request, including input and output tokens.
- Cached MCQ generation: avoids the entire second provider request, including input and output tokens.
- Cache capacity: up to 50 entries, with least-recently-used eviction behavior.

### Not yet measured

The project does not currently record provider usage metadata. Therefore, the following are estimates rather than measured results:

- Actual billed input tokens.
- Actual billed output tokens.
- Image-token usage.
- Provider-side prompt-cache hits.
- Cost per capture or per study question.

## Validation Completed

- `npm run typecheck` passes.
- Existing public service APIs remain unchanged.
- Provider fallback order remains unchanged.
- Existing local deterministic fallback answers remain unchanged.
- Q&A OCR remains capped at the previous 1,000 characters.
- MCQ source notes remain capped at the previous 1,200 characters.

## Recommended Next Measurement

Add server-side telemetry around each model call with:

- provider and model;
- estimated input and output tokens;
- latency;
- cache hit/miss;
- JSON parse success/failure;
- fallback provider used;
- note/capture completion;
- evaluation score for groundedness and answer accuracy.

That instrumentation is needed before reporting exact production savings.
