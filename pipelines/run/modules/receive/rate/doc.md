---
icon: material/progress-check
---

Hold each log pattern, and each service, to a budget per window, on the forwarder, before that volume is billed downstream. Lines over a budget take the service's action; error-class lines keep a fixed count per pattern, and a pattern an operator lists in the mute file follows its own entry instead of the cap.

The rate regulator watches each container's recent volume and acts on any one [pattern](https://doc.log10x.com/run/initialize/message/ "the message symbol sequence that identifies a log type") that spends more than the cap set for that container. That pattern is the same value, in the field `symbolMessageField` names (`message_pattern` in the shipped configuration), that a Reporter attributes cost to, so a top spender maps straight to what gets regulated. No cap ships by default, so nothing is regulated until an operator sets one.

## :material-percent-outline: The cap

The cap is a budget for one pattern in one container over one window (`resetIntervalMs`, default 4 minutes). The regulator counts it in `unit`: `bytes`, the UTF-8 size of each event as the forwarder hands it to the Receiver, the whole record and not only the message, or `events`, one per line, for analyzers that bill per event such as Datadog. The cap and total files are written in the same unit. The cap resolves per event: the container's row in the cap file, then the file's `*` row, then the fleet-wide `absoluteCap`. All three default to none, and a resolved cap of `0` means keep everything, so protection is opt-in.

Each regulator instance starts its first window at the first line it regulates and a new one every `resetIntervalMs` after that, the same windows for all its patterns and services. They do not follow the clock, so a count over a 4-minute span of the clock can include the end of one window and the start of the next. A policy file reload does not start a new window.

At or below the cap every line is kept. Above it a line is held and takes the container's action, with three exceptions: the first `baselineCount` lines of every pattern each window (default 5), the error-class lines in `keepCounts`, and the optional share guard.

With the shipped settings, the most one pattern in one container passes per window is the larger of its cap and the 5-line sample, plus 50 lines for an error-class pattern. The window is recent rather than all-time, so a pattern that spikes during a deploy and then goes quiet stops being held on its own.

The share guard is off by default (`minSharePercent: 0`). Set above 0, it keeps a pattern over its cap while the pattern is below that share of its container's volume, `(pattern units + event) / (container units + event)` over the window.

## :material-sigma: Service totals

An optional total file bounds what each service passes per window on this node, across all its patterns. New patterns from a deploy each bring a full per-pattern cap, so a service without a total can send many times its budget until its caps are rewritten. Two rules apply once a service has a total:

- **Largest first.** When the service's caps alone let more than its total through in the previous window, every pattern's cap scales by total / that amount for the whole window, or by what they let through so far this window once that is larger. The service's largest patterns reach the scaled cap first and are held, and its small ones keep passing. The scale follows the previous window, so the window after a storm is scaled by the storm for its whole length and recovers the window after. The first window after a quiet one fills its total in arrival order before the scale applies. A service whose first lines of this window and of the last window it sent in are two window lengths or more apart scales by total / its units so far this window instead.
- **Hard bound.** Once the lines the service passed reach its total, every further line takes the service's action.

The baseline sample counts toward the total like any line. Once the total is spent, the service passes at most `baselineMaxOverTotal` more sample lines in the window (default 50, counted in lines whatever the `unit`), and the rest of its samples take the service's action, so a service that prints many new patterns at once exceeds its total by that many lines at most. The error-class lines in `keepCounts` and the lines a mute entry passes always pass and count toward the total, so the service's other patterns give way first; an error storm can exceed the total by the keep count per storming pattern, with no limit per service. Each regulator instance holds its own total; the MCP's budget run (`log10x_setup_recurring`) divides a fleet budget across instances, and a node added between runs enforces its own total until the next run.

**File format**, CSV with a header row, keyed by the `containerField` value, read through `totalLookupFile` (`TOTAL_LOOKUP_FILE`):

```
container,total
<container>,<total>[:<untilEpochSec>][:<reason>]
*,<total>[:<untilEpochSec>][:<reason>]
```

- `total` is the service's total per window on this instance, in `unit`. `0` exempts the service.
- `*` sets the total for every service without a row of its own; a `*` row of `0` gives them none.
- `untilEpochSec` expires the entry, which then self-heals to a no-op.
- `reason` is free text for audit. Must not contain commas (would break CSV parsing).

A missing total file loads as an empty table, so no service has a total until a row names it. Totals apply to containers with a cap, in the regulators that read the cap file.

