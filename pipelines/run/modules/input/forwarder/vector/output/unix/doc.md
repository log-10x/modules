---
icon: simple/vector
---

Write TenXObjects back to Vector via a Unix domain socket using the Fluent Forward protocol. Vector consumes this on the receiving side via its `fluent` source.

## Vector source configuration

```yaml
sources:
  tenx_out:
    type: fluent
    mode: unix
    path: /tmp/tenx-vector-out.sock
```
