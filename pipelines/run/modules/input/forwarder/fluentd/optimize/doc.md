---
icon: material/pipe-wrench
---

[Losslessly compact](https://doc.log10x.com/run/transform/#compact) events collected by Fluentd forwarders ***before*** they ship to output (e.g., ElasticSearch, S3). This module is a component of the [Edge Optimizer](https://doc.log10x.com/apps/edge/optimizer/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Fluentd</div><div style='font-size: 10px;'>sources</div>"] --> B["<div style='font-size: 14px;'>🔧 exec_filter</div><div style='font-size: 10px;'>plugin</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Optimizer</div><div style='font-size: 10px;'>encode()</div>"]
    C --> B
    B --> D["<div style='font-size: 14px;'>📤 Fluentd</div><div style='font-size: 10px;'>outputs</div>"]

    classDef input fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef filter fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef output fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A input
    class B filter
    class C engine
    class D output
```

</div>

### Data Flow

- 📂 **Fluentd Sources** - Collect logs from files, TCP, HTTP, or other sources
- 🔧 **exec_filter Plugin** - Pipes events to 10x sidecar via stdin
- ⚡ **10x Optimizer** - Losslessly [compacts](https://doc.log10x.com/run/transform/#compact) events to reduce log volume 50-80%
- 🔄 **Bidirectional Pipe** - COMPACT events return via stdout to exec_filter
- 📤 **Fluentd Outputs** - Compact events ship to final destinations at reduced size

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📦 **Lossless Compact** | Compacts events to reduce log volume 50-80% |
| 🔗 **Template Extraction** | Repetitive structures become reusable templates |
| 💰 **Cost Savings** | Reduced storage and transfer costs |
| 🔧 **exec_filter** | Uses Fluentd's native exec_filter for stdin/stdout piping |

### :material-swap-horizontal-circle-outline: Sidecar Relay

This [module](https://doc.log10x.com/engine/module/) configures a Fluentd [exec-filter](https://docs.fluentd.org/output/exec_filter) that launches a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) and passes it collected events to encode. The sidecar relays compact events back to the Fluentd filter to ship to outputs (e.g., Splunk, S3).

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Optimizer Fluentd [run instructions](https://doc.log10x.com/apps/edge/optimizer/run/#fluentd)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Edge Optimizer Fluentd [deployment instructions](https://doc.log10x.com/apps/edge/optimizer/deploy/#fluentd)
