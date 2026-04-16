---
icon: material/file-refresh-outline
---

Monitors changes to configuration and symbol files to notify/restart affected pipeline [units](https://doc.log10x.com/engine/pipeline/#units) or the entire pipeline. 

This mechanisms works in tandem with [GitHub-Sync](https://doc.log10x.com/config/github) to enables symbol, lookup and configuration files to refresh at run time in order to reflect dynamic changes at the environment level. 

For a real-world example see the [rate regulator](https://doc.log10x.com/run/regulate/rate/), which reloads its field-set mute file on disk changes — a GitOps-synced commit applies cluster-wide on the next reload.