---
icon: material/pipe-valve
---

Read events from a Fluent Bit forwarder to transform into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) and filter using local/centralized [reducer](https://doc.log10x.com/run/output/regulate) policies. This module is a component of the [Reducer](https://doc.log10x.com/apps/reducer/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Fluent Bit</div><div style='font-size: 10px;'>inputs</div>"] --> B["<div style='font-size: 14px;'>🔧 Lua Filter</div><div style='font-size: 10px;'>tenx.lua</div>"]
    B --> C["<div style='font-size: 14px;'>⚡ 10x Reducer</div><div style='font-size: 10px;'>filter policy</div>"]
    C --> D["<div style='font-size: 14px;'>🔌 Unix/TCP</div><div style='font-size: 10px;'>input</div>"]
    D --> E["<div style='font-size: 14px;'>📤 Fluent Bit</div><div style='font-size: 10px;'>outputs</div>"]

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

- 📂 **Fluent Bit Inputs** - Collect logs from files, containers, or other sources
- 🔧 **Lua Filter** - Intercepts ALL events and pipes them to 10x sidecar
- ⚡ **10x Reducer** - Applies rate/policy-based filtering, drops noisy events
- 🔌 **Unix/TCP Input** - Receives FILTERED events back from the sidecar
- 📤 **Fluent Bit Outputs** - Only filtered events ship to final destinations

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 🚦 **Rate Limiting** | Filter events based on per-template rate limits |
| 📋 **Policy-Based** | Apply local or centralized filtering policies |
| 💰 **Cost Control** | Reduce log volume and costs by dropping noisy events |
| 🔧 **Lua Filter** | Uses Fluent Bit's native Lua scripting for sidecar launch |

### :material-swap-horizontal-circle-outline: Sidecar Relay

This [module](https://doc.log10x.com/engine/module/) configures a Fluent Bit [Lua filter](https://docs.fluentbit.io/manual/pipeline/filters/lua) and Unix/TCP input. The Lua filter launches a 10x [sidecar process](https://doc.log10x.com/engine/launcher/sidecar) and passes it collected events to regulate. The sidecar relays regulated events back to Fluent Bit via the configured Unix/TCP input to ship to output(s) (e.g., Splunk, S3).

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Reducer Fluent Bit [run instructions](https://doc.log10x.com/apps/reducer/run/#fluent-bit)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/)

    See the Log10x Reducer Fluent Bit [deployment instructions](https://doc.log10x.com/apps/reducer/deploy/#fluent-bit)
