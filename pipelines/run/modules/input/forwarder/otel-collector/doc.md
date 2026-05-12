---
icon: simple/opentelemetry
---

Runs 10x Engine as a [sidecar](https://doc.log10x.com/engine/launcher/sidecar) to the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) for reporting, receiving, and optimizing events before they ship to their destination (Elasticsearch, Splunk, S3, Kafka, …). The Collector and Log10x run as peer processes — the Collector sends events to Log10x via its native [`syslog` exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/syslogexporter) (RFC5424 over TCP or Unix socket) and receives processed events back via its [`fluent_forward` receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/fluentforwardreceiver) (Fluent Forward protocol). Works against the official [`otelcol-contrib`](https://github.com/open-telemetry/opentelemetry-collector-releases) distribution and the [`opentelemetry-collector` Helm chart](https://github.com/open-telemetry/opentelemetry-helm-charts) with a values overlay.

!!! note "Distribution requirement"
    The `syslog` exporter and `fluent_forward` receiver ship in **`otelcol-contrib`** only — the core `otelcol` distribution does not include them. Tested against `otelcol-contrib` v0.151.0+.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Receivers</div><div style='font-size: 10px;'>filelog, otlp, journald</div>"] --> F["<div style='font-size: 14px;'>🧪 logs/to-tenx</div><div style='font-size: 10px;'>enrichment processors</div>"]
    F --> B["<div style='font-size: 14px;'>📤 syslog exporter</div><div style='font-size: 10px;'>rfc5424 → :24226</div>"]
    B --> E["<div style='font-size: 14px;'>⚡ 10x Engine</div><div style='font-size: 10px;'>Receive/Optimize</div>"]
    E --> C["<div style='font-size: 14px;'>📥 fluent_forward receiver</div><div style='font-size: 10px;'>:24227 (no processors)</div>"]
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
- 🧪 **`logs/to-tenx`** — Your enrichment processors (`transform`, `attributes`, `resource`, `filter`, …) run here exactly once before the event is handed off to Log10x. The processors live on this pipeline only; the return-path pipeline never sees them.
- 📤 **syslog exporter** → Log10x — The Collector forwards the enriched event to the Log10x sidecar as an RFC5424 syslog message over TCP `:24226` (or a Unix socket on Linux/macOS). The exporter's MSG field carries the log line; OTel attributes set as part of enrichment are not preserved across this wire — see the contract table below.
- ⚡ **10x Engine** — The Receiver app applies rate/policy-based filtering and optionally compacts events for volume reduction.
- 📥 **`logs/from-tenx`** — Processed events come back to the Collector on `:24227` via the `fluent_forward` receiver. This pipeline holds only the destination exporters; no processors sit between them, so enrichment never re-fires. OTel's separate-pipeline model IS the bypass mechanism — no label or scope wiring needed.
- 📤 **Destinations** — Your OTel destination exporters (`elasticsearch`, `splunkhec`, `kafka`, `awss3`, …) consume the return pipeline and ship to the real destinations.

### What an event looks like on the way back

The syslog wire format carries a single MSG field — so the round trip preserves the **message text** that the Collector's syslog exporter wrote into MSG (typically driven by the `message` attribute on the log record). Additional OTel attributes set by `logs/to-tenx` processors do not cross the syslog wire and therefore do not return; place any attributes that destinations need to see on the `logs/from-tenx` side instead. What changes between in and out depends on the Receiver app mode:

| Mode | Difference vs the MSG the Collector sent in |
|------|----------------------------------------------|
| Receive (default) | None. Same MSG text on the way out. |
| Receive + `symbolMessageHashField <name>` | Same MSG text + one new Fluent field named `<name>` carrying the symbol-pattern hash (a stable identifier for the message pattern — usable as a dedup key, metric dimension, or correlation ID). The `fluent_forward` receiver maps Fluent fields onto OTel log attributes, so the hash surfaces as `attributes["<name>"]` on the returning record. |
| `receiverOptimize true` | The MSG is replaced with a compact encoded form. A separate `tenx-template` event is emitted with the template needed to decode it. |
| `receiverOptimize true` + `symbolMessageHashField <name>` | Both of the above. |

Internally, Log10x's OpenTelemetry Collector input strips the RFC5424 envelope and treats the MSG as the event's `text` — the input to all message-content enrichments. When the Receiver app is configured with `k8sExtractorName: fluentK8s`, an attempt is made to materialize `kubernetes.*` fields from the MSG if it happens to be a JSON record; for plain-text MSGs the k8s extractor is a no-op.

??? tenx-keyfiles "Key Files"

    | File | Purpose |
    |------|---------|
    | [`input/stream.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/input/stream.yaml) | OTel Collector syslog input — strips RFC5424 envelope and captures the MSG text |
    | [`output/stream.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/output/stream.yaml) | OTel Collector Fluent Forward output — sends processed events back to the Collector's `fluent_forward` receiver |
    | [`conf/tenx-sidecar.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/conf/tenx-sidecar.yaml) | Reference Collector config showing the two-pipeline split with no return-path processors |

## Quickstart

**1. Run Log10x:**

```bash
tenx @run/input/forwarder/otel-collector @apps/receiver
```

**2. Wire up your Collector config** — start from the sidecar recipe and add your real receivers + destination exporters. The `logs/to-tenx` pipeline carries everything from sources through enrichment to the `syslog/tenx` exporter; the `logs/from-tenx` pipeline carries the returning events directly to your destination exporters:

```yaml title="otelcol.yaml"
receivers:
  app_logs:
    filelog:
      include: [/var/log/app.log]

  # Receive processed events back from Log10x
  fluent_forward/tenx:
    endpoint: 0.0.0.0:24227

processors:
  # Enrichment runs here exactly once — the return pipeline skips this block.
  transform/tenx_message:
    log_statements:
      - context: log
        statements:
          # The syslog exporter uses the `message` attribute for the MSG field.
          - set(attributes["message"], body) where attributes["message"] == nil

exporters:
  # Hand off to the Log10x sidecar
  syslog/tenx:
    endpoint: 127.0.0.1
    port: 24226
    network: tcp
    protocol: rfc5424
    tls:
      insecure: true

  # Destinations consume the fluent_forward receiver — not the raw receivers
  # — so enrichment never re-fires on the return path.
  debug:
    verbosity: detailed

service:
  pipelines:
    logs/to-tenx:
      receivers: [filelog]
      processors: [transform/tenx_message]
      exporters: [syslog/tenx]
    logs/from-tenx:
      receivers: [fluent_forward/tenx]
      exporters: [debug]
```

For Splunk integration see the [10x for Splunk](https://doc.log10x.com/apps/receiver/splunk/) documentation. For Kubernetes deployment via the official OpenTelemetry Collector Helm chart see the [Helm sidecar overlay](https://doc.log10x.com/apps/receiver/deploy/#otel-collector).
