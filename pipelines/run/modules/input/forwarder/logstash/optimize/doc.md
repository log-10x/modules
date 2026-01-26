---
icon: material/pipe-wrench
---

[Losslessly compact](https://doc.log10x.com/run/transform/#compact) log/trace events collected by Logstash forwarders ***before*** they ship to output (e.g., ElasticSearch, S3). This module is a component of the [Edge Optimizer](https://doc.log10x.com/apps/edge/optimizer/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Logstash</div><div style='font-size: 10px;'>inputs</div>"] --> B["<div style='font-size: 14px;'>🔧 Pipe Output</div><div style='font-size: 10px;'>plugin</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Optimizer</div><div style='font-size: 10px;'>encode()</div>"]
    C --> D["<div style='font-size: 14px;'>🔌 Unix/TCP</div><div style='font-size: 10px;'>input</div>"]
    D --> E["<div style='font-size: 14px;'>📤 Logstash</div><div style='font-size: 10px;'>outputs</div>"]

    classDef input fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef filter fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef socket fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef output fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A input
    class B filter
    class C engine
    class D socket
    class E output
```

</div>

### Data Flow

- 📂 **Logstash Inputs** - Collect logs from files, beats, TCP, or other sources
- 🔧 **Pipe Output Plugin** - Pipes events to 10x sidecar via stdin
- ⚡ **10x Optimizer** - Losslessly [compacts](https://doc.log10x.com/run/transform/#compact) events to reduce log volume 50-80%
- 🔌 **Unix/TCP Input** - Receives COMPACT events back from the sidecar
- 📤 **Logstash Outputs** - Compact events ship to final destinations at reduced size

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📦 **Lossless Compact** | Compacts events to reduce log volume 50-80% |
| 🔗 **Template Extraction** | Repetitive structures become reusable templates |
| 💰 **Cost Savings** | Reduced storage and transfer costs |
| 🔧 **Pipe Output** | Uses Logstash's pipe output plugin for stdin piping |

### :material-swap-horizontal-circle-outline: Sidecar Relay

This [module](https://doc.log10x.com/engine/module/) configures a Logstash [pipe output](https://www.elastic.co/guide/en/logstash/current/plugins-outputs-pipe.html) plugin and Unix/TCP input plugin. The Logstash output plugin launches a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) and pipes events to it to encode. The sidecar relays compact events back to Logstash Unix/TCP input plugin to ship to output (e.g., ElasticSearch).

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Optimizer Logstash [run instructions](https://doc.log10x.com/apps/edge/optimizer/run/#logstash)

=== ":material-kubernetes: k8s"

    Currently not supported
