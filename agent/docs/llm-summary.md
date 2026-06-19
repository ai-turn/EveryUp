# LLM Incident Summary

EveryUp Agent can enrich raw alerts with an AI-generated incident summary. The
provider uses an OpenAI-compatible `/chat/completions` API, so hosted APIs and
local runtimes such as Ollama, vLLM, LM Studio, and llama.cpp server can share
the same integration shape.

## Configuration

```bash
EVERYUP_LLM_BASE_URL=http://ollama:11434/v1
EVERYUP_LLM_API_KEY=ollama
EVERYUP_LLM_MODEL=llama3.1
EVERYUP_LLM_TIMEOUT_SECONDS=8
EVERYUP_LLM_MAX_TOKENS=500
```

For a hosted OpenAI-compatible API:

```bash
EVERYUP_LLM_BASE_URL=https://api.openai.com/v1
EVERYUP_LLM_API_KEY=sk-...
EVERYUP_LLM_MODEL=gpt-4o-mini
```

If `EVERYUP_LLM_BASE_URL` is empty, LLM summaries are disabled.

## Degrade behavior

LLM summaries are optional. If the provider is not configured, times out, or
returns invalid JSON, the agent sends the raw alert body exactly as it would
without LLM support. Failures are recorded in `audit.jsonl` as
`llm_summary_failed`.

## Masking

Before an incident is sent to the LLM provider, the agent masks common secret
forms:

- `Authorization: Bearer ...`
- `api_key`, `token`, `password`, and `secret` fields
- Telegram bot-token-like values
- credentials embedded in URLs

The LLM is only used for explanation. It does not execute commands.
