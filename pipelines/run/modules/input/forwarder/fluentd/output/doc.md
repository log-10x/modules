---
icon: simple/fluentd
hidden: true
---

Sends processed events back to Fluentd over the [Fluent Forward protocol](https://docs.fluentd.org/output/forward) — TCP on Windows, TCP or Unix domain socket on Linux/macOS.

Each event leaves Log10x with the original Fluentd **tag** restored on the Forward wire — destinations that route on `$TAG` (Splunk index, S3 path, Kafka topic, …) behave the same as if Log10x weren't in the path. The record body preserves every field that came in from Fluentd; the Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether a symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:24225` so it pairs with the [input](../input/) listening on `:24224`. Override the destination with `fluentdOutputHost` / `fluentdOutputPort`, or `fluentdOutputPath` for a Unix domain socket on Linux/macOS.
