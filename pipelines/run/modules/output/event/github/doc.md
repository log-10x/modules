---
icon: material/github
---

Write [TenXObject](https://doc.log10x.com/api/js/#TenXObject) instance values to a remote file on GitHub.

This output allows pipelines to dynamically generate [YAML](https://doc.log10x.com/config/yaml/) configuration and text [lookup](https://doc.log10x.com/api/js/#TenXLookup) files.

Subsequent pipeline instances can [pull](https://doc.log10x.com/config/github/) generated files from GitHub to guide their execution.

!!! tenx-cloud "Availability"

    This implementation is only available by default in the 10x Engine [Cloud](https://doc.log10x.com/engine/flavors/#cloud) flavor to reduce the footprint of the [edge](https://doc.log10x.com/engine/flavors/#edge)/[JIT-edge](https://doc.log10x.com/engine/flavors/#jit-edge) flavors. 