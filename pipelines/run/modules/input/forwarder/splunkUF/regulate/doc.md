---
icon: material/pipe-valve
---

Read events from application logs to transform into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) and filter using local/centralized [reducer](https://doc.log10x.com/run/output/regulate) policies, before Splunk UF ships them to indexers. This module is a component of the [Reducer](https://doc.log10x.com/apps/reducer/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📝 App Logs</div><div style='font-size: 10px;'>Folder A</div>"] --> B["<div style='font-size: 14px;'>🔧 Fluent Bit</div><div style='font-size: 10px;'>tail input</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Reducer</div><div style='font-size: 10px;'>filter policy</div>"]
    C --> D["<div style='font-size: 14px;'>📂 Processed</div><div style='font-size: 10px;'>Folder B</div>"]
    D --> E["<div style='font-size: 14px;'>📤 Splunk UF</div><div style='font-size: 10px;'>monitors B</div>"]
    E --> F["<div style='font-size: 14px;'>🔍 Splunk</div><div style='font-size: 10px;'>Indexers</div>"]

    classDef logs fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef fluentbit fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef processed fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef uf fill:#64748b,stroke:#475569,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef splunk fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A logs
    class B fluentbit
    class C engine
    class D processed
    class E uf
    class F splunk
```

</div>

### Data Flow

- 📝 **App Logs (Folder A)** - Application writes ALL logs to original location
- 🔧 **Fluent Bit** - Reads from Folder A, passes events to 10x sidecar
- ⚡ **10x Reducer** - Applies rate/policy-based filtering, drops noisy events
- 📂 **Processed (Folder B)** - Only FILTERED events written to new location
- 📤 **Splunk UF** - Monitors Folder B, forwards reduced volume to Splunk
- 🔍 **Splunk Indexers** - Receives filtered events (reduced volume)

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 🚦 **Rate Limiting** | Filter events based on per-template rate limits |
| 📋 **Policy-Based** | Apply local or centralized filtering policies |
| 💰 **Cost Control** | Reduce Splunk ingestion volume and costs |
| 📤 **UF Handles Delivery** | Splunk UF manages buffering, retries, timeouts |

### :material-swap-horizontal-circle-outline: File Relay Pattern

This [module](https://doc.log10x.com/engine/module/) configures a file relay where Fluent Bit reads application logs, passes them through a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) for regulation, then writes only the filtered events to a folder that Splunk UF monitors. Noisy/repetitive events are dropped before reaching Splunk.

### :material-download-outline: Install

=== ":material-laptop: Nix/OSX"

    See the [Quickstart](#quickstart) below or the Log10x Reducer [run instructions](https://doc.log10x.com/apps/reducer/run/#splunk-uf)

## Quickstart

??? tenx-bootstrap "Step 1: Set Environment Variables"

    ```bash
    export TENX_MODULES=/etc/tenx/modules
    export FOLDER_A=/var/log/app
    export FOLDER_B=/var/log/processed
    ```

??? tenx-config "Step 2: Configure Fluent Bit"

    ```toml title="fluent-bit.conf"
    [SERVICE]
        Flush        1
        Log_Level    info

    [INPUT]
        Name         tail
        Path         ${FOLDER_A}/*.log
        Tag          app.logs

    # Include 10x reducer
    @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-regulate.conf

    # Write filtered events to Folder B for Splunk UF
    [OUTPUT]
        Name         file
        Match        *
        Path         ${FOLDER_B}
        Format       plain
    ```

??? tenx-forwarderinputs "Step 3: Configure Splunk UF"

    ```ini title="inputs.conf"
    [monitor://${FOLDER_B}]
    index = main
    sourcetype = app_logs
    ```

??? tenx-run "Step 4: Run"

    ```bash
    fluent-bit -c fluent-bit.conf
    ```

    Compare the line counts in Folder A vs Folder B to see regulation in action.
