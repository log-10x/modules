---
icon: simple/opentelemetry
hidden: true
---

Sends processed events back to the OpenTelemetry Collector over [OTLP/gRPC](https://opentelemetry.io/docs/specs/otlp/) — the Collector consumes them on its `otlp` receiver and forwards to the destination exporters on the return pipeline.

Each rendered event is parsed back into a JSON envelope and emitted as an OTLP `LogRecord`: the `body` field is lifted into `LogRecord.body` (top-level string → `AnyValue.stringValue`; nested OTLP `AnyValue` shapes like `kvlistValue` are decoded back losslessly), and every other top-level field becomes a log-record attribute. The synthetic envelope `tag` is dropped on output so it does not surface on the destination side. Resource attributes, log-record attributes, and the body all round-trip back as distinct OTLP fields (the resource-vs-log-attribute distinction is collapsed; everything comes back as log-record attributes). The Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether the symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:24225` so it pairs with the [input](../input/) listening on `:4317`. Override the destination with `otelCollectorOutputHost` / `otelCollectorOutputPort`.

The matching Collector receiver config:

```yaml
receivers:
  otlp/tenx:
    protocols:
      grpc:
        endpoint: 0.0.0.0:24225
```
