---
icon: material/table-eye
---

Enrich TenXObjects using TSV/CSV [lookup](https://doc.log10x.com/api/js/#TenXLookup) files.

Example: map [HTTP status codes](https://github.com/Mr-Pi/httpStatusCodes/blob/master/priv/http-status-codes-1.csv?plain=1) to human-readable messages.

Lookup files [reload](https://doc.log10x.com/run/reload/) on disk changes and can [sync](https://doc.log10x.com/config/github/) from GitHub for dynamic updates.

The [rate regulator](https://doc.log10x.com/run/regulate/rate/) consumes a field-set keyed mute file pulled from GitHub, letting operators declaratively cap noisy patterns with diff-reviewed, self-expiring entries.