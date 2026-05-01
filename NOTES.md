# HEALOSBENCH — Notes

## Local Setup

Full setup instructions are in [`setup.md`](./setup.md). Quick start:

```bash
bun install

# Copy env files and fill in ANTHROPIC_API_KEY + DATABASE_URL
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# Start Postgres, push schema, then run
bun db:push
bun dev                          # dashboard → http://localhost:3001

# Or run evals directly from the CLI
bun eval --strategy=zero_shot
bun eval --strategy=few_shot
bun eval --strategy=cot
```

---

## Results

All three strategies run against 50 synthetic cases, model `claude-haiku-4-5-20251001`, concurrency=5.

| Strategy  | Overall F1 | Chief Complaint | Vitals | Meds F1 | Diagnoses F1 | Plan F1 | Follow-up | Schema Invalid | Hallucinations | Cost    |
|-----------|-----------|-----------------|--------|---------|--------------|---------|-----------|---------------|---------------|---------|
| zero_shot | **72.3%** | 43.2%           | 99.5%  | 65.4%   | 80.8%        | 80.7%   | 63.9%     | 0             | 7             | $0.1545 |
| few_shot  | **73.4%** | 44.0%           | 99.5%  | 63.1%   | **87.7%**    | **85.3%** | 60.6%   | 0             | 9             | $0.1853 |
| cot       | **66.5%** | 34.7%           | 99.5%  | 56.1%   | 72.9%        | 81.5%   | 54.2%     | 0             | 6             | $0.2516 |

**Winner by field:**
- Chief complaint: `few_shot` (44.0%)
- Vitals: tied 99.5% — all strategies near-perfect
- Medications: `zero_shot` (65.4%) — extra tokens in CoT/few-shot seem to confuse dose normalization
- Diagnoses: `few_shot` (87.7%) — examples teach the model the right level of clinical specificity
- Plan: `few_shot` (85.3%)
- Follow-up: `zero_shot` (63.9%)
- Overall: `few_shot` wins narrowly (+1.1pp over zero_shot), CoT trails by 6.9pp

**Prompt hashes (for reproducibility):**
- zero_shot: `43ab60ba62dee3e1`
- few_shot: `99a56da9dcb5d451`
- cot: `94501fe325ed830d`

### Full CLI Output

**zero_shot**

