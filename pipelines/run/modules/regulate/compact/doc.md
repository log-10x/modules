---
icon: material/tune-variant
---

Ship every high-value event as full text and every low-signal event as a compact template+values tuple — without redeploying the engine.

The compact regulator makes a per-event decision whether to emit via `encode()` (the pattern's template hash plus extracted variable values — typically 20–40× smaller than the original line) or preserve `fullText`. The decision is keyed by the same field-set identity the [rate regulator](https://doc.log10x.com/run/regulate/rate/) uses, so the same `symbolMessage` value a Reporter attributes cost to is the key an operator targets to reduce that cost.

Entries are declared in a CSV lookup file, typically committed to a git repo and edited by PR. The file is hot-reloaded by the engine on a configurable interval — so the surface area of a policy change is a diff, a review, and a merge.

## :material-file-document-edit-outline: Lookup entry format

```
<fieldSet>,<encode>:<untilEpochSec>[:<reason>]
```

- `<fieldSet>` — the joined values of `compactRegulatorFieldNames` on the event. With the default `[symbolMessage]` it's just the symbolMessage value (e.g. `payment_retry_gateway_timeout`); with `[symbolMessage, container]` it becomes `<symbolMessage>_<container>`.
- `<encode>` — `true` to compact via `encode()`, `false` to preserve `fullText`. Entries are *deviations* from `compactRegulatorDefault`.
- `<untilEpochSec>` — Unix epoch timestamp at which the entry self-expires. Past that, the regulator falls back to `compactRegulatorDefault`.
- `<reason>` — optional free-text audit note (e.g. ticket ID, incident name, policy owner).

**Example** (with `compactRegulatorFieldNames: [symbolMessage]` and `compactRegulatorDefault: false`):

```csv
key,value
payment_retry_gateway_timeout,true:1745856000:OPS-5123 spike mitigation
auth_audit_trail,false:1745856000:compliance — keep verbose
```

## :material-swap-horizontal: Default policy

`compactRegulatorDefault` sets the fallback decision when no entry matches:

- **`false`** (default) — preserve `fullText`. Entries opt specific patterns *into* compaction. Right when most traffic is already high-signal.
- **`true`** — compact via `encode()`. Entries opt specific patterns *out* of compaction (e.g. audit/compliance patterns that must stay verbose). Right when most traffic is low-signal machinery and only a few patterns need full-text fidelity.

Flipping the default is a policy decision that affects every event and requires a pod rollout. Lookup edits handle pattern-level exceptions without restart.

## :material-timer-refresh-outline: Hot reload

The engine re-reads the lookup file every `compactRegulatorLookupRetain` ms (default `5m`). Shorter values make GitOps changes land faster at the cost of more file I/O. Expired entries self-heal to `compactRegulatorDefault` on the next read.

## :material-cog-box: Wiring

- Set `compactRegulatorLookupFile` to the CSV path — that's the single gate that loads the module (both `CompactInput` and `CompactObject` check it in `shouldLoad`).
- The forwarder output streams then branch on a single ternary field expression: `output=shouldEncode() ? encode() : fullText`. No field mutation — the decision lives in the stream expression, not on the event.
- When `compactRegulatorLookupFile` is *not* set, the pre-compact path is preserved unchanged (regulate-only emits `fullText`; `fluentbitEncodeObjects=true` emits `encoded=encode()` for every event).
