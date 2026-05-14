---
icon: simple/opentelemetry
---

Runs 10x Engine as a [sidecar](https://doc.log10x.com/engine/launcher/sidecar) to the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) for reporting, receiving, and optimizing events before they ship to their destination (Elasticsearch, Splunk, S3, Kafka, …). The Collector and Log10x run as peer processes — the Collector sends events to Log10x via its native [OTLP/gRPC exporter](https://github.com/open-telemetry/opentelemetry-collector/tree/main/exporter/otlpexporter) and receives processed events back via its OTLP/gRPC receiver. The OTLP wire preserves resource attributes, scope info, log-record attributes, severity, timestamp, and body end-to-end, so k8s metadata (`k8s.pod.name`, `k8s.namespace.name`, `k8s.container.name`, labels, …) round-trips back to your destinations.

!!! note "Distribution"
    Both the OTLP receiver and OTLP exporter ship in the core `otelcol` distribution — no `otelcol-contrib` build is required. Tested against `otelcol` v0.151.0+.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Receivers</div><div style='font-size: 10px;'>filelog, otlp, journald</div>"] --> F["<div style='font-size: 14px;'>🧪 logs/to-tenx</div><div style='font-size: 10px;'>k8sattributes, resource, transform</div>"]
    F --> B["<div style='font-size: 14px;'>📤 otlp exporter</div><div style='font-size: 10px;'>OTLP/gRPC → :4317</div>"]
    B --> E["<div style='font-size: 14px;'>⚡ 10x Engine</div><div style='font-size: 10px;'>Receive/Optimize</div>"]
    E --> C["<div style='font-size: 14px;'>📥 otlp receiver</div><div style='font-size: 10px;'>:24225 (no processors)</div>"]
    C --> D["<div style='font-size: 14px;'>📤 Destinations</div><div style='font-size: 10px;'>ES, Splunk, S3, Kafka</div>"]

    classDef input fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef filter fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef output fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A input
    class B filter
    class C filter
    class D output
    class E engine
    class F filter
```

</div>

### Data Flow

- 📂 **Receivers** — Your existing OTel receivers (`filelog`, `otlp`, `journald`, `kafka`, …) feed events into the `logs/to-tenx` pipeline.
- 🧪 **`logs/to-tenx`** — Your enrichment processors (`k8sattributes`, `resource`, `attributes`, `transform`, `filter`, …) run here exactly once before the event is handed off to Log10x. The processors live on this pipeline only; the return-path pipeline never sees them.
- 📤 **OTLP exporter** → Log10x — The Collector forwards the enriched event to the Log10x sidecar over OTLP/gRPC on TCP `:4317`. Resource attributes, scope info, log-record attributes, and the body all travel on the wire.
- ⚡ **10x Engine** — The Receiver app applies rate/policy-based filtering and optionally compacts events for volume reduction.
- 📥 **`logs/from-tenx`** — Processed events come back to the Collector on `:24225` via its OTLP/gRPC receiver. Keep this pipeline processor-free; the destination exporters consume events directly so enrichment never re-fires on the return path.
- 📤 **Destinations** — Your OTel destination exporters (`elasticsearch`, `splunkhec`, `kafka`, `awss3`, …) consume the return pipeline and ship to the real destinations.

### What an event looks like on the way back

Every attribute that came in over OTLP — resource attributes, scope info, log-record attributes, body — round-trips back to the Collector. The `LogRecord.body` carries the message verbatim in its original `AnyValue` shape (so a `body.stringValue` is byte-for-byte unchanged); the resource-vs-log-attribute distinction is collapsed (everything comes back as a log-record attribute), but no data is lost. What changes between in and out depends on the Receiver app mode:

| Mode | Difference vs the event the Collector sent in |
|------|------------------------------------------------|
| Receive (default) | None. Same record. |
| Receive + `symbolMessageHashField <name>` | Same record + one new field named `<name>` carrying the symbol-pattern hash (a stable identifier for the message pattern — usable as a dedup key, metric dimension, or correlation ID). |
| `receiverOptimize true` | The value of the field captured by `otelCollectorMessageField` (default `body`) is replaced with a compact encoded form. A separate `tenx-template` event is emitted with the template needed to decode it. All other fields stay verbatim. |
| `receiverOptimize true` + `symbolMessageHashField <name>` | Both of the above. |

Log10x reads the log line text via the JSON field configured by `otelCollectorMessageField` (default `body`); the `tag` field stamped by the input (from `service.name`, falling back to `k8s.pod.name`, then to the literal `"otel"`) becomes the event's source. All other resource and log-record attributes (`k8s.pod.name`, `k8s.namespace.name`, `service.name`, …) come through as flat top-level fields on the record, available for message-pattern and rate filtering.

??? tenx-keyfiles "Key Files"

    | File | Purpose |
    |------|---------|
    | [`stream.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/stream.yaml) | OTel Collector OTLP/gRPC input + output stream definitions |
    | [`conf/tenx-sidecar.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/conf/tenx-sidecar.yaml) | Reference Collector config showing the two-pipeline split with no return-path processors |

## Quickstart

**1. Run Log10x:**

```bash
tenx @run/input/forwarder/otel-collector @apps/receiver
```

**2. Wire up your Collector config** — start from the sidecar recipe and add your real receivers + destination exporters. The `logs/to-tenx` pipeline carries everything from sources through enrichment to the `otlp/tenx` exporter; the `logs/from-tenx` pipeline carries the returning events directly to your destination exporters:

```yaml title="otelcol.yaml"
receivers:
  filelog:
    include: [/var/log/app.log]

  # Receive processed events back from Log10x over OTLP/gRPC
  otlp/tenx:
    protocols:
      grpc:
        endpoint: 0.0.0.0:24225

processors:
  batch: {}

exporters:
  # Hand off to the Log10x sidecar over OTLP/gRPC
  otlp/tenx:
    endpoint: 127.0.0.1:4317
    tls:
      insecure: true

  debug:
    verbosity: detailed

service:
  pipelines:
    logs/to-tenx:
      receivers: [filelog]
      processors: [batch]
      exporters: [otlp/tenx]
    logs/from-tenx:
      receivers: [otlp/tenx]
      exporters: [debug]
```

For Splunk integration see the [10x for Splunk](https://doc.log10x.com/apps/receiver/splunk/) documentation. For Kubernetes deployment via the official OpenTelemetry Collector Helm chart see the [Helm sidecar overlay](https://doc.log10x.com/apps/receiver/deploy/#otel-collector).