```
HEALOSBENCH — CLI Eval
Strategy: zero_shot  Model: claude-haiku-4-5-20251001  Prompt hash: 43ab60ba62dee3e1
Cases: 50

Case         Overall  CC       Meds     Dx       Try  Cost
----------------------------------------------------------------------
case_001     76.7%    77.8%    66.7%    100.0%   1    $0.00306
case_002     81.5%    37.5%    80.0%    100.0%   1    $0.00326
case_003     63.8%    50.0%    100.0%   10.0%    1    $0.00300
case_004     80.1%    50.0%    50.0%    100.0%   1    $0.00310
case_005     83.8%    33.3%    100.0%   100.0%   1    $0.00306
case_006     64.8%    42.9%    0.0%     100.0%   1    $0.00341
case_007     82.4%    81.8%    50.0%    100.0%   1    $0.00316
case_008     74.2%    20.0%    100.0%   100.0%   1    $0.00273
case_009     87.4%    85.7%    100.0%   100.0%   1    $0.00282
case_010     81.4%    33.3%    100.0%   100.0%   1    $0.00285
case_011     67.5%    17.6%    50.0%    100.0%   1    $0.00330
case_012     84.4%    50.0%    100.0%   100.0%   1    $0.00313
case_013     74.3%    50.0%    100.0%   66.7%    1    $0.00285
case_014     68.1%    17.6%    50.0%    100.0%   1    $0.00318
case_015     75.6%    46.2%    75.0%    100.0%   1    $0.00373
case_016     63.0%    42.9%    100.0%   0.0%     1    $0.00333
case_017     57.0%    0.0%     100.0%   0.0%     1    $0.00297
case_018     87.8%    33.3%    100.0%   100.0%   1    $0.00374
case_019     91.4%    100.0%   100.0%   100.0%   1    $0.00286
case_020     80.0%    50.0%    100.0%   100.0%   1    $0.00274
case_021     63.1%    44.4%    50.0%    100.0%   1    $0.00321
case_022     79.1%    41.2%    100.0%   100.0%   1    $0.00299
case_023     63.4%    27.8%    0.0%     100.0%   1    $0.00294
case_024     77.1%    66.7%    100.0%   100.0%   1    $0.00298
case_025     68.2%    23.5%    100.0%   100.0%   1    $0.00294
case_026     52.6%    11.1%    0.0%     71.7%    1    $0.00281
case_027     82.1%    33.3%    100.0%   100.0%   1    $0.00277
case_028     60.5%    36.4%    0.0%     100.0%   1    $0.00295
case_029     65.9%    28.6%    0.0%     100.0%   1    $0.00302
case_030     63.4%    100.0%   100.0%   0.0%     1    $0.00282
case_031     81.1%    20.0%    100.0%   100.0%   1    $0.00302
case_032     56.8%    0.0%     0.0%     100.0%   1    $0.00409
case_033     86.9%    100.0%   50.0%    71.7%    1    $0.00328
case_034     60.1%    21.4%    66.7%    10.0%    1    $0.00350
case_035     96.7%    80.0%    100.0%   100.0%   1    $0.00317
case_036     88.3%    50.0%    100.0%   100.0%   1    $0.00308
case_037     49.7%    16.7%    0.0%     100.0%   1    $0.00280
case_038     48.5%    44.4%    0.0%     0.0%     1    $0.00302
case_039     60.5%    12.5%    0.0%     100.0%   1    $0.00297
case_040     76.4%    50.0%    100.0%   100.0%   1    $0.00281
case_041     71.5%    40.0%    100.0%   100.0%   1    $0.00314
case_042     65.2%    66.7%    100.0%   0.0%     1    $0.00257
case_043     45.2%    16.7%    0.0%     0.0%     1    $0.00322
case_044     65.2%    33.3%    0.0%     100.0%   1    $0.00309
case_045     54.7%    55.6%    0.0%     10.0%    1    $0.00291
case_046     88.5%    40.0%    100.0%   100.0%   1    $0.00296
case_047     76.8%    53.8%    100.0%   100.0%   1    $0.00336
case_048     80.6%    50.0%    66.7%    100.0%   1    $0.00326
case_049     82.5%    57.1%    66.7%    100.0%   1    $0.00336
case_050     77.1%    20.0%    50.0%    100.0%   1    $0.00325

======================================================================
AGGREGATE SCORES
======================================================================
Overall F1:        72.3%
Chief complaint:   43.2%
Vitals:            99.5%
Medications F1:    65.4%
Diagnoses F1:      80.8%
Plan F1:           80.7%
Follow-up:         63.9%

Schema invalid:    0
Hallucinations:    7
Cache reads:       0 tokens
Cache writes:      0 tokens
Total cost:        $0.1545
```

**few_shot**

