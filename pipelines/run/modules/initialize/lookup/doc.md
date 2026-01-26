---
icon: material/table-eye
---

Enrich TenXObjects using TSV/CSV [lookup](https://doc.log10x.com/api/js/#TenXLookup) files.

Example: map [HTTP status codes](https://github.com/Mr-Pi/httpStatusCodes/blob/master/priv/http-status-codes-1.csv?plain=1) to human-readable messages.

Lookup files [reload](https://doc.log10x.com/run/reload/) on disk changes and can [sync](https://doc.log10x.com/config/github/) from GitHub for dynamic updates.

The [policy regulator](https://doc.log10x.com/run/regulate/policy/) generates centralized lookup tables on GitHub, enabling edge instances to filter noisy telemetry based on environment-wide conditions.