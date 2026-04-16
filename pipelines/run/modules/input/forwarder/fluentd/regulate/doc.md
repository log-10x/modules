---
icon: material/pipe-valve
---

Read events from a Fluentd forwarder to transform them into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to filter using local/centralized [regulator](https://doc.log10x.com/run/output/regulate) policy. This module is a component of the [Regulator](https://doc.log10x.com/apps/regulator/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Fluentd</div><div style='font-size: 10px;'>sources</div>"] --> B["<div style='font-size: 14px;'>🔧 exec_filter</div><div style='font-size: 10px;'>plugin</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Regulator</div><div style='font-size: 10px;'>filter policy</div>"]
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
- 🔧 **exec_filter Plugin** - Pipes ALL events to 10x sidecar via stdin
- ⚡ **10x Regulator** - Applies rate/policy-based filtering, drops noisy events
- 🔄 **Bidirectional Pipe** - FILTERED events return via stdout to exec_filter
- 📤 **Fluentd Outputs** - Only filtered events ship to final destinations

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 🚦 **Rate Limiting** | Filter events based on per-template rate limits |
| 📋 **Policy-Based** | Apply local or centralized filtering policies |
| 💰 **Cost Control** | Reduce log volume and costs by dropping noisy events |
| 🔧 **exec_filter** | Uses Fluentd's native exec_filter for stdin/stdout piping |

### :material-swap-horizontal-circle-outline: Sidecar Relay

This [module](https://doc.log10x.com/engine/module/) configures a Fluentd [exec-filter](https://docs.fluentd.org/output/exec_filter) that launches a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) and passes it collected events to regulate using a local/centralized policy. The sidecar relays regulated events back to the Fluentd filter to ship to outputs (e.g., Splunk, S3).

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Regulator Fluentd [run instructions](https://doc.log10x.com/apps/regulator/run/#fluentd)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Regulator Fluentd [deployment instructions](https://doc.log10x.com/apps/regulator/deploy/#fluentd)
