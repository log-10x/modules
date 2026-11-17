---
icon: material/greater-than
---

Splunk Universal Forwarder inputs use a **file relay pattern** with [Fluent Bit + 10x](../fluentbit/) to process events _before_ Splunk UF ships them to Splunk indexers. This approach keeps UF as the forwarder (handling buffering, retries, timeouts) while 10x filters and (optionally) compacts events inline.

## Architecture

<div style="text-align: center;">

```mermaid
graph LR
    A["<div style='font-size: 14px;'>📝 App Logs</div><div style='font-size: 10px;'>Folder A</div>"] --> B["<div style='font-size: 14px;'>🔧 Fluent Bit</div><div style='font-size: 10px;'>+ 10x sidecar</div>"]
    B --> C["<div style='font-size: 14px;'>📂 Processed</div><div style='font-size: 10px;'>Folder B</div>"]
    C --> D["<div style='font-size: 14px;'>📤 Splunk UF</div><div style='font-size: 10px;'>monitors B</div>"]
    D --> E["<div style='font-size: 14px;'>🔍 Splunk</div><div style='font-size: 10px;'>Indexers</div>"]

    classDef logs fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef fluentbit fill:#ea580c,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef processed fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef uf fill:#0891b2,stroke:#0e7490,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef splunk fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class A logs
    class B fluentbit
    class C processed
    class D uf
    class E splunk
```

</div>

### Data Flow

- 📝 **App Logs (Folder A)** - Application writes logs to original location
- 🔧 **Fluent Bit + 10x** - Reads from Folder A, filters and (optionally) compacts events
- 📂 **Processed Logs (Folder B)** - 10x writes processed output to new location
- 📤 **Splunk UF** - Monitors Folder B with standard `inputs.conf`, handles forwarding
- 🔍 **Splunk Indexers** - Receives processed events via standard S2S protocol

### Why File Relay?

| Benefit | Description |
|---------|-------------|
| 🔧 **Standard UF** | No protocol changes, no `enableOldS2SProtocol` flag |
| 👤 **App Team Control** | Configure without Splunk admin involvement |
| 🔒 **UF Handles Reliability** | Buffering, retries, and timeouts stay with UF |
| ✅ **Proven Pattern** | Uses existing [Fluent Bit + 10x](../fluentbit/) integration |

### When to Use

