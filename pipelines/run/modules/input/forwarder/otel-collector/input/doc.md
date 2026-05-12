---
icon: simple/opentelemetry
hidden: true
---

Reads events from the OpenTelemetry Collector over [OTLP/gRPC](https://opentelemetry.io/docs/specs/otlp/) on TCP — every OS.

Each `ExportLogsServiceRequest` is unpacked and every log record inside is flattened into a single JSON record. The log body, log-record attributes, severity (`severity_text`, `severity_number`), `timestamp`, `trace_id` / `span_id` (when set), the resource attributes (`service_name`, `k8s_pod_name`, `k8s_namespace_name`, …), and the scope identity (`scope_name`, `scope_version`, plus any scope attributes prefixed with `scope_`) all become top-level fields on the resulting record. Dots in attribute keys are replaced with underscores so they read as flat fields rather than nested paths.

The input pulls out:

- The actual log line from the **`message`** field (configurable via `otelCollectorMessageField`) — becomes the event's `text`, the input to every message-content enrichment downstream.
- A synthetic **`tag`** field — set to `service.name` (or `k8s.pod.name` if `service.name` is unset, or the literal `otel` if neither is set) — becomes the event's `source`, used for rate-based grouping inside Log10x and as the outgoing Fluent Forward tag when events are sent back to the Collector.

Every other attribute that came in over OTLP is preserved on the event's `fullText`, so destinations that want the verbatim event still receive every attribute that came in.

The matching Collector exporter config:

```yaml
exporters:
  otlp/tenx:
    endpoint: 127.0.0.1:4317
    tls:
      insecure: true
```
