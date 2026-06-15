---
icon: material/progress-check
---

Stop any single log pattern from dominating its container's volume, on the forwarder, before that volume is billed downstream. Errors and warnings keep flowing, and patterns on a protection list are never touched.

The rate regulator watches each container's recent volume and trims back any one [pattern](https://doc.log10x.com/run/initialize/message/ "the message symbol sequence that identifies a log type") that crosses a fixed share of it. That pattern is the same `symbolMessage` value a Reporter attributes cost to, so a top spender maps straight to what gets regulated. Nothing is sampled until a pattern actually dominates.

## :material-percent-outline: The cap

A pattern is left alone until it crosses `maxSharePerFieldSet` (default 20%) of its container's recent volume. At or below the cap every event is kept. Above it, the pattern is trimmed back toward the cap by dropping a fraction of its events.

Share is measured per container over a rolling window (`resetIntervalMs`, default 4 minutes): `(pattern bytes + event) / (container bytes + event)`. The window is recent rather than all-time, so a pattern that spikes during a deploy and then goes quiet stops being trimmed on its own.

## :material-shield-alert-outline: Severity floors

The cap never silences high-severity logs. `severityFloors` sets a minimum retention per level that beats the cap: even a pattern over its cap keeps at least Error 50%, Warn 30%, Info 10%. The floor reads the [severity](https://doc.log10x.com/run/initialize/level/) the level enrichment produced, so it applies whatever field the original log used.

## :material-timer-sand: Warmup

A container is left unregulated for `warmupMs` (default 5 minutes) after this regulator instance first sees its events. Lower for fast-starting apps that should be capped sooner after a restart, raise for slow-ramping JVMs or workloads with long init phases.

The warmup exists because the regulator's per-pattern sample counts start empty. Without a few minutes of accumulation, a low-volume pattern can look dominant purely because of ordering. Five minutes gives enough samples for typical Kubernetes traffic to tell a noisy pattern from a quiet one.

"First sees" is per regulator instance, not per container birth. A container that has been running for hours but whose events have only just started flowing through this regulator, after a regulator restart or a forwarder reconnect, restarts the warmup window. On a daemonset rolling restart the cap is therefore disabled for `warmupMs` per node as it cycles.

The first `baselineCount` events (default 5) of every pattern are also kept each window, so even a heavily-trimmed pattern leaves a sample to inspect.

## :material-file-document-edit-outline: Protection list

An optional mute file overrides the regulator for patterns an operator has declared. A listed, active pattern is decided by its entry, so the human declaration wins and the regulator is skipped for it; every other pattern is handled by the cap. The two run together rather than as separate modes.

**File format**, CSV with a header row, keyed by the joined `fieldNames`:

```
fieldSet,value
<fieldSetKey>,<sampleRate>:<untilEpochSec>[:<reason>]
```

- `sampleRate` retains that fraction: `1` is never sampled, `0` is a full mute.
- `untilEpochSec` expires the entry, which then self-heals to a no-op.
- `reason` is free text for audit.

The severity floor still applies, so a `0` mute never silences ERROR or FATAL. The file is typically committed to a repo and pulled via [gitops](https://doc.log10x.com/config/github/#config), or read directly from a Kubernetes ConfigMap via the [`@kubernetes` launch macro](https://doc.log10x.com/config/k8s/), so each change carries a diff, a review, and a merge. Both lanes hot-reload via atomic rename; a plain volume-mounted `ConfigMap` does not, because the swap is a symlink rename.

## :material-clipboard-list-outline: Per-container caps

An optional cap file sets a byte cap for a specific container in priority over the fleet-wide `absoluteCap`. Listed containers get the file's cap; unlisted containers fall back to `absoluteCap` (or to no cap, when `absoluteCap` is 0).

**File format**, CSV with a header row, keyed by the `containerField` value (k8s container name by default):

```
container,cap
<container>,<bytes>[:<untilEpochSec>][:<reason>]
```

- `bytes` is the per-pattern per-window cap for the container. `0` exempts the container from the absolute cap.
- `untilEpochSec` expires the entry, which then self-heals to a no-op.
- `reason` is free text for audit. Must not contain commas (would break CSV parsing).

The cap value changes; the share guard and severity floor still apply. Intended use is via the `log10x_configure_regulator` MCP tool, which derives per-container caps from a monthly dollar budget and opens a PR against the file.

Same hot-reload rule as the mute file: both launch-macro lanes reload, a plain volume-mounted `ConfigMap` does not.

## :material-kubernetes: Containers

Share is scoped per container, named by `containerField` (default the k8s container name). That name is stable across replicas, so scaling from one pod to ten does not bypass the cap, and a sidecar never spends the application container's share. Use `container`, never `pod`.

Outside Kubernetes, or when no container field is present, the regulator falls back to a single node-wide bucket and caps each pattern across the node.

## :material-cash-multiple: Savings

Drops are measured, not estimated. The receive-stage aggregators tally every event by pattern and container both before and after regulation, so the saving for a pattern is the volume seen minus the volume emitted. A dropped event still counts as seen, so the figure reflects exactly what the regulator removed.

## :material-cog-box: Wiring

```yaml
rateReceiver:
  fieldNames:
    - symbolMessage          # the pattern identity
  containerField: container  # scopes the cap denominator
  absoluteCap: 10485760      # 10 MB per pattern per container per window (optional; 0 = no fleet-wide cap)
  minSharePercent: 0.05      # share guard (sanity)
  severityFloors:
    - INFO=0.1
    - WARN=0.3
    - ERROR=0.5
  warmupMs: 300000           # 5m per-instance grace; raise for slow-ramping apps
  baselineCount: 5
  capLookup:
    # file: $=path("data/caps") + "/caps.csv"   # optional per-container overrides
    retain: $=parseDuration("10m")
```

Tune these values in this config block, not via container environment variables. Any `rateReceiver:` key set here resolves to a launch argument at engine init and shadows a same-named env var, so env-only overrides are silently ignored. Edit the config (via a gitops PR) to change a value at runtime.