## :material-shield-alert-outline: Error-class lines

Error-class lines are never held to zero. `keepCounts` passes a fixed number of lines per pattern per window for each listed level, once the pattern is over its cap or its service is over its total, and under an active mute entry. The shipped list is `ERROR=50`, `CRITICAL=50` and `FATAL=50`; the lines past the count take the container's action. The count is per pattern, per container, per node, per window, so it bounds what an error storm adds to the bill.

ERROR, CRITICAL and FATAL always keep a count, 50 unless `keepCounts` sets another: the module sets the three itself and entries merge by level, so changing one means setting it. Any other level not in `keepCounts`, and a level set to `-1` there, follows `severityFloors`, the fraction of a held pattern's lines kept at random. The shipped floors are `0` for every level, and any level with no floor of its own takes `minRetentionThreshold` (`0`). Both lists read the [severity](https://doc.log10x.com/run/initialize/level/) the level enrichment produced, so they apply whatever field the original log used. A config without `keepCounts` therefore still keeps them; `severityFloors` must stay set, since an empty or missing list stops the launch.

## :material-timer-sand: Warmup

An optional `warmupMs` leaves a container unregulated for that long after this regulator instance first sees its events. The default is `0`, so a container is capped from its first line. Set it for slow-ramping JVMs or workloads with long init phases whose first minutes should not be capped.

"First sees" is per regulator instance, not per container birth. A container that has been running for hours but whose events have only just started flowing through this regulator, after a regulator restart or a forwarder reconnect, restarts the warmup window. With a warmup set, a daemonset rolling restart therefore disables the cap for `warmupMs` per node as it cycles.

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

