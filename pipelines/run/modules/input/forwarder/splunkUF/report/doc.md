---
icon: material/pipe-leak
---

Read events from application logs to transform into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to aggregate and report on, before Splunk UF ships them to indexers. This module is a component of the [Edge Reporter](https://doc.log10x.com/apps/edge/reporter/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📝 App Logs</div><div style='font-size: 10px;'>Folder A</div>"] --> B["<div style='font-size: 14px;'>🔧 Fluent Bit</div><div style='font-size: 10px;'>tail input</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Reporter</div><div style='font-size: 10px;'>sidecar</div>"]
    C --> D["<div style='font-size: 14px;'>📊 Metrics</div><div style='font-size: 10px;'>Prometheus</div>"]
    B --> E["<div style='font-size: 14px;'>📂 Processed</div><div style='font-size: 10px;'>Folder B</div>"]
    E --> F["<div style='font-size: 14px;'>📤 Splunk UF</div><div style='font-size: 10px;'>monitors B</div>"]
    F --> G["<div style='font-size: 14px;'>🔍 Splunk</div><div style='font-size: 10px;'>Indexers</div>"]

    classDef logs fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef fluentbit fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef metrics fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef processed fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef uf fill:#64748b,stroke:#475569,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef splunk fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A logs
    class B fluentbit
    class C engine
    class D metrics
    class E processed
    class F uf
    class G splunk
```

</div>

### Data Flow

- 📝 **App Logs (Folder A)** - Application writes logs to original location
- 🔧 **Fluent Bit** - Reads from Folder A, passes events to 10x sidecar
- ⚡ **10x Reporter** - Transforms events into TenXObjects, aggregates metrics
- 📊 **Metrics Output** - Publishes time-series data to Prometheus/metrics backends
- 📂 **Processed (Folder B)** - Events written unchanged to new location
- 📤 **Splunk UF** - Monitors Folder B, handles forwarding to Splunk
- 🔍 **Splunk Indexers** - Receives original events (unchanged)

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📊 **Read-Only** | Reporter observes events without modifying them |
| 🔗 **Parallel Flow** | Events flow to both metrics AND Splunk |
| 📈 **Metrics Publishing** | Aggregates and publishes to time-series backends |
| 📤 **UF Handles Delivery** | Splunk UF manages buffering, retries, timeouts |

### :material-swap-horizontal-circle-outline: File Relay Pattern

This [module](https://doc.log10x.com/engine/module/) configures a file relay where Fluent Bit reads application logs, passes them through a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) for reporting, then writes them to a folder that Splunk UF monitors. Events are unchanged - 10x only observes and reports metrics.

### :material-download-outline: Install

=== ":material-laptop: Nix/OSX"

    See the [Quickstart](#quickstart) below or the Log10x Edge Reporter [run instructions](https://doc.log10x.com/apps/edge/reporter/run/#splunk-uf)

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

    # Include 10x reporter
    @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-report.conf

    # Write to Folder B for Splunk UF
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
