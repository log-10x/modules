---
icon: material/file-refresh-outline
---

Monitors changes to configuration and symbol files to notify/restart affected pipeline [units](https://doc.log10x.com/engine/pipeline/#units) or the entire pipeline. 

This mechanisms works in tandem with [GitHub-Sync](https://doc.log10x.com/config/github) to enables symbol, lookup and configuration files to refresh at run time in order to reflect dynamic changes at the environment level. 

For a real-world example see the [policy function](https://doc.log10x.com/apps/edge/policy/) which updates the threshold settings for an [output regulator](https://doc.log10x.com/run/output/regulate/) based on environment-wide criteria. 