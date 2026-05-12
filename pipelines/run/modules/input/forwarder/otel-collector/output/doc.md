---
icon: simple/opentelemetry
hidden: true
---

Sends processed events back to the OpenTelemetry Collector over the [Fluent Forward protocol](https://docs.fluentd.org/output/forward) — the Collector consumes this on the receiving side via its [`fluent_forward` receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/fluentforwardreceiver) (TCP on every OS, or a Unix domain socket on Linux/macOS).

Each top-level field of the rendered event becomes a Fluent field on the wire. The `fluent_forward` receiver maps those onto attributes on the returning OTel log record — so the symbol-pattern hash (when `symbolMessageHashField` is set) surfaces as a distinct attribute rather than being stringified into the message. The Receiver app's mode determines whether the main event field stays verbatim (the original MSG text) or is replaced with a compacted encoded form, and whether the hash attribute is added.

Defaults to TCP `127.0.0.1:24227` so it pairs with the [input](../input/) listening on `:24226`. Override the destination with `otelCollectorOutputHost` / `otelCollectorOutputPort`, or `otelCollectorOutputPath` for a Unix domain socket on Linux/macOS.

The matching Collector receiver config:

```yaml
receivers:
  fluent_forward/tenx:
    endpoint: 0.0.0.0:24227        # or /tmp/tenx-otel-out.sock on Linux/macOS
```