This module is recommended for **VM/traditional infrastructure** where Splunk UF is deployed. For Kubernetes environments, Splunk recommends [Splunk Connect for Kubernetes](https://github.com/splunk/splunk-connect-for-kubernetes) (which uses Fluent Bit) - use the [Fluent Bit module](../fluentbit/) directly in that case.

??? tenx-keyfiles "Key Files"

    This module uses the [Fluent Bit forwarder module](../fluentbit/) under the hood:

    | File | Purpose |
    |------|---------|
    | [`fluentbit/conf/tenx-sidecar.conf`](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-sidecar.conf) | Reference Fluent Bit config showing the 10x sidecar handoff |

## Quickstart

These steps send compact events to Splunk through the Universal Forwarder. The [Log10x App](https://doc.log10x.com/apps/receiver/compact/splunk/) expands them at search time.

**1. Run Log10x** on the host that runs Fluent Bit ([install on Linux](https://doc.log10x.com/install/linux/)), with the five arguments the Splunk app needs:

```bash
tenx @run/input/forwarder/fluentbit @apps/receiver receiverOptimize true varMaxRecurIndexes 0 timestampZone UTC timestampMaxPerObject 1 groupJoinLines false
```

**2. Write the processed events to Folder B.** Fluent Bit reads Folder A, hands each record to Log10x, and writes what comes back into Folder B: each source's compact events in a file of their own, one event per line, and the template records in another file, one JSON object per line. It runs as two processes, each with a `storage.path` of its own: one reads Folder A and hands each record to Log10x, the other takes the records back and writes them.

```ini title="fluent-bit.conf"
[SERVICE]
    HTTP_Server     On
    HTTP_Port       2020
    storage.path    /var/log/app/flb-storage

[INPUT]
    Name            tail
    Path            /var/log/app/app.log
    DB              /var/log/app/app.log.db
    Tag             app.logs
    Read_from_Head  true
    storage.type    filesystem

[OUTPUT]
    Name            forward
    Match           app.*
    Host            127.0.0.1
    Port            24224
    Retry_Limit     False
```

```ini title="fluent-bit-back.conf"
[SERVICE]
    HTTP_Server     On
    HTTP_Port       2021
    storage.path    /var/log/app/flb-storage-back

[INPUT]
    Name            forward
    Listen          0.0.0.0
    Port            24225
    Tag_Prefix      tenx.
    storage.type    filesystem

[OUTPUT]
    Name            file
    Match           tenx.app.logs
    Path            /var/log/tenx
    File            app.log
    Format          template
    Template        {log}

[OUTPUT]
    Name            file
    Match           tenx.tenx-template
    Path            /var/log/tenx
    File            templates.log
    Format          plain
```

Start Fluent Bit once with each file, the one that writes Folder B first: `fluent-bit -c fluent-bit-back.conf` and `fluent-bit -c fluent-bit.conf`.

**3. Monitor Folder B with the Universal Forwarder.** Add both files to `inputs.conf` on the forwarder:

```ini title="inputs.conf"
[monitor:///var/log/tenx/app.log]
index = your_logs_index
sourcetype = tenx_encoded
_meta = tenx_sourcetype::your:original:sourcetype

[monitor:///var/log/tenx/templates.log]
index = tenx_dml
sourcetype = tenx_dml_raw_json
```

`tenx_encoded` is the sourcetype the app expands. `_meta` adds the indexed field `tenx_sourcetype`, holding the sourcetype the events have when sent raw (for example `XmlWinEventLog` or `aws:cloudtrail`); the app's `txf` macro reads it to apply that sourcetype's field extractions. The template records go to the `tenx_dml` index, from which the app fills its KV Store.

Create both indexes, `tenx_dml` and the compact index, where the events are indexed before the forwarder sends.

For a source read by a [field map](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#data-models-and-detections-the-field-map), run Log10x for it as the field map describes and monitor its file with the field map's compact sourcetype in place of `tenx_encoded`, for Windows Security `sourcetype = tenx_win`.

The forwarder reads a file once it holds at least 256 bytes. A compact file that stays smaller is forwarded after it grows past that size.

**4. Install the Log10x App** on the search heads and on the instances that parse the events: the indexers, or the heavy forwarder the Universal Forwarder sends to. The app sets each compact event's time while the event is parsed.

!!! warning
    With the Receiver on each host, before the heavy forwarder, the heavy forwarder's index-time rules do not apply to compact events: index overrides, masks (`SEDCMD`, `_raw` rewrites), `nullQueue` filters and index-time fields. A value such a mask hides on raw events is readable after expansion, and events such a filter drops are indexed and counted against the license. To keep these rules, [place the Receiver after the heavy forwarder's parsing](#receiver-beside-a-heavy-forwarder).

## Receiver beside a heavy forwarder

Where Universal Forwarders send to a heavy forwarder, the Receiver can run on the heavy forwarder's host, and the Universal Forwarders stay as they are. The heavy forwarder parses the events with its add-ons and writes the chosen sourcetypes to its ingest actions file destination, one JSON line per event with its time, host, source, sourcetype and index. Fluent Bit on the same host reads those files, hands each event to the Receiver, and sends what comes back to the indexers' HTTP Event Collector (HEC) with the event's time, host, source and index. Every other event goes to the indexers unchanged. The files sit between the heavy forwarder and the Receiver, so a stopped or slow Receiver does not hold up the heavy forwarder.

**1. Prerequisites.**

- A heavy forwarder that parses the chosen sourcetypes, with the add-ons that parse them installed and the add-ons' inputs disabled. The file destination works on Splunk 9.4 through 10.6.
- On the heavy forwarder's host: Docker, for Fluent Bit and the Receiver, and Python 3.9 or later, for the field map tool.
- The indexers' HEC, reachable from that host.

**2. Write the chosen sourcetypes to a file destination.** In an app on the heavy forwarder, add the destination beside the existing `[tcpout]` groups, and route each chosen sourcetype to it:

```ini title="outputs.conf"
[rfs:tenx]
path = file:///opt/tenx/rfs
format = ndjson
compression = none
partitionBy = day, sourcetype
batchTimeout = 5
fs.timeBeforeClosingFileSecs = 30
```

```ini title="props.conf"
[XmlWinEventLog]
TRANSFORMS-zzz_tenx = tenx_route_file
```

```ini title="transforms.conf"
[tenx_route_file]
INGEST_EVAL = $pd:_destinationKey$=if(index=="<index>", "rfs:tenx", null())
```

`<index>` is the index the Universal Forwarders give the events. The route sends those events to the file only. Restart the heavy forwarder after the first install. Splunk writes one file per sourcetype and hour of events, under `/opt/tenx/rfs/year=<YYYY>/month=<MM>/day=<DD>/sourcetype=<sourcetype>/`, in folders that only the user Splunk runs as can read, so Fluent Bit runs as root or as that user.

Where a rule of the heavy forwarder's own sets the index before the route runs, route by sourcetype instead, `if(sourcetype=="XmlWinEventLog", "rfs:tenx", null())`, and the events are written with the index that rule set.

**3. Run Fluent Bit and the Receiver on the heavy forwarder's host.** Fluent Bit runs as two processes, each with its buffer on disk: one reads each sourcetype's folder and hands each event to the Receiver, the other sends what comes back to the HEC. Put these two files in `/opt/tenx/fluent-bit`, for the first:

```ini title="fluent-bit.conf"
[SERVICE]
    Flush                      1
    Parsers_File               /fluent-bit/etc/parsers.conf
    HTTP_Server                On
    HTTP_Port                  2020
    storage.path               /opt/tenx/fluent-bit-state/storage
    storage.sync               normal
    storage.backlog.mem_limit  16M

[INPUT]
    Name               tail
    Path               /opt/tenx/rfs/*/*/*/sourcetype=XmlWinEventLog/*.ndjson
    Tag                rfs.win
    Parser             json
    Read_from_Head     true
    Refresh_Interval   1
    Buffer_Chunk_Size  64k
    Buffer_Max_Size    4M
    DB                 /opt/tenx/fluent-bit-state/tail_win.db
    Mem_Buf_Limit      16MB
    storage.type       filesystem

[OUTPUT]
    Name         forward
    Match        rfs.win
    Host         127.0.0.1
    Port         24224
    Retry_Limit  False
```

```ini title="parsers.conf"
[PARSER]
    Name    json
    Format  json
```

And this one in `/opt/tenx/fluent-bit-back`, for the second:

```ini title="fluent-bit.conf"
[SERVICE]
    Flush                      1
    HTTP_Server                On
    HTTP_Port                  2021
    storage.path               /opt/tenx/fluent-bit-state/storage-back
    storage.sync               normal
    storage.backlog.mem_limit  16M

[INPUT]
    Name          forward
    Listen        0.0.0.0
    Port          24225
    Tag_Prefix    tenx.
    storage.type  filesystem

[OUTPUT]
    Name              splunk
    Match             tenx.rfs.win
    Host              <indexer>
    Port              8088
    Splunk_Token      ${HEC_TOKEN}
    TLS               On
    TLS.Verify        On
    Retry_Limit       False
    event_key         $event
    event_host        $host
    event_source      $source
    event_sourcetype  tenx_win
    event_index_key   $index
    event_field       tenx_sourcetype $sourcetype
    time_key          time

[OUTPUT]
    Name              splunk
    Match             tenx.tenx-template
    Host              <indexer>
    Port              8088
    Splunk_Token      ${HEC_TOKEN}
    TLS               On
    TLS.Verify        On
    Retry_Limit       False
    event_index       tenx_dml
    event_sourcetype  tenx_dml_raw_json
```

`tenx_win` is the compact sourcetype of the Windows Security field map in step 4; without a field map, the `splunk` output sends `event_sourcetype tenx_encoded`. `event_index_key $index` sends each event to the index it had on the heavy forwarder; without the `$`, Fluent Bit sends the word `index`. A field that a rule of the heavy forwarder's own writes with `WRITE_META` reaches the indexers only when this output names it, as `event_field <field> $fields['<field>']`. A test instance with Splunk's default self-signed certificate needs `TLS.Verify Off` in both `splunk` outputs.

Copy the Receiver's compact configuration out of the image, key its cap file on the template hash, and create the cap file with its header row:

```sh
mkdir -p /opt/tenx/receiver/win /opt/tenx/fluent-bit-state
docker create --name tenx-config log10x/edge-10x:1.1.181
docker cp tenx-config:/etc/tenx/config/pipelines/run/receive/compact/config.yaml /opt/tenx/receiver/compact-config.shipped.yaml
docker rm tenx-config
sed -e 's/^\(  fieldNames:\)$/\1 [templateHash]/' -e '/^    - \$=yield TenXEnv.get("symbolMessageField")$/d' \
  /opt/tenx/receiver/compact-config.shipped.yaml > /opt/tenx/receiver/compact-config.yaml
printf 'pattern_hash,value\n' > /opt/tenx/receiver/win/compact-cap.csv
```

Start the Fluent Bit that sends to the HEC, with `HEC_TOKEN` set in the environment, then the Receiver and the Fluent Bit that reads the files, both in its network. `<network>` is a Docker network from which the HEC is reachable:

```sh
docker run -d --name tenx-fluentbit-back --network <network> -e HEC_TOKEN \
  -v /opt/tenx/fluent-bit-back:/fluent-bit/etc:ro -v /opt/tenx/fluent-bit-state:/opt/tenx/fluent-bit-state \
  fluent/fluent-bit:5.1.5
docker run -d --name tenx-receiver-win --network container:tenx-fluentbit-back \
  -v /opt/tenx/receiver/compact-config.yaml:/etc/tenx/config/pipelines/run/receive/compact/config.yaml:ro \
  -v /opt/tenx/receiver/win:/opt/tenx/receiver/win log10x/edge-10x:1.1.181 \
  @run/input/forwarder/fluentbit @apps/receiver varMaxRecurIndexes 0 timestampZone UTC timestampMaxPerObject 1 \
  groupJoinLines false fluentbitInputPort 24224 fluentbitOutputHost 127.0.0.1 fluentbitOutputPort 24225 \
  fluentbitInputMessageField event compactReceiverLookupFile /opt/tenx/receiver/win/compact-cap.csv
docker run -d --name tenx-fluentbit --network container:tenx-fluentbit-back \
  -v /opt/tenx/fluent-bit:/fluent-bit/etc:ro -v /opt/tenx/fluent-bit-state:/opt/tenx/fluent-bit-state \
  -v /opt/tenx/rfs:/opt/tenx/rfs:ro fluent/fluent-bit:5.1.5
```

With the cap file, the Receiver compacts only the templates the field map lists, and every other event arrives whole. Without a field map, the Receiver takes `receiverOptimize true` in place of the cap file and compacts every template:

```sh
docker run -d --name tenx-receiver --network container:tenx-fluentbit-back log10x/edge-10x:1.1.181 \
  @run/input/forwarder/fluentbit @apps/receiver receiverOptimize true varMaxRecurIndexes 0 timestampZone UTC \
  timestampMaxPerObject 1 groupJoinLines false fluentbitInputPort 24224 fluentbitOutputHost 127.0.0.1 \
  fluentbitOutputPort 24225 fluentbitInputMessageField event
```

The Receiver and the Fluent Bit that reads the files run in the network of the one that sends to the HEC, so restart both after each restart of it.

**4. Set up the indexers and the search head.** On the indexers, create the compact indexes, `tenx_dml` and `tenx_probe`, and an HEC token whose `indexes` list them, and install the Log10x App (whole, or its `_indexers` package) and the add-ons. On the search head, install the Log10x App, the add-ons and CIM, and set the `tenx-events` macro to `index=* (sourcetype::tenx_encoded OR tenx_compact_st::tenx_win)`.

Create the indexes the events go to and restart the indexers before the first event is sent. The search below returns no row once every indexer has loaded them.

```spl
index=_internal sourcetype=splunkd component=IndexerService "unconfigured/disabled/deleted index" | stats count by host
```

Generate the Windows Security [field map](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#data-models-and-detections-the-field-map) on the heavy forwarder's host, with the Log10x App package unpacked in `/opt/tenx` and `SPLUNK_ADMIN_PW` and `HEC_TOKEN` set. First send the source once with the cap file empty: every event arrives whole as `tenx_win`, and the template records reach `tenx_dml`. On the search head, load them into the KV store with `index=tenx_dml sourcetype=tenx_dml_raw_json | sendalert tenx_dml_to_kv`, then export the store in pages of 2,000 rows until a page holds no row:

```sh
cd /opt/tenx
n=0
while :; do
  curl -sk -u "admin:$SPLUNK_ADMIN_PW" "https://<search head>:8089/servicesNS/nobody/tenx-for-splunk/storage/collections/data/tenx_dml?output_mode=json&limit=2000&skip=$((n*2000))" > kv_$n.json
  grep -q '"_key"' kv_$n.json || { rm kv_$n.json; break; }
  n=$((n+1))
done
```

Generate the field map app and its floor app:

```sh
python3 /opt/tenx/tenx-for-splunk/bin/tenx_field_map.py gen $(for f in kv_*.json; do printf -- '--records %s ' $f; done) \
  --target windows-security --rules lookup --addon $SPLUNK_HOME/etc/apps/Splunk_TA_windows \
  --app-name fm_win --cap-file /opt/tenx/receiver/win/compact-cap.csv --out fm_win
```

Install `fm_win` and `fm_win_floor` on the indexers and on the search head, and restart each after the first install: `activate` reads both apps from the instance `--splunkd` names. Then activate the field map:

```sh
TENX_SPLUNKD_AUTH="admin:$SPLUNK_ADMIN_PW" TENX_PROBE_HEC_TOKEN="$HEC_TOKEN" python3 /opt/tenx/tenx-for-splunk/bin/tenx_field_map.py activate \
  --app fm_win --cap-file /opt/tenx/receiver/win/compact-cap.csv \
  --splunkd https://<search head>:8089 --probe-hec https://<indexer>:8088 --probe-index tenx_probe
```

The Receiver rereads the cap file without a restart, and the events of the listed templates arrive compact from then on. On an instance with Splunk's default self-signed certificate, add `--tls-verify off`.

**5. Choose the sourcetypes.** Each sourcetype takes a stanza in `props.conf` on the heavy forwarder that names the route, and on its host a `tail` input on its folder, a `forward` output to a Receiver of its own on a port of its own, and a `splunk` output for its tag. A Windows Universal Forwarder's event log input gives the sourcetype `XmlWinEventLog:Security`, which the Windows add-on renames to `XmlWinEventLog` on the heavy forwarder; give `[XmlWinEventLog:Security]` the same `TRANSFORMS-zzz_tenx` line.

**6. Check that it works.** Send a sample of the source a second time into a baseline index that the route does not take, for example a copy of a file in a second monitor stanza with `crcSalt = <SOURCE>`. Once the templates are in the KV store, count both arms on the search head, then compare the text of every event:

```spl
| tstats count where (index=<baseline index> OR index=<index>) host=<host> by index sourcetype
```

```spl
| union [search index=<baseline index> host=<host> | eval arm="raw", m=md5(_raw) | fields arm m] [search index=<index> host=<host> `tx` | eval arm="10x", m=md5(_raw) | fields arm m] | stats count(eval(arm="raw")) as raw count(eval(arm="10x")) as tenx by m | stats sum(raw) as raw_events sum(tenx) as tenx_events sum(eval(min(raw,tenx))) as equal sum(eval(if(tenx>raw,tenx-raw,0))) as doubled sum(eval(if(raw>tenx,raw-tenx,0))) as lost
```

When every event arrived once with its text unchanged, `equal` is the same as both counts, and `doubled` and `lost` are 0.

**7. Delete the files Fluent Bit has read.** Neither Splunk nor Fluent Bit deletes them. A scheduled job on the heavy forwarder's host does, for example in `/etc/cron.d/tenx-rfs`:

```
*/10 * * * * root find /opt/tenx/rfs -name '*.ndjson' -mmin +<minutes> -delete
```

Set `<minutes>` above the longest time the Receivers may be stopped: a file deleted before Fluent Bit has read it is lost.

**Several Receivers for one sourcetype.** List the Receivers in an upstream file in `/opt/tenx/fluent-bit`, and in the sourcetype's `forward` output, replace `Host` and `Port` with `Upstream /fluent-bit/etc/receivers-win.conf`:

```ini title="receivers-win.conf"
[UPSTREAM]
    Name  receivers-win

[NODE]
    Name  receiver-win-1
    Host  127.0.0.1
    Port  24224

[NODE]
    Name  receiver-win-2
    Host  127.0.0.1
    Port  24227
```

Start the second Receiver with the field map line of step 3, named `tenx-receiver-win-2` and with `fluentbitInputPort 24227`. Both Receivers read the same cap file.

**The heavy forwarder's own rules** apply before compaction: the file holds each event as its `SEDCMD`, `_raw` masks and other index-time rules left it, and events a `nullQueue` filter drops are not written. A mask that changes the text of field-mapped events makes new templates, which arrive whole until the field map is generated and activated again.

**A source that can be read only once**, such as an event log channel, gets its baseline from a clone on the heavy forwarder:

```ini title="transforms.conf"
[tenx_route_file]
INGEST_EVAL = $pd:_destinationKey$=if(index=="<index>", "rfs:tenx", null()), $pd:_doRouteClone$=if(index=="<index>", "true", null())
```

The heavy forwarder writes each event to the file and also sends it to the indexers raw, both copies in the index the Universal Forwarder gave it. Give the compact copies an index of their own: in the source's `splunk` output, `event_index <compact index>` in place of `event_index_key $index`.

A sender pointed at a Fluent Bit HEC input in front of the Receiver is compacted; a source posting straight to Splunk's own HEC endpoint is not covered.

Fluent Bit's Splunk output has no indexer acknowledgement, so when Splunk's HEC answers 503 a resent chunk can be indexed twice, as on any Fluent Bit path to HEC; under an overloaded indexer this happened to under 1% of events.
