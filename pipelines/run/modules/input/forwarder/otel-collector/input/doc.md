---
icon: simple/opentelemetry
---

Configure the Unix socket input stream for receiving syslog events from OpenTelemetry Collector.

## Overview

This module configures a Unix domain socket server that receives RFC5424 syslog messages from OpenTelemetry Collector's `syslog` exporter. The syslog MSG field is extracted and passed to the Log10x processing pipeline.

## Requirements

| Requirement | Details |
|-------------|---------|
| OTel Collector | **Contrib v0.143.0+** (for syslog exporter Unix socket support) |
| Protocol | RFC5424 syslog over Unix domain socket |
| Default Socket | `/tmp/tenx-otel-in.sock` |

## Architecture

```mermaid
graph LR
    A["OTel Collector"] -->|syslog/unix| B["Unix Socket"]
    B -->|RFC5424| C["Log10x Input"]
    C -->|MSG field| D["Processing Pipeline"]

    classDef otel fill:#f97316,stroke:#ea580c,color:#ffffff,stroke-width:2px
    classDef socket fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px
    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px

    class A otel
    class B socket
    class C,D engine
```

## Message Handling

!!! important "Syslog MSG Field"
    The syslog exporter uses the `message` **attribute** for the MSG field, NOT the log body.
    Ensure your logs have a `message` attribute set before the syslog exporter.

