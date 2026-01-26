---
icon: material/pipe-leak
---

Read events from a Logstash forwarder to transform into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to aggregate and report on. This module is a component of the [Edge Reporter](https://doc.log10x.com/apps/edge/reporter/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Logstash</div><div style='font-size: 10px;'>inputs</div>"] --> B["<div style='font-size: 14px;'>🔧 Pipe Output</div><div style='font-size: 10px;'>plugin</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Reporter</div><div style='font-size: 10px;'>sidecar</div>"]
    C --> D["<div style='font-size: 14px;'>📊 Metrics</div><div style='font-size: 10px;'>Prometheus</div>"]
    A --> E["<div style='font-size: 14px;'>📤 Logstash</div><div style='font-size: 10px;'>outputs</div>"]

    classDef input fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef filter fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef metrics fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef output fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A input
    class B filter
    class C engine
    class D metrics
    class E output
```

</div>

### Data Flow

- 📂 **Logstash Inputs** - Collect logs from files, beats, TCP, or other sources
- 🔧 **Pipe Output Plugin** - Launches 10x sidecar and pipes events via stdin
- ⚡ **10x Reporter** - Transforms events into TenXObjects, aggregates metrics
- 📊 **Metrics Output** - Publishes time-series data to Prometheus/metrics backends
- 📤 **Logstash Outputs** - Original events continue unchanged to final destinations

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📊 **Read-Only** | Reporter observes events without modifying the pipeline |
| 🔗 **Parallel Flow** | Events flow to both 10x Reporter AND original outputs |
| 📈 **Metrics Publishing** | Aggregates and publishes to time-series backends |
| 🔧 **Pipe Output** | Uses Logstash's pipe output plugin for stdin piping |

### :material-swap-horizontal-circle-outline: Sidecar Relay

This [module](https://doc.log10x.com/engine/module/) configures a Logstash [pipe output](https://www.elastic.co/guide/en/logstash/current/plugins-outputs-pipe.html) plugin. The Logstash output plugin launches a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) and pipes events to aggregate and publish to [time-series](https://doc.log10x.com/run/output/metric/) outputs.

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Reporter Logstash [run instructions](https://doc.log10x.com/apps/edge/reporter/run/#logstash)

=== ":material-kubernetes: k8s"

    Currently not supported
