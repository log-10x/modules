---
icon: material/pipe-wrench
---

[Losslessly compact](https://doc.log10x.com/run/transform/#compact) log/trace events before Splunk UF ships them to indexers. This module is a component of the [Regulator with optimization](https://doc.log10x.com/apps/regulator/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📝 App Logs</div><div style='font-size: 10px;'>Folder A</div>"] --> B["<div style='font-size: 14px;'>🔧 Fluent Bit</div><div style='font-size: 10px;'>tail input</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Optimizer</div><div style='font-size: 10px;'>encode()</div>"]
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

- 📝 **App Logs (Folder A)** - Application writes logs to original location
- 🔧 **Fluent Bit** - Reads from Folder A, passes events to 10x sidecar
- ⚡ **10x Optimizer** - Losslessly [compacts](https://doc.log10x.com/run/transform/#compact) events to reduce log volume 50-80%
- 📂 **Processed (Folder B)** - COMPACT events written to new location (smaller)
- 📤 **Splunk UF** - Monitors Folder B, forwards reduced volume to Splunk
- 🔍 **Splunk Indexers** - Receives optimized events at reduced size

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📦 **Lossless Compact** | Compacts events to reduce log volume 50-80% |
| 🔗 **Template Extraction** | Repetitive structures become reusable templates |
| 💰 **Cost Savings** | Reduced Splunk ingestion, storage, and license costs |
| 📤 **UF Handles Delivery** | Splunk UF manages buffering, retries, timeouts |

### :material-swap-horizontal-circle-outline: File Relay Pattern

This [module](https://doc.log10x.com/engine/module/) configures a file relay where Fluent Bit reads application logs, passes them through a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) for optimization, then writes compact events to a folder that Splunk UF monitors. The compact events are 50-80% smaller, reducing Splunk ingestion costs.

### :material-download-outline: Install

=== ":material-laptop: Nix/OSX"

    See the [Quickstart](#quickstart) below or the Log10x Regulator with optimization [run instructions](https://doc.log10x.com/apps/regulator/run/#splunk-uf)

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

    # Include 10x optimizer
    @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-optimize.conf

    # Write encoded events to Folder B for Splunk UF
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
    sourcetype = app_logs_encoded
    ```

??? tenx-run "Step 4: Run"

    ```bash
    fluent-bit -c fluent-bit.conf
    ```

    Compare the byte sizes in Folder A vs Folder B to see 50-80% reduction in action.

!!! note "Template Storage"
    For Splunk to expand compact events, configure template output to store templates in Splunk. See the [10x for Splunk](https://doc.log10x.com/apps/regulator/splunk/) documentation.