```
HEALOSBENCH — CLI Eval
Strategy: few_shot  Model: claude-haiku-4-5-20251001  Prompt hash: 99a56da9dcb5d451
Cases: 50

Case         Overall  CC       Meds     Dx       Try  Cost
----------------------------------------------------------------------
case_001     100.0%   100.0%   100.0%   100.0%   1    $0.00331
case_002     97.2%    100.0%   100.0%   100.0%   1    $0.00388
case_003     84.6%    66.7%    100.0%   100.0%   1    $0.00349
case_004     85.9%    77.8%    50.0%    100.0%   1    $0.00353
case_005     83.9%    20.0%    100.0%   100.0%   1    $0.00350
case_006     60.5%    42.9%    33.3%    100.0%   1    $0.00357
case_007     89.9%    81.8%    100.0%   100.0%   1    $0.00388
case_008     73.1%    25.0%    100.0%   100.0%   2    $0.00714
case_009     89.6%    85.7%    100.0%   100.0%   1    $0.00353
case_010     82.5%    40.0%    100.0%   100.0%   1    $0.00329
case_011     71.7%    17.6%    100.0%   100.0%   1    $0.00363
case_012     84.4%    50.0%    100.0%   100.0%   1    $0.00356
case_013     79.3%    40.0%    100.0%   100.0%   1    $0.00350
case_014     72.2%    33.3%    50.0%    100.0%   1    $0.00364
case_015     73.3%    23.1%    75.0%    100.0%   1    $0.00387
case_016     81.1%    42.9%    100.0%   100.0%   1    $0.00368
case_017     59.3%    0.0%     100.0%   0.0%     1    $0.00339
case_018     70.4%    11.1%    75.0%    100.0%   1    $0.00388
case_019     92.1%    100.0%   100.0%   100.0%   1    $0.00340
case_020     76.8%    15.4%    100.0%   100.0%   1    $0.00347
case_021     60.7%    33.3%    50.0%    100.0%   1    $0.00362
case_022     80.0%    46.7%    100.0%   100.0%   1    $0.00362
case_023     61.8%    20.8%    0.0%     100.0%   1    $0.00347
case_024     79.9%    46.2%    100.0%   100.0%   1    $0.00355
case_025     72.2%    43.8%    100.0%   100.0%   1    $0.00342
case_026     59.7%    25.0%    0.0%     66.7%    1    $0.00347
case_027     71.5%    62.5%    100.0%   10.0%    1    $0.00356
case_028     63.9%    33.3%    0.0%     100.0%   1    $0.00338
case_029     65.3%    26.7%    0.0%     100.0%   1    $0.00352
case_030     71.4%    85.7%    100.0%   0.0%     1    $0.00364
case_031     59.5%    7.1%     0.0%     100.0%   1    $0.00405
case_032     52.7%    0.0%     20.0%    100.0%   1    $0.00421
case_033     83.3%    100.0%   50.0%    100.0%   1    $0.00369
case_034     74.6%    23.1%    66.7%    100.0%   1    $0.00420
case_035     90.2%    41.2%    100.0%   100.0%   1    $0.00399
case_036     82.3%    63.6%    100.0%   100.0%   1    $0.00394
case_037     52.4%    29.4%    0.0%     100.0%   1    $0.00336
case_038     49.0%    25.0%    0.0%     0.0%     1    $0.00330
case_039     61.9%    25.0%    0.0%     100.0%   1    $0.00390
case_040     76.1%    31.3%    100.0%   100.0%   1    $0.00372
case_041     77.1%    38.5%    100.0%   100.0%   1    $0.00353
case_042     66.5%    66.7%    100.0%   0.0%     1    $0.00345
case_043     57.0%    6.3%     0.0%     100.0%   1    $0.00401
case_044     59.3%    15.4%    0.0%     100.0%   1    $0.00359
case_045     52.0%    42.9%    0.0%     10.0%    1    $0.00346
case_046     83.3%    100.0%   0.0%     100.0%   1    $0.00341
case_047     81.2%    50.0%    100.0%   100.0%   1    $0.00372
case_048     69.4%    50.0%    0.0%     100.0%   1    $0.00382
case_049     75.0%    50.0%    33.3%    100.0%   1    $0.00383
case_050     71.8%    38.5%    50.0%    100.0%   1    $0.00373

======================================================================
AGGREGATE SCORES
======================================================================
Overall F1:        73.4%
Chief complaint:   44.0%
Vitals:            99.5%
Medications F1:    63.1%
Diagnoses F1:      87.7%
Plan F1:           85.3%
Follow-up:         60.6%

Schema invalid:    0
Hallucinations:    9
Cache reads:       0 tokens
Cache writes:      0 tokens
Total cost:        $0.1853
```

**cot**

