---
icon: simple/vector
---

Configure the Unix socket input stream for receiving events from Vector's `socket` sink.

## Overview

This module configures a Unix domain socket server that receives newline-delimited records from Vector's `socket` sink (`mode: unix`). Each line becomes one event in the Log10x processing pipeline.

## Requirements

| Requirement | Details |
|---|---|
| Vector | v0.34+ |
| Protocol | Newline-delimited bytes (text or JSON) over Unix domain socket |
| Default Socket | `/tmp/tenx-vector-in.sock` |

## Vector sink configuration

```yaml
sinks:
  tenx_in:
    type: socket
    inputs: [your_source]
    mode: unix
    path: /tmp/tenx-vector-in.sock
    encoding:
      codec: text
```

The `text` codec writes the `.message` field of each event followed by a newline. Use `json` if you want to ship the full event envelope as NDJSON instead.
