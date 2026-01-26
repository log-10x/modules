---
icon: simple/opentelemetry
---

Configure output encoding options for writing processed TenXObjects back to OpenTelemetry Collector via Forward protocol.

## Overview

This module configures the Forward protocol output for returning processed events to OTel Collector. Events are written to a Unix domain socket where OTel Collector's `fluentforward` receiver listens.

## Output Modes

| Mode | Setting | Output |
|------|---------|--------|
| **Plain-text** | `encodeObjects: false` | Original log text (`fullText` field) |
| **Encoded** | `encodeObjects: true` | compact format via `encode()` function |

## Architecture

```mermaid
graph LR
    A["Log10x Pipeline"] -->|Forward| B["Unix Socket"]
    B --> C["OTel Collector"]
    C -->|fluentforward| D["Final Exporters"]

    classDef engine fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px
    classDef socket fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px
    classDef otel fill:#f97316,stroke:#ea580c,color:#ffffff,stroke-width:2px

    class A engine
    class B socket
    class C,D otel
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `otelCollectorEncodeObjects` | `false` | Enable lossless compact for optimizer mode |
| `otelCollectorOutputForwardAddress` | `/tmp/tenx-otel-out.sock` | Unix socket path for output |

