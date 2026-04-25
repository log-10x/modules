---
icon: material/tune-variant
---

Ship every high-value event as full text and every low-signal event as a compact template+values tuple — without redeploying the engine.

The compact reducer makes a per-event decision whether to emit via `encode()` (the pattern's template hash plus extracted variable values — typically 20–40× smaller than the original line) or preserve `fullText`. The decision is keyed by the same field-set identity the [rate reducer](https://doc.log10x.com/run/regulate/rate/) uses, so the same `symbolMessage` value a Reporter attributes cost to is the key an operator targets to reduce that cost.

Entries are declared in a CSV lookup file, typically committed to a git repo and edited by PR. The file is re-read on forwarder pod restart — so the surface area of a policy change is a diff, a review, a merge, and a rolling restart.

## :material-file-document-edit-outline: Lookup entry format

Standard CSV with a `key,value` header:

```csv
key,value
<fieldSet>,true
<fieldSet>,false
```

- `<fieldSet>` — the joined values of `compactReducerFieldNames` on the event. With the default `[symbolMessage]` it's just the symbolMessage value (e.g. `payment_retry_gateway_timeout`); with `[symbolMessage, container]` it becomes `<symbolMessage>_<container>`.
- `value` — `true` to compact via `encode()`, `false` to preserve `fullText`. Entries are *deviations* from `compactReducerDefault`.

**Example** (with `compactReducerFieldNames: [symbolMessage]` and `compactReducerDefault: false`):

```csv
key,value
payment_retry_gateway_timeout,true
auth_audit_trail,false
```

For time-bounded overrides, remove the entry via PR once no longer needed — the reducer falls back to `compactReducerDefault` for any unlisted field-set.

## :material-swap-horizontal: Default policy

`compactReducerDefault` sets the fallback decision when no entry matches:

- **`false`** (default) — preserve `fullText`. Entries opt specific patterns *into* compaction. Right when most traffic is already high-signal.
- **`true`** — compact via `encode()`. Entries opt specific patterns *out* of compaction (e.g. audit/compliance patterns that must stay verbose). Right when most traffic is low-signal machinery and only a few patterns need full-text fidelity.

Flipping the default is a policy decision that affects every event and requires a pod rollout. Lookup edits handle pattern-level exceptions without restart.

## :material-timer-refresh-outline: Reload

The lookup file is read once at pod startup. Pushing a new entry requires a rolling restart of the forwarder daemonset for it to take effect.

`compactReducerLookupRetain` controls the staleness warning logged at startup when the file's mtime is older than the interval (default `5m`). It does not currently trigger a mid-run reload — reload-on-file-change is a planned enhancement.

## :material-cog-box: Wiring

- Set `compactReducerLookupFile` to the CSV path — that's the single gate that loads the module (both `CompactInput` and `CompactObject` check it in `shouldLoad`).
- The forwarder output streams then branch on a single ternary field expression: `encoded=shouldEncode() ? encode() : fullText`. No field mutation — the decision lives in the stream expression, not on the event.
- When `compactReducerLookupFile` is *not* set, the pre-compact path is preserved unchanged (regulate-only emits `fullText`; `reducerOptimize=true` emits `encoded=encode()` for every event).