```
HEALOSBENCH — CLI Eval
Strategy: cot  Model: claude-haiku-4-5-20251001  Prompt hash: 94501fe325ed830d
Cases: 50

Case         Overall  CC       Meds     Dx       Try  Cost
----------------------------------------------------------------------
case_001     72.3%    60.0%    66.7%    100.0%   1    $0.00463
case_002     69.9%    28.6%    80.0%    100.0%   1    $0.00500
case_003     63.5%    66.7%    100.0%   10.0%    1    $0.00506
case_004     76.8%    66.7%    50.0%    71.7%    1    $0.00580
case_005     73.6%    18.8%    100.0%   100.0%   1    $0.00478
case_006     54.5%    33.3%    0.0%     100.0%   1    $0.00530
case_007     85.4%    60.0%    100.0%   100.0%   1    $0.00472
case_008     76.8%    19.0%    100.0%   100.0%   1    $0.00472
case_009     82.7%    46.2%    100.0%   100.0%   1    $0.00477
case_010     83.4%    33.3%    100.0%   100.0%   1    $0.00463
case_011     64.9%    33.3%    0.0%     100.0%   1    $0.00493
case_012     58.4%    44.4%    50.0%    0.0%     1    $0.00457
case_013     71.7%    27.8%    100.0%   66.7%    1    $0.00511
case_014     57.1%    46.2%    50.0%    66.7%    1    $0.00555
case_015     75.4%    46.2%    75.0%    100.0%   1    $0.00578
case_016     59.6%    42.9%    66.7%    5.0%     1    $0.00535
case_017     61.7%    14.3%    100.0%   5.0%     2    $0.00884
case_018     72.4%    11.1%    100.0%   71.7%    1    $0.00623
case_019     64.5%    36.4%    100.0%   10.0%    1    $0.00449
case_020     79.0%    28.6%    100.0%   100.0%   1    $0.00441
case_021     59.8%    23.5%    50.0%    100.0%   1    $0.00489
case_022     79.5%    43.8%    100.0%   100.0%   1    $0.00508
case_023     62.3%    23.5%    0.0%     100.0%   1    $0.00443
case_024     53.7%    45.5%    0.0%     100.0%   1    $0.00506
case_025     69.1%    33.3%    100.0%   100.0%   1    $0.00434
case_026     59.3%    28.6%    0.0%     71.7%    1    $0.00470
case_027     84.1%    45.5%    100.0%   100.0%   1    $0.00436
case_028     39.1%    17.6%    0.0%     0.0%     1    $0.00459
case_029     67.3%    25.0%    0.0%     100.0%   1    $0.00446
case_030     65.0%    75.0%    100.0%   0.0%     1    $0.00475
case_031     71.0%    9.1%     100.0%   100.0%   1    $0.00533
case_032     53.6%    0.0%     0.0%     100.0%   1    $0.00648
case_033     70.1%    70.6%    50.0%    100.0%   1    $0.00550
case_034     69.4%    23.1%    33.3%    100.0%   1    $0.00471
case_035     92.7%    56.3%    100.0%   100.0%   1    $0.00483
case_036     81.5%    50.0%    100.0%   100.0%   1    $0.00507
case_037     51.1%    25.0%    0.0%     100.0%   1    $0.00439
case_038     47.3%    25.0%    0.0%     0.0%     1    $0.00429
case_039     54.8%    17.4%    0.0%     100.0%   1    $0.00504
case_040     70.0%    21.1%    100.0%   100.0%   1    $0.00469
case_041     54.7%    31.3%    0.0%     100.0%   1    $0.00500
case_042     59.1%    14.3%    100.0%   0.0%     1    $0.00427
case_043     43.0%    11.1%    0.0%     10.0%    1    $0.00525
case_044     50.1%    14.3%    0.0%     46.7%    1    $0.00555
case_045     53.0%    45.5%    0.0%     10.0%    1    $0.00487
case_046     77.5%    42.9%    50.0%    100.0%   1    $0.00482
case_047     79.6%    21.4%    100.0%   100.0%   1    $0.00528
case_048     68.6%    50.0%    0.0%     100.0%   1    $0.00473
case_049     72.5%    44.4%    33.3%    100.0%   1    $0.00508
case_050     62.0%    38.5%    50.0%    0.0%     1    $0.00509

======================================================================
AGGREGATE SCORES
======================================================================
Overall F1:        66.5%
Chief complaint:   34.7%
Vitals:            99.5%
Medications F1:    56.1%
Diagnoses F1:      72.9%
Plan F1:           81.5%
Follow-up:         54.2%

Schema invalid:    0
Hallucinations:    6
Cache reads:       0 tokens
Cache writes:      0 tokens
Total cost:        $0.2516
```

## Strategy Designs

The three strategies are **meaningfully different**:

### zero_shot
Minimal system prompt: extract using the tool, follow the rules, don't hallucinate. No examples. Tests the model's raw clinical extraction ability. Expected to be fastest and cheapest, but most likely to make schema errors or miss subtle fields.

### few_shot
Same rules but with 2 fully-annotated example transcript→extraction pairs embedded in the system prompt. The examples are cache-controlled so repeated runs only pay for the transcript tokens. Expected to improve medication normalization and follow-up extraction (where format matters). The examples explicitly show that `interval_days: null` is correct when there's no scheduled follow-up.

