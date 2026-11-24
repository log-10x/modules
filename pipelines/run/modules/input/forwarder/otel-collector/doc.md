---
icon: simple/opentelemetry
---

Runs 10x Engine as a [sidecar](https://doc.log10x.com/engine/launcher/sidecar) to the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) for reporting, receiving, and optimizing events before they ship to their destination (Elasticsearch, Splunk, S3, Kafka, …). The Collector and Log10x run as peer processes. On Kubernetes, the Helm chart connects the two containers over unix domain sockets on a shared `/tmp` emptyDir: the Collector sends events to Log10x via syslog on `/tmp/tenx-otel-in.sock` and receives processed events back via fluentforward on `/tmp/tenx-otel-out.sock`. The Architecture and Quickstart below show the VM/CLI recipe instead, where the Collector sends events via its native [OTLP/gRPC exporter](https://github.com/open-telemetry/opentelemetry-collector/tree/main/exporter/otlpexporter) and receives them back via its OTLP/gRPC receiver. Resource attributes, log-record attributes, timestamps and body survive the round trip, so k8s metadata (`k8s.pod.name`, `k8s.namespace.name`, `k8s.container.name`, labels, …) reaches your destinations with its name and value unchanged. Each attribute also keeps its place: a resource attribute returns under `Resource` and a log-record attribute on the log record. See [What an event looks like on the way back](#what-an-event-looks-like-on-the-way-back).

!!! note "Distribution"

    Both the OTLP receiver and OTLP exporter ship in the core `otelcol` distribution, no `otelcol-contrib` build is required. Tested against `otelcol` v0.151.0+.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📂 Receivers</div><div style='font-size: 10px;'>filelog, otlp, journald</div>"] --> F["<div style='font-size: 14px;'>🧪 logs/to-tenx</div><div style='font-size: 10px;'>k8sattributes, resource, transform</div>"]
    F --> B["<div style='font-size: 14px;'>📤 otlp exporter</div><div style='font-size: 10px;'>OTLP/gRPC → :4317</div>"]
    B --> E["<div style='font-size: 14px;'>⚡ 10x Engine</div><div style='font-size: 10px;'>Receive/Optimize</div>"]
    E --> C["<div style='font-size: 14px;'>📥 otlp receiver</div><div style='font-size: 10px;'>:24225 (no enrichment)</div>"]
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

- 📂 **Receivers**, Your existing OTel receivers (`filelog`, `otlp`, `journald`, `kafka`, …) feed events into the `logs/to-tenx` pipeline.
- 🧪 **`logs/to-tenx`**, Your enrichment processors (`k8sattributes`, `resource`, `attributes`, `transform`, `filter`, …) run here exactly once before the event is handed off to Log10x. The processors live on this pipeline only; the return-path pipeline never sees them.
- 📤 **OTLP exporter** → Log10x, The Collector forwards the enriched event to the Log10x sidecar over OTLP/gRPC on TCP `:4317`. Resource attributes, scope info, log-record attributes, and the body all travel on the wire.
- ⚡ **10x Engine**, The Receiver app applies rate/policy-based filtering and optionally compacts events for volume reduction.
- 📥 **`logs/from-tenx`**, Processed events come back to the Collector on `:24225` via its OTLP/gRPC receiver. Keep enrichment processors off this pipeline so enrichment never re-fires on the return path; a Splunk destination takes one processor of its own (see [Sending to Splunk](#sending-to-splunk)).
- 📤 **Destinations**, Your OTel destination exporters (`elasticsearch`, `splunkhec`, `kafka`, `awss3`, …) consume the return pipeline and ship to the real destinations.

### What an event looks like on the way back

**Attributes, timestamps and body come back.** Resource attributes, log-record
attributes, timestamps and body return to the Collector, each with the same key
and the same value. The `LogRecord.body` carries the message verbatim in its
original `AnyValue` shape, so a `body.stringValue` is byte-for-byte unchanged.
Severity and the instrumentation scope do not come back: a returning record has
no severity and an empty scope.

**The resource-versus-log-record split comes back too.** Log10x reads the
incoming record as one flat set of top-level fields and notes which of them
arrived under `Resource`. The
[OTLP output](https://doc.log10x.com/run/output/event/otlp/) writes those back
under `Resource`, lifts the configured body field into `LogRecord.body`, and
writes every other top-level field as a log-record attribute. In each export,
records that share the same resource attributes go out under one `ResourceLogs`
entry.

A processor or exporter on the return path finds each attribute where it was
set. A destination exporter that maps resource attributes to its own fields
applies them as it would on the original record: the Splunk HEC exporter, for
example, takes a `com.splunk.sourcetype` resource attribute as the event's
sourcetype, over its own `sourcetype` setting.

What else changes between in and out depends on the Receiver app mode:

| Mode | Difference vs the event the Collector sent in |
|------|------------------------------------------------|
| Receive (default) | No attribute added, none removed, no value changed. Every attribute returns where it arrived, as described above. |
| Receive + `symbolMessageHashField <name>` | As above, plus one new field named `<name>` carrying the symbol-pattern hash (a stable identifier for the message pattern, usable as a dedup key, metric dimension, or correlation ID). |
| `receiverOptimize true` | The value of the field captured by `otelCollectorInputMessageField` (default `body`) is replaced with a compact encoded form. Each new template is sent once as its own LogRecord, with no body and the attributes `templateHash`, `template` and `tenx_tag` = `tenx-template`; route on `tenx_tag` to send templates to their own destination. All other fields stay verbatim. |
| `receiverOptimize true` + `symbolMessageHashField <name>` | Both of the above. |

`symbolMessageHashField` is unset by default, which is what makes the first row true: the receive path adds nothing of its own to the record. The pattern hash is still computed and still rides the event inside the engine as `tenx_hash` for metrics and aggregation, it just does not reach the wire. Naming a field opts in, either as a launch argument (`tenx @run/input/forwarder/otel-collector @apps/receiver symbolMessageHashField my_custom_hash`) or as an environment variable of the same name.

Log10x reads the log line text via the JSON field configured by `otelCollectorInputMessageField` (default `body`); the `tag` field stamped by the input (from `service.name`, falling back to `k8s.pod.name`, then to the literal `"otel"`) becomes the event's source. All other resource and log-record attributes (`k8s.pod.name`, `k8s.namespace.name`, `service.name`, …) come through as flat top-level fields on the record, available for message-pattern and rate filtering.

??? tenx-keyfiles "Key Files"

    | File | Purpose |
    |------|---------|
    | [`stream.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/stream.yaml) | OTel Collector OTLP/gRPC input + output stream definitions |
    | [`conf/tenx-sidecar.yaml`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/conf/tenx-sidecar.yaml) | Reference Collector config showing the two-pipeline split with no return-path processors |

## Quickstart

**1. Run Log10x:**

```bash
tenx @run/input/forwarder/otel-collector @apps/receiver groupJoinLines false
```

**2. Wire up your Collector config**, start from the sidecar recipe and add your real receivers + destination exporters. The `logs/to-tenx` pipeline carries everything from sources through enrichment to the `otlp/tenx` exporter; the `logs/from-tenx` pipeline carries the returning events directly to your destination exporters:

```yaml title="otelcol.yaml"
receivers:
  filelog:
    include: [/var/log/app.log]
    # An event starts at a line that starts with a date; every other line
    # joins the event before it.
    multiline:
      line_start_pattern: '^\d{4}-\d{2}-\d{2}'

  # Receive processed events back from Log10x over OTLP/gRPC
  otlp/tenx:
    protocols:
      grpc:
        endpoint: 0.0.0.0:24225

exporters:
  # Hand off to the Log10x sidecar over OTLP/gRPC
  otlp/tenx:
    endpoint: 127.0.0.1:4317
    tls:
      insecure: true
    # Log10x answers a request once its records are written back, which can
    # take several seconds; a shorter timeout sends the request again.
    timeout: 30s
    # A refused or failed request is sent again, without a deadline.
    retry_on_failure:
      enabled: true
      max_elapsed_time: 0
    sending_queue:
      enabled: true
      # One sender keeps records in the order they were read; the engine
      # groups multi-line events from consecutive records.
      num_consumers: 1
      # A full queue holds the receivers back instead of dropping records.
      block_on_overflow: true
      # Requests of at most 2 MiB, well under the largest Log10x takes
      # (otelCollectorInputMaxMessageSize); a backlog read at once is split.
      batch:
        flush_timeout: 1s
        sizer: bytes
        min_size: 1048576
        max_size: 2097152

  debug:
    verbosity: detailed

service:
  pipelines:
    logs/to-tenx:
      receivers: [filelog]
      exporters: [otlp/tenx]
    logs/from-tenx:
      receivers: [otlp/tenx]
      exporters: [debug]
```

### Sending to Splunk

The [Log10x App](https://doc.log10x.com/apps/receiver/compact/splunk/) expands compact events in Splunk. Two settings prepare the events for it:

- Each template record reaches the app's `tenx_dml` index as the sourcetype `tenx_dml_raw_json`, with the template as its event. One `transform` processor on `logs/from-tenx` does this, and the Splunk HEC exporter sends the compact events as `tenx_encoded`.
- Each compact event keeps the time the Collector gave it. The app's event-time rule, which reads an event's time from a timestamp in its own text, is turned off for the events of the Collector's HEC token, in a `local/props.conf` of the app on the indexers. Their source is `http:<token name>` unless the exporter sets one; the lines below are for a token named `otel-collector`.

```yaml title="otelcol.yaml"
processors:
  transform/splunk:
    error_mode: ignore
    log_statements:
      - context: log
        statements:
          - 'set(body, {"templateHash": attributes["templateHash"], "template": attributes["template"]}) where attributes["tenx_tag"] == "tenx-template"'
          - 'set(attributes["com.splunk.index"], "tenx_dml") where attributes["tenx_tag"] == "tenx-template"'
          - 'set(attributes["com.splunk.sourcetype"], "tenx_dml_raw_json") where attributes["tenx_tag"] == "tenx-template"'
          - 'keep_keys(attributes, ["com.splunk.index", "com.splunk.sourcetype"]) where attributes["com.splunk.sourcetype"] == "tenx_dml_raw_json"'

exporters:
  splunk_hec:
    token: "${env:SPLUNK_HEC_TOKEN}"
    endpoint: "https://splunk.example.com:8088/services/collector"
    sourcetype: tenx_encoded
    index: app_logs

service:
  pipelines:
    logs/from-tenx:
      receivers: [otlp/tenx]
      processors: [transform/splunk]
      exporters: [splunk_hec]
```

```ini title="local/props.conf"
[source::http:otel-collector]
TRANSFORMS-tenx_time =
```

The `transform` processor and the `splunk_hec` exporter ship in `otelcol-contrib`. The HEC token must allow the `tenx_dml` index as well as the index of the compact events. The processor changes nothing on a compact event.

For Splunk integration see the [Log10x App](https://doc.log10x.com/apps/receiver/compact/splunk/) documentation. For Kubernetes deployment via the official OpenTelemetry Collector Helm chart see the [Helm sidecar overlay](https://doc.log10x.com/apps/receiver/deploy/#otel-collector).
