---
icon: material/import
hidden: true
---

Reads events from the OpenTelemetry Collector over [OTLP/gRPC](https://opentelemetry.io/docs/specs/otlp/) on TCP — every OS.

Each log record inside an incoming `ExportLogsServiceRequest` is emitted as a single JSON line carrying:

- The OTLP **`body`** — flattened to a top-level string field for plain-text bodies (OTLP `AnyValue.stringValue`), or kept in its `AnyValue` shape (e.g. `{"kvlistValue":…}`) for non-string bodies. Flattening the common case lets the engine's outer-text accessor preserve the surrounding envelope intact in optimize mode, so `encode()` only swaps the body value and leaves every other attribute untouched.
- All **log-record attributes** flat at the top level, with keys preserved as they came in (`log.file.name`, `log.iostream`, …).
- All **resource attributes** flat at the top level, also with keys preserved (`service.name`, `k8s.pod.name`, `k8s.namespace.name`, `k8s.container.name`, …).
- A synthetic **`tag`** field — set to `service.name` if present, otherwise `k8s.pod.name`, otherwise the literal `otel` — used as the wire tag on the outgoing OTLP output back to the Collector and as the event's source inside Log10x.

The input pulls out two things via the engine's JSON extractor:

- The actual log line — captured by `captureFirst` from the path configured via `otelCollectorMessageField` (default `body`, matching the flattened shape above). Becomes the event's `text`, the input to every message-content enrichment downstream.
- The synthetic **`tag`** — captured by `sourcePattern` as the event's `source`. Used for rate-based grouping and as the outgoing OTLP tag when events are sent back to the Collector.

Every other field — every attribute that came in over OTLP — stays on the event's `fullText` and round-trips back to the Collector as a log-record attribute on the returning side.

The matching Collector exporter config:

```yaml
exporters:
  otlp/tenx:
    endpoint: 127.0.0.1:4317
    tls:
      insecure: true
```
