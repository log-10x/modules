---
icon: material/greater-than
---

Splunk Universal Forwarder inputs use a **file relay pattern** with [Fluent Bit + 10x](../fluentbit/) to process events _before_ Splunk UF ships them to Splunk indexers. This approach keeps UF as the forwarder (handling buffering, retries, timeouts) while 10x filters and (optionally) compacts events inline.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📝 App Logs</div><div style='font-size: 10px;'>Folder A</div>"] --> B["<div style='font-size: 14px;'>🔧 Fluent Bit</div><div style='font-size: 10px;'>+ 10x sidecar</div>"]
    B --> C["<div style='font-size: 14px;'>📂 Processed</div><div style='font-size: 10px;'>Folder B</div>"]
    C --> D["<div style='font-size: 14px;'>📤 Splunk UF</div><div style='font-size: 10px;'>monitors B</div>"]
    D --> E["<div style='font-size: 14px;'>🔍 Splunk</div><div style='font-size: 10px;'>Indexers</div>"]

    classDef logs fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef fluentbit fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef processed fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef uf fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef splunk fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A logs
    class B fluentbit
    class C processed
    class D uf
    class E splunk
```

</div>

### Data Flow

- 📝 **App Logs (Folder A)** - Application writes logs to original location
- 🔧 **Fluent Bit + 10x** - Reads from Folder A, filters and (optionally) compacts events
- 📂 **Processed Logs (Folder B)** - 10x writes processed output to new location
- 📤 **Splunk UF** - Monitors Folder B with standard `inputs.conf`, handles forwarding
- 🔍 **Splunk Indexers** - Receives processed events via standard S2S protocol

### Why File Relay?

| Benefit | Description |
|---------|-------------|
| 🔧 **Standard UF** | No protocol changes, no `enableOldS2SProtocol` flag |
| 👤 **App Team Control** | Configure without Splunk admin involvement |
| 🔒 **UF Handles Reliability** | Buffering, retries, and timeouts stay with UF |
| ✅ **Proven Pattern** | Uses existing [Fluent Bit + 10x](../fluentbit/) integration |

### When to Use

This module is recommended for **VM/traditional infrastructure** where Splunk UF is deployed. For Kubernetes environments, Splunk recommends [Splunk Connect for Kubernetes](https://github.com/splunk/splunk-connect-for-kubernetes) (which uses Fluent Bit) - use the [Fluent Bit module](../fluentbit/) directly in that case.

??? tenx-keyfiles "Key Files"

    This module uses the [Fluent Bit forwarder module](../fluentbit/) under the hood:

    | File | Purpose |
    |------|---------|
    | [`fluentbit/conf/tenx-sidecar.conf`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-sidecar.conf) | Reference Fluent Bit config showing the 10x sidecar handoff |

## Quickstart

These steps send compact events to Splunk through the Universal Forwarder. The [Log10x App](https://doc.log10x.com/apps/receiver/compact/splunk/) expands them at search time.

**1. Run Log10x** on the host that runs Fluent Bit ([install on Linux](https://doc.log10x.com/install/linux/)), with the three options the Splunk app needs and `receiverOptimize`:

```bash
tenx @run/input/forwarder/fluentbit @apps/receiver receiverOptimize true varMaxRecurIndexes 0 timestampZone UTC timestampMaxPerObject 1
```

**2. Write the processed events to Folder B.** Fluent Bit reads Folder A, hands each record to Log10x, and writes what comes back into Folder B: each source's compact events in a file of their own, one event per line, and the template records in another file, one JSON object per line.

```ini title="fluent-bit.conf"
[INPUT]
    Name            tail
    Path            /var/log/app/app.log
    DB              /var/log/app/app.log.db
    Tag             app.logs
    Read_from_Head  true

[OUTPUT]
    Name            forward
    Match           app.*
    Host            127.0.0.1
    Port            24224
    Retry_Limit     False

[INPUT]
    Name            forward
    Listen          0.0.0.0
    Port            24225
    Tag_Prefix      tenx.

[OUTPUT]
    Name            file
    Match           tenx.app.logs
    Path            /var/log/tenx
    File            app.log
    Format          template
    Template        {log}

[OUTPUT]
    Name            file
    Match           tenx.tenx-template
    Path            /var/log/tenx
    File            templates.log
    Format          plain
```

**3. Monitor Folder B with the Universal Forwarder.** Add both files to `inputs.conf` on the forwarder:

```ini title="inputs.conf"
[monitor:///var/log/tenx/app.log]
index = your_logs_index
sourcetype = tenx_encoded
_meta = tenx_sourcetype::your:original:sourcetype

[monitor:///var/log/tenx/templates.log]
index = tenx_dml
sourcetype = tenx_dml_raw_json
```

`tenx_encoded` is the sourcetype the app expands. `_meta` adds the indexed field `tenx_sourcetype`, holding the sourcetype the events have when sent raw (for example `XmlWinEventLog` or `aws:cloudtrail`); the app's `txf` macro reads it to apply that sourcetype's field extractions. The template records go to the `tenx_dml` index, from which the app fills its KV Store.

Create both indexes, `tenx_dml` and the compact index, where the events are indexed before the forwarder sends.

For a source read by a [field map](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#data-models-and-detections-the-field-map), run Log10x for it as the field map describes and monitor its file with the field map's compact sourcetype in place of `tenx_encoded`, for Windows Security `sourcetype = tenx_win`.

The forwarder reads a file once it holds at least 256 bytes. A compact file that stays smaller is forwarded after it grows past that size.

**4. Install the Log10x App** on the search heads and on the instances that parse the events: the indexers, or the heavy forwarder the Universal Forwarder sends to. The app sets each compact event's time while the event is parsed.

!!! warning
    With the Receiver on each host, before the heavy forwarder, the heavy forwarder's index-time rules do not apply to compact events: index overrides, masks (`SEDCMD`, `_raw` rewrites), `nullQueue` filters and index-time fields. A value such a mask hides on raw events is readable after expansion, and events such a filter drops are indexed and counted against the license.
