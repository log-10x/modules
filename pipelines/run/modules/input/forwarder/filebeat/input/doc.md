---
icon: simple/beats
hidden: true
---

Configures how Filebeat messages piped to the 10x process are logged. Settings map to the [log4j2 config](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/filebeat/input/log4j2.yaml).

This [module](https://doc.log10x.com/engine/module/) pipes its output directly to a Filebeat shipper using a shell '|' pipe operator:
``` console
filebeat -e 2>&1 | tenx @in/filebeat
```

Filebeat process messages are logged based on [logging options](https://www.elastic.co/guide/en/beats/filebeat/current/configuration-logging.html) in filebeat.yml.

NOTE: For Windows EventLogs, add the [log4jna](https://github.com/dblock/log4jna) appender (not included by default).
