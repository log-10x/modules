---
icon: material/tune-variant
---

Compact specific containers' events into a template+values tuple — without redeploying the engine.

The compact receiver makes a per-event decision whether to emit via `encode()` (the pattern's template hash plus extracted variable values, typically 20–40× smaller than the original line) or preserve `fullText`. The decision is keyed by the container name (or any event field of your choice), so an operator targets compaction at the same unit they think about cost in.

Entries live in a CSV cap-file, typically committed to a git repo and edited by PR. The file is hot-reloaded on in-place writes; a merged PR takes effect within ~10 seconds, no pod restart.

## :material-clipboard-list-outline: Per-container caps

A cap-file declares, for each container, whether its events are compacted or preserved. Containers not listed fall back to `compactReceiverDefault`.

**File format**, CSV with a header row, keyed by the `containerField` value (k8s container name by default):

```csv
container,value
<container>,<true|false>[:<untilEpochSec>][:<reason>]
```

- `container` — the value of `containerField`. Stable across pod replicas in Kubernetes.
- `value` — `true` compacts via `encode()`; `false` explicitly preserves `fullText` for this container (beats the default).
- `untilEpochSec` — optional Unix-epoch (seconds) expiry. Past it the entry self-heals and the container falls back to `compactReceiverDefault`.
- `reason` — optional free-text for audit. Must not contain commas (would break CSV parsing).

**Example** (with `compactReceiverDefault: false`):

```csv
container,value
payment-service,true:1735689600:high-volume PAY-101
auth-service,true
istio-proxy,false:1735689600:keep verbose during incident PLAT-42
```

The file is hot-reloaded on in-place writes (the gitops pattern); a Kubernetes `ConfigMap` mount won't reload because the CM swap is a symlink rename, not an in-place write.

## :material-kubernetes: Containers

The lookup is scoped by `containerField`, defaulting to the k8s container name. That name is stable across replicas, so scaling from one pod to ten does not unintentionally change a container's compaction decision, and a sidecar never inherits the application container's decision. Set `containerField` to any other event field to scope by service, deployment, tenant, etc.

Outside Kubernetes, or when no container field is present on an event, the event falls back to `compactReceiverDefault`.

## :material-swap-horizontal: Default policy

`compactReceiverDefault` sets the fallback decision when no cap-file entry matches:

- **`false`** (default) — preserve `fullText`. Cap-file entries opt specific containers *into* compaction. Right when most traffic is already high-signal.
- **`true`** — compact via `encode()`. Cap-file entries opt specific containers *out* of compaction (e.g. audit/compliance containers that must stay verbose). Right when most traffic is low-signal machinery and only a few containers need full-text fidelity.

Flipping the default is a policy decision that affects every event and requires a pod rollout. Cap-file edits handle per-container exceptions without restart.

## :material-cog-box: Wiring

```yaml
compactReceiver:
  containerField: k8s_container      # scopes the cap-file lookup
  default: false                     # fallback when no entry matches
  lookup:
    file: $=path("data/caps") + "/compact-cap.csv"
    retain: $=parseDuration("10m")
```

- Set `compactReceiverLookupFile` (via the `lookup.file` config key) to the CSV path. That same env var is also the gate the engine's `TenXReceiver.encodeField()` checks to substitute `encoded=shouldEncode() ? encode() : fullText` into the forwarder output stream.
- Both `CompactInput` and `CompactObject` check `compactReceiverLookupFile` in `shouldLoad`, so they only register when the cap-file is configured.
- When `compactReceiverLookupFile` is *not* set, the pre-compact path is preserved unchanged (receive-only emits `fullText`; `receiverOptimize=true` emits `encoded=encode()` for every event).

Tune these values in this config block, not via container environment variables. Any `compactReceiver:` key set here resolves to a launch argument at engine init and shadows a same-named env var, so env-only overrides are silently ignored. Edit the config (via a gitops PR) to change a value at runtime.
