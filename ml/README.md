# ML / LLM Zone

This folder is reserved for model lifecycle artifacts:

- data pipelines and dataset manifests
- training/evaluation scripts
- model cards and experiment reports
- inference adapters (future local/vLLM/internal providers)

Current production backend uses provider abstraction in:
- `backend/app/services/llm/providers.py`

Planned evolution:
1. Add local model runner adapter (`vLLM`/`TGI`).
2. Add A/B routing and offline evaluation before promotion.
3. Store prompts/evals with reproducible experiment IDs.
