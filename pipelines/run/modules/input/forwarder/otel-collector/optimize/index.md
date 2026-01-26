---
icon: material/tune
---

# OpenTelemetry Collector Optimizer

Read events from an OpenTelemetry Collector forwarder, apply optimization transformations, and write optimized events back to OTel Collector for shipping to outputs.

This module is a component of the [Edge Optimizer](https://doc.log10x.com/apps/edge/optimizer/) app.

## Overview

The OpenTelemetry Collector Optimizer configures:

- A TCP JSON input stream (port 4318 default) to receive events
- Optimization transformations to enhance events
- A Unix socket output to write optimized events back to OTel Collector

## Installation

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Optimizer OpenTelemetry Collector [run instructions](https://doc.log10x.com/apps/edge/optimizer/run/#otel-collector)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Edge Optimizer OpenTelemetry Collector [deployment instructions](https://doc.log10x.com/apps/edge/optimizer/deploy/#otel-collector)

## Configuration

See [config.yaml](config.yaml) for the default optimizer configuration.

## Event Flow

```
OTel Collector → TCP JSON (4318) → Log10x Optimizer → Unix Socket → OTel Collector → Exporters
```

1. OTel Collector sends events via TCP JSON to Log10x
2. Log10x applies optimization transformations:
   - Format conversion (Splunk HEC, Elastic)
   - Payload reduction
   - Metadata enrichment
   - Field transformation
3. Optimized events are written back via Unix socket (forward protocol)
4. OTel Collector forwards optimized events to final destinations (Splunk, Elastic, etc.)

## Use Cases

- Transform events for Splunk HEC format
- Optimize events for ElasticSearch indexing
- Reduce event payload size to save bandwidth
- Enrich events with Kubernetes metadata
- Apply custom field transformations

## Related

- [OpenTelemetry Collector Reporter](../report/index.md)
- [OpenTelemetry Collector Regulator](../regulate/index.md)
- [Event Transformations](https://doc.log10x.com/run/transform/)

