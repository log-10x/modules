---
icon: simple/opentelemetry
hidden: true
---

Reads events from the OpenTelemetry Collector over the [`syslog` exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/syslogexporter) — RFC5424 over TCP on every OS, or a Unix domain socket on Linux/macOS.

Each event from the Collector arrives as an RFC5424 syslog message. The input strips the envelope and surfaces only the **MSG** field — the log line that the Collector's syslog exporter wrote — as the event's `text`, which is the input to every message-content enrichment downstream. The same MSG text is also kept on the event's `fullText` for verbatim downstream use.

Unlike the Fluentd/Vector inputs, the syslog wire format carries no per-event tag and no structured fields beyond the MSG, so no JSON extraction or `sourcePattern` is applied. Events flow through Log10x with an empty source; rate-based grouping uses Log10x's defaults instead of a per-tag bucket.

The matching Collector exporter config:

```yaml
exporters:
  syslog/tenx:
    endpoint: 127.0.0.1            # or remove endpoint/port and set
    port: 24226                    # `network: unix` + `endpoint: <path>`
    network: tcp
    protocol: rfc5424
    tls:
      insecure: true
```
