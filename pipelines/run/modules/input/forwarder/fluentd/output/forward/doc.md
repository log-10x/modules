---
icon: simple/fluentd
hidden: true
---

Defines a Fluent Forward output to write TenXObjects into a Fluentd forwarder process over TCP or a Unix domain socket. Wraps the generic [forward output](../../../../output/event/forward/) with Fluentd-conventional defaults (`127.0.0.1:24225`, `fullText` + `fluentdOutputFields` field encoding) so the sidecar launch config does not need an inline `outputForward:` block.
