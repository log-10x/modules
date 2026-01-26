---
icon: material/pipe-leak
---

Read events from OpenTelemetry Collector to transform into typed [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) for aggregation and reporting. This module is a component of the [Edge Reporter](https://doc.log10x.com/apps/edge/reporter/) app.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 OTel Receivers</div><div style='font-size: 10px;'>filelog, otlp</div>"] --> B["<div style='font-size: 14px;'>📤 syslog</div><div style='font-size: 10px;'>exporter</div>"]
    B --> C["<div style='font-size: 14px;'>🔌 Unix Socket</div><div style='font-size: 10px;'>RFC5424</div>"]
    C --> D["<div style='font-size: 14px;'>⚡ 10x Reporter</div><div style='font-size: 10px;'>metrics only</div>"]
    A --> E["<div style='font-size: 14px;'>📤 Final Exporters</div><div style='font-size: 10px;'>ES, Splunk, S3</div>"]

    classDef receiver fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef exporter fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef socket fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef output fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A receiver
    class B exporter
    class C socket
    class D engine
    class E output
```

</div>

### Data Flow

- 📂 **OTel Receivers** - Collect logs from files, OTLP, or other sources
- 📤 **Syslog Exporter** - Sends logs to Log10x via Unix socket (RFC5424 format)
- ⚡ **10x Reporter** - Transforms events, aggregates metrics, publishes to time-series DBs
- 📤 **Final Exporters** - Logs flow in parallel to final destinations (unmodified)

### Key Characteristics

| Feature | Description |
|---------|-------------|
| 📊 **Read-Only** | Reporter only collects metrics - does not modify event flow |
| 🔀 **Parallel Flow** | Logs go to BOTH Log10x AND final exporters simultaneously |
| 📈 **Metrics Output** | Publishes aggregated metrics to Prometheus, Datadog, etc. |
| 🚫 **No Return Path** | No `fluentforward` receiver needed for reporter mode |

### :material-swap-horizontal-circle-outline: Unix Socket Input

This [module](https://doc.log10x.com/engine/module/) configures a Unix socket input that receives RFC5424 syslog events from OpenTelemetry Collector's `syslogexporter` to aggregate and publish to [time-series](https://doc.log10x.com/run/output/metric/) outputs.

### :material-download-outline: Install

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Reporter OTel Collector [run instructions](https://doc.log10x.com/apps/edge/reporter/run/#otel-collector)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Edge Reporter OTel Collector [deployment instructions](https://doc.log10x.com/apps/edge/reporter/deploy/#otel-collector)