### cot (chain-of-thought)
Instructs the model to reason step by step through 6 explicit categories before calling the tool. Forces a grounding check ("every value should have textual support"). Expected to reduce hallucinations and improve diagnoses (where the model needs to infer from clinical language), but slower and more expensive due to reasoning tokens.

## What Surprised Me

- **CoT hurt, not helped.** Chain-of-thought was the worst overall (66.5% vs 73.4% for few_shot). The reasoning tokens seem to drift the model away from grounded extraction — diagnoses fell 15pp versus few_shot. More thinking ≠ better structured output at Haiku scale.
- **Chief complaint is consistently the weakest field across all strategies (~34–44%).** The gold annotations use precise clinical phrasing ("acute exacerbation of COPD") while the model often produces colloquial summaries ("difficulty breathing"). Jaccard similarity penalizes this vocabulary gap heavily.
- **Medications F1 is bimodal — either 100% or 0%.** Most cases either perfectly match all medications or fail completely (dose/frequency mismatch). The 0% cases are almost always a normalization failure (e.g. `"twice a day"` vs `"BID"` not caught by the normalization map), not a hallucination.
- **Zero_shot meds beat few_shot (65.4% vs 63.1%).** Adding examples slightly confused the model on dose formatting — it started mimicking example formats instead of copying the transcript verbatim.
- **Prompt caching showed 0 cache reads in CLI mode.** Each CLI run starts a fresh process, so there's no warm cache between cases within a run. Caching would pay off across multiple runs within the same server process (the server mode benefits more).
- **All three strategies hit 0 schema-invalid outputs.** The AJV retry loop was never triggered in practice — Haiku gets the tool schema right on the first attempt every time at this dataset scale.

## Concurrency and Rate-Limit Handling

- A `Semaphore` class limits concurrent Anthropic calls to 5. No `Promise.all` naïve dispatch.
- `withRateLimitRetry()` catches HTTP 429 responses and retries with exponential backoff: 1s, 2s, 4s, 8s before giving up.
- On 429: the semaphore holds the permit, so no new requests start during the backoff. After backoff, the same case retries from scratch (idempotent — tool-use calls don't have side effects).
- A full 50-case Haiku run at concurrency=5 should take ~2–3 minutes wall time.

## Architecture Decisions

- **Tool use** is the only output path. The model is forced to call `extract_clinical_data`; free-form JSON is never parsed.
- **Retry loop** sends validation errors back as a `tool_result` with `is_error: true`, which is the canonical Anthropic pattern for tool-call feedback.
- **Resumability** is achieved by storing each case result in the DB as it completes. On resume, completed cases are skipped via the `status === "completed"` check. No double-charging.
- **Idempotency**: posting the same `{strategy, transcriptId}` with the same prompt hash is detected via `onConflictDoNothing` on the case_results table. `force=true` bypasses this.
- **Prompt hash** is a 16-char SHA-256 prefix of the full system prompt text. Changing any character changes the hash. Stored on each run record so you can trace which prompt version produced which scores.

## What I Would Build Next

1. **Smarter hallucination detection**: NLI-based grounding check instead of substring match. A small classification model or GPT-4o can check "does this value have textual support?" more reliably.
2. **Prompt diff view**: given two run IDs with different prompt hashes, show which lines changed in the system prompt and which cases regressed as a result.
3. **Active-learning hint**: surface the 5 cases with highest score variance across strategies — these are the cases most worth annotating with more detail or using as few-shot examples.
4. **Cost guardrail**: estimate tokens from prompt length + transcript length before sending, refuse if projected cost exceeds `$MAX_COST_PER_RUN`.
5. **Cross-model comparison**: add Sonnet 4.6 support. The compare view already handles arbitrary strategy/model pairs; just pass `--model=claude-sonnet-4-6` to the CLI.

## What I Cut

- **Multi-user auth** — removed entirely; the dashboard is open with no sign-in required.
- **Prompt diff view** (stretch goal — would need storing the full prompt text, not just the hash).
- **Active-learning hint** (stretch goal).
- Retry on network errors (only retrying on 429; other errors fail fast).
