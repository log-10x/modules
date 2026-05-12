---
icon: simple/opentelemetry
hidden: true
---

Sends processed events back to the OpenTelemetry Collector over the [Fluent Forward protocol](https://docs.fluentd.org/output/forward) — the Collector consumes this on the receiving side via its [`fluent_forward` receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/fluentforwardreceiver) (TCP on every OS, or a Unix domain socket on Linux/macOS).

Each top-level field of the rendered event becomes a Fluent field on the wire — `fluent_forward` then maps every Fluent field onto an attribute on the returning OTel log record. Resource attributes, scope info, log-record attributes, and the body all round-trip back as distinct attributes (the resource-vs-log-attribute distinction is collapsed; everything comes back as log-record attributes). The Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether the symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:24225` so it pairs with the [input](../input/) listening on `:4317`. Override the destination with `otelCollectorOutputHost` / `otelCollectorOutputPort`, or `otelCollectorOutputPath` for a Unix domain socket on Linux/macOS.

The matching Collector receiver config:

```yaml
receivers:
  fluent_forward/tenx:
    endpoint: 0.0.0.0:24225        # or /tmp/tenx-otel-out.sock on Linux/macOS
```
