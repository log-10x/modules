---
icon: material/filter
---

# OpenTelemetry Collector Regulator

Read events from an OpenTelemetry Collector forwarder, apply regulation policies to filter events, and write filtered events back to OTel Collector.

This module is a component of the [Edge Regulator](https://doc.log10x.com/apps/edge/regulator/) app.

## Overview

The OpenTelemetry Collector Regulator configures:

- A TCP JSON input stream (port 4318 default) to receive events
- Regulation policies to filter events based on rules
- A Unix socket output to write filtered events back to OTel Collector

## Installation

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Regulator OpenTelemetry Collector [run instructions](https://doc.log10x.com/apps/edge/regulator/run/#otel-collector)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Edge Regulator OpenTelemetry Collector [deployment instructions](https://doc.log10x.com/apps/edge/regulator/deploy/#otel-collector)

## Configuration

See [config.yaml](config.yaml) for the default regulator configuration.

## Event Flow

```
OTel Collector → TCP JSON (4318) → Log10x Regulator → Unix Socket → OTel Collector → Exporters
```

1. OTel Collector sends events via TCP JSON to Log10x
2. Log10x applies regulation policies (rate limiting, filtering)
3. Filtered events are written back via Unix socket
4. OTel Collector forwards filtered events to final destinations

## Related

- [OpenTelemetry Collector Reporter](../report/index.md)
- [OpenTelemetry Collector Optimizer](../optimize/index.md)
- [Regulation Policies](https://doc.log10x.com/run/regulate/policy/)