The error-class levels in `keepCounts` still pass their count per pattern per window before the sample rate applies, so a `0` mute never silences ERROR, CRITICAL or FATAL. The file is typically committed to a repo and pulled via [gitops](https://doc.log10x.com/config/github/#config), or read directly from a Kubernetes ConfigMap via the [`@kubernetes` launch macro](https://doc.log10x.com/config/k8s/), so each change carries a diff, a review, and a merge. Both lanes hot-reload via atomic rename; a plain volume-mounted `ConfigMap` does not, because the swap is a symlink rename.

## :material-clipboard-list-outline: Per-container caps

An optional cap file sets a cap for a specific container in priority over the fleet-wide `absoluteCap`. Listed containers get their own row; unlisted containers get the `*` row, and with no `*` row they fall back to `absoluteCap` (or to no cap, when `absoluteCap` is 0).

**File format**, CSV with a header row, keyed by the `containerField` value (k8s container name by default):

```
container,cap
<container>,<cap>[:<untilEpochSec>][:<reason>]
*,<cap>[:<untilEpochSec>][:<reason>]
```

- `cap` is the per-pattern per-window cap for the container, in `unit`. `0` exempts the container from every cap, the `*` row and `absoluteCap` included.
- `*` sets the cap for every container without a row of its own; a `*` row of `0` exempts them all, `absoluteCap` included.
- `untilEpochSec` expires the entry, which then self-heals to a no-op.
- `reason` is free text for audit. Must not contain commas (would break CSV parsing).

The cap value changes; the baseline sample, the keep counts and the service total still apply. The Log10x MCP writes the file: its budget run (`log10x_setup_recurring`) writes it to the policy ConfigMap or commits it to the policy branch, and a `log10x_configure_engine` call derives caps from a target percent or a monthly dollar budget and delivers them as its `delivery` says: a PR against the gitops repo, a write to the policy ConfigMap, or no write (`stdout_only`).

Same hot-reload rule as the mute file: both launch-macro lanes reload, a plain volume-mounted `ConfigMap` does not.

From a policy repo, the GitHub lane in `pipelines/gitops/config.yaml` pulls `log10x/policy/*.csv` and mirrors it into `${GH_DEST}` (default `${java.io.tmpdir}/tenx/github`). With `GH_ENABLED=true`, `GH_REPO`, `GH_BRANCH` and `GH_TOKEN` set, the cap, action, total and config-generation files default to those copies, and each sync rewrites them in place. The folder must exist in the repo and hold `caps.csv` when the engine starts, and a sync refreshes only the files the first pull found. With the ConfigMap lane (`K8S_ENABLED=true`) also on, the GitHub copies win for these four files, so enable one lane.

## :material-arrow-decision: Actions

An optional action file decides what happens to the lines the cap or the service total holds. Without it, or for a container with neither its own row nor a `*` row, the held lines take `rateReceiverDefaultAction`, `pass` unless set.

**File format**, CSV with a header row, keyed by the same `containerField` value as the cap file:

```
container,action
<container>,<action>[:<untilEpochSec>][:<reason>]
*,<action>[:<untilEpochSec>][:<reason>]
```

- `action` is one of `pass`, `offload`, `tier_down`, `compact`, `sample`, or `drop`. `*` sets the action for every container without a row of its own; a container with neither takes `rateReceiverDefaultAction`, `pass` unless set.
- `untilEpochSec` expires the entry, which then self-heals to a no-op.
- `reason` is free text for audit. Must not contain commas (would break CSV parsing).

The action is set per service and applies to every held line in that service. Here a service is a container. Per-pattern thinning comes from the mute file, not from this file.

The event keeps flowing either way. The action lands on the event as its `routeState`, and the output streams and the forwarder recipe act on that, so `offload` and `tier_down` reach their destinations instead of being discarded at the regulator. The cap and the total decide which lines are held; the action only decides where they go.

The action and total files are siblings of the cap file in the same ConfigMap, and hot-reload on the same rule.

## :material-kubernetes: Containers

Share is scoped per container, named by `containerField` (default the k8s container name). That name is stable across replicas, so scaling from one pod to ten does not bypass the cap, and a sidecar never spends the application container's share. Use `container`, never `pod`.

Outside Kubernetes, or when no container field is present, the regulator falls back to a single node-wide bucket and caps each pattern across the node.

## :material-cash-multiple: Savings

Held lines are measured, not estimated. The receive-stage aggregators tally every event by pattern and container both before and after regulation, so the saving for a pattern is the volume seen minus the volume emitted. A dropped event still counts as seen, so the figure reflects exactly what the regulator removed.

## :material-tag-check-outline: Config-version stamp

When the receiver runs the MCP closed loop, the control plane (`log10x_configure_engine`) writes a `config-generation.csv` next to the cap file in the same ConfigMap, a one-row `key,value` CSV whose `generation` is a hash of the cap policy. Point `configGeneration.file` at it (or set the `CONFIG_GENERATION_FILE` env) and the receiver stamps that value on every event as the `tenx_config_version` metric label, so the running engine advertises which config generation it loaded. The MCP then confirms the policy it wrote is actually live by comparing the label to the hash of the current caps, the config-generation closed loop.

It is opt-in and decoupled from caps: unset by default, so a regulator managed by GitOps without the MCP emits no `tenx_config_version` label and never depends on the file existing. Hot-reloaded like the cap file, so a new generation goes live without an engine restart (this is the stale → live transition the verifier observes).

## :material-cog-box: Wiring

```yaml
rateReceiver:
  fieldNames:
    - message_pattern        # the pattern identity, the field symbolMessageField names
  containerField: container  # scopes the cap denominator
  unit: bytes                # or events, for analyzers that bill per event
  absoluteCap: 10485760      # 10 MB per pattern per container per window (optional; 0 = no fleet-wide cap)
  minSharePercent: 0         # share guard, off
  keepCounts:                # error-class lines kept per pattern per window once held
    - ERROR=50
    - CRITICAL=50
    - FATAL=50
  severityFloors:            # random share kept for the other levels once held
    - TRACE=0
    - DEBUG=0
    - INFO=0
    - WARN=0
    - ERROR=0
    - CRITICAL=0
    - FATAL=0
  warmupMs: 0                # per-instance grace before capping; 0 caps from the first line
  baselineCount: 5
  baselineMaxOverTotal: 50   # sample lines a service passes per window once over its total; 0 = no bound
  capLookup:
    # file: $=path("data/caps") + "/caps.csv"   # optional per-container caps, with a * row
    retain: $=parseDuration("10m")
  # actionLookupFile: $=path("data/caps") + "/actions.csv"  # optional per-container action for held lines; default pass
  # totalLookupFile: $=path("data/caps") + "/totals.csv"    # optional per-service total per window
  configGeneration:
    # file: $=TenXEnv.get("CONFIG_GENERATION_FILE", "")   # MCP config-version stamp; opt-in, sibling of caps.csv
```

Tune these values in this config block, not via container environment variables. Any `rateReceiver:` key set here resolves to a launch argument at engine init and shadows a same-named env var, so env-only overrides are silently ignored. Edit the config (via a gitops PR) to change a value at runtime.
