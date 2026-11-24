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

The forwarder reads a file once it holds at least 256 bytes. A compact file that stays smaller is forwarded after it grows past that size.

**4. Install the Log10x App** on the search heads and on the instances that parse the events: the indexers, or the heavy forwarder the Universal Forwarder sends to. The app sets each compact event's time while the event is parsed.

!!! warning

    With the Receiver on each host, before the heavy forwarder, the heavy forwarder's index-time rules do not apply to compact events: index overrides, masks (`SEDCMD`, `_raw` rewrites), `nullQueue` filters and index-time fields. A value such a mask hides on raw events is readable after expansion, and events such a filter drops are indexed and counted against the license. To keep these rules, [place the Receiver after the heavy forwarder's parsing](#receiver-beside-a-heavy-forwarder).

## Receiver beside a heavy forwarder

Where Universal Forwarders send to a heavy forwarder, the Receiver can run on the heavy forwarder's host, and the Universal Forwarders stay as they are. The heavy forwarder parses the events with its add-ons and writes the chosen sourcetypes to its ingest actions file destination, one JSON line per event with its time, host, source, sourcetype and index. Fluent Bit on the same host reads those files, hands each event to the Receiver, and writes what comes back to a second folder, again one JSON line per event. The heavy forwarder reads that folder and sends the compact events to the indexers with its own outputs, each with the time, host, source and index it had. Every other event goes to the indexers unchanged. No HTTP Event Collector or token is involved, and the files sit between the heavy forwarder and the Receiver, so a stopped or slow Receiver does not hold up the heavy forwarder.

**1. Prerequisites.**

- A heavy forwarder that parses the chosen sourcetypes, with the add-ons that parse them installed and the add-ons' inputs disabled. The file destination works on Splunk 9.4 through 10.6.
- On the heavy forwarder's host: Docker, for Fluent Bit and the Receiver, and Python 3.9 or later, for the clean-up job.

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
INGEST_EVAL = $pd:_destinationKey$=if(index=="<index>" AND isnull(tenx_sourcetype), "rfs:tenx", null())
```

`<index>` is the index the Universal Forwarders give the events. The route sends those events to the file only. An event the heavy forwarder reads back from the second folder carries `tenx_sourcetype`, so the route never takes it again. Restart the heavy forwarder after the first install. Splunk writes one file per sourcetype and hour of events, under `/opt/tenx/rfs/year=<YYYY>/month=<MM>/day=<DD>/sourcetype=<sourcetype>/`, in folders that only the user Splunk runs as can read, so Fluent Bit runs as root or as that user.

Where a rule of the heavy forwarder's own sets the index before the route runs, route by sourcetype instead, `if(sourcetype=="XmlWinEventLog" AND isnull(tenx_sourcetype), "rfs:tenx", null())`, and the events are written with the index that rule set.

**3. Run Fluent Bit and the Receiver on the heavy forwarder's host.** Fluent Bit runs as two processes, each with its buffer on disk: one reads each sourcetype's folder and hands each event to the Receiver, the other writes what comes back to `/opt/tenx/compact`. Put these two files in `/opt/tenx/fluent-bit`, for the first:

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
    Tag                rfs.win.*
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
    Match        rfs.win.*
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
    Name         file
    Match        tenx.rfs.win.*
    Path         /opt/tenx/compact/events/win
    Format       plain
    Mkdir        On
    Retry_Limit  False

[OUTPUT]
    Name         file
    Match        tenx.tenx-template
    Path         /opt/tenx/compact/templates
    File         templates.ndjson
    Format       plain
    Mkdir        On
    Retry_Limit  False
```

`Format plain` writes each record as one JSON object: the time, host, source, sourcetype and index of the file destination's line, and the compact text in `event`. The tag `rfs.win.*` holds the path of the file Fluent Bit read, and with no `File` the output names each file after its tag, so each file in `/opt/tenx/compact/events/win` holds the events of one file of the file destination. The template records go to `templates.ndjson`.

Create the folders:

```sh
mkdir -p /opt/tenx/fluent-bit-state /opt/tenx/compact/events/win /opt/tenx/compact/templates
```

Start the Fluent Bit that writes the second folder, then the Receiver and the Fluent Bit that reads the files, both in its network:

```sh
docker run -d --name tenx-fluentbit-back \
  -v /opt/tenx/fluent-bit-back:/fluent-bit/etc:ro -v /opt/tenx/fluent-bit-state:/opt/tenx/fluent-bit-state \
  -v /opt/tenx/compact:/opt/tenx/compact fluent/fluent-bit:5.1.5
docker run -d --name tenx-receiver-win --network container:tenx-fluentbit-back log10x/edge-10x:1.1.181 \
  @run/input/forwarder/fluentbit @apps/receiver receiverOptimize true varMaxRecurIndexes 0 timestampZone UTC \
  timestampMaxPerObject 1 groupJoinLines false fluentbitInputPort 24224 fluentbitOutputHost 127.0.0.1 \
  fluentbitOutputPort 24225 fluentbitInputMessageField event
docker run -d --name tenx-fluentbit --network container:tenx-fluentbit-back \
  -v /opt/tenx/fluent-bit:/fluent-bit/etc:ro -v /opt/tenx/fluent-bit-state:/opt/tenx/fluent-bit-state \
  -v /opt/tenx/rfs:/opt/tenx/rfs:ro fluent/fluent-bit:5.1.5
```

The Receiver and the Fluent Bit that reads the files run in the network of the one that writes the second folder, so restart both after each restart of it.

Data models, `tstats` and detections read fields that Splunk stores at index time. For them, add the field profile of the source and three options to the Receiver's arguments:

```sh
@run/fields/windows-security-xml.yaml compactFieldsForm text compactFieldsKey meta compactFieldsSeparator ::
```

The [field profiles](https://doc.log10x.com/run/transform/fields/) include `windows-security-classic.yaml` for classic Windows text and `fortigate.yaml` for FortiGate. Each Receiver takes the profile of its own source.

**4. Read the second folder on the heavy forwarder.** Install the Log10x App's `_indexers` package on the heavy forwarder (see [What to Install on Each Tier](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#what-to-install-on-each-tier)). In the app of step 2, monitor each Receiver's folder with the compact sourcetype of its events, and the template records:

```ini title="inputs.conf"
[monitor:///opt/tenx/compact/events/win]
sourcetype = tenx_encoded
index = <index>
crcSalt = <SOURCE>

[monitor:///opt/tenx/compact/templates]
sourcetype = tenx_dml_raw_json
index = tenx_dml
crcSalt = <SOURCE>
```

Restart the heavy forwarder. On every file under `/opt/tenx/compact/events/`, the app's rule `tenx-record-unwrap` gives each event the time, host, source and index its line holds, sets `tenx_sourcetype` to its original sourcetype, and makes the compact text the event. The `index` above applies only to a line that names none.

For data models, add this line to `local/props.conf` of the Log10x App on the heavy forwarder. Each compact event is then indexed under its original sourcetype, with the fields its Receiver's profile attached:

```ini title="props.conf"
[tenx_encoded]
TRANSFORMS-tenx_type = tenx-original-sourcetype
```

Turn it on only where every Receiver runs a field profile, as [Compact Events Under the Original Sourcetype](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#compact-events-under-the-original-sourcetype) describes.

`crcSalt = <SOURCE>` makes the heavy forwarder read a file whose first 256 bytes are the same as those of a file it has read, as two compact files can be. Set it before the first file is read: changing it later makes the heavy forwarder read every file again. For a second folder elsewhere, see [Receiver Beside a Heavy Forwarder](https://github.com/log-10x/splunk-app/blob/main/tenx-for-splunk/README.md#receiver-beside-a-heavy-forwarder) in the app's README.

**5. Set up the indexers and the search head.** On the indexers, create the compact indexes and `tenx_dml`; they need nothing else of Log10x, because the heavy forwarder sends them parsed events. On the search head, install the Log10x App and the add-ons. Create `tenx_dml` where the search head's own events are indexed as well, since the app writes copies of the templates there.

Create the indexes the events go to and restart the indexers before the first event is sent. The search below returns no row once every indexer has loaded them.

```spl
index=_internal sourcetype=splunkd component=IndexerService "unconfigured/disabled/deleted index" | stats count by host
```

**6. Choose the sourcetypes.** Each sourcetype takes, on the heavy forwarder, a stanza in `props.conf` that names the route and a monitor of its folder in `/opt/tenx/compact/events`; and on its host a `tail` input on its folder, a `forward` output to a Receiver of its own on a port of its own, and a `file` output for its tag. A Windows Universal Forwarder's event log input gives the sourcetype `XmlWinEventLog:Security`, which the Windows add-on renames to `XmlWinEventLog` on the heavy forwarder; give `[XmlWinEventLog:Security]` the same `TRANSFORMS-zzz_tenx` line. Classic text events take it on `[WinEventLog:Security]`.

The route goes on the sourcetype the heavy forwarder receives, because Splunk picks the `props.conf` stanza before an add-on renames the sourcetype. The FortiGate add-on renames `fgt_log` to `fortigate_traffic` and its siblings, so the line goes on `[fgt_log]`. The file destination writes the renamed sourcetype, so the `tail` input reads `sourcetype=fortigate_traffic`.

**7. Check that it works.** Send a sample of the source a second time into a baseline index that the route does not take, for example a copy of a file in a second monitor stanza with `crcSalt = <SOURCE>`. Once the templates are in the KV store and the next knowledge bundle has taken them to the indexers, about a minute later, count both arms on the search head. Then compare the text and time of every event:

```spl
| tstats count where (index=<baseline index> OR index=<index>) host=<host> by index sourcetype
```

```spl
| multisearch [search index=<baseline index> host=<host> | eval arm="raw", m=md5(_raw . strftime(_time, "%s.%6N")) | fields arm m] [search index=<index> host=<host> `tx` | eval arm="10x", m=md5(_raw . strftime(_time, "%s.%6N")) | fields arm m] | stats count(eval(arm="raw")) as raw count(eval(arm="10x")) as tenx by m | stats sum(raw) as raw_events sum(tenx) as tenx_events sum(eval(min(raw,tenx))) as equal sum(eval(if(tenx>raw,tenx-raw,0))) as doubled sum(eval(if(raw>tenx,raw-tenx,0))) as lost
```

When every event arrived once with its text and time unchanged, `equal` is the same as both counts, and `doubled` and `lost` are 0. Before the templates reach the indexers, compact events come back unexpanded with `tenx_expand_refused` set to `no-template`, and every event counts as both doubled and lost.

**8. Delete the files that have been read.** Neither Splunk nor Fluent Bit deletes them. A scheduled job on the heavy forwarder's host deletes the file destination's files, for example in `/etc/cron.d/tenx-rfs`:

```
*/10 * * * * root find /opt/tenx/rfs -name '*.ndjson' -mmin +<minutes> -delete
```

Set `<minutes>` above the longest time the Receivers may be stopped: a file deleted before Fluent Bit has read it is lost.

The second folder takes a job of its own, which deletes a file only when the heavy forwarder reports it as finished reading and it has not changed for `<minutes>` minutes:

```sh title="/opt/tenx/compact-clean.sh"
curl -sk -K /opt/tenx/splunk-auth \
  "https://localhost:8089/services/admin/inputstatus/TailingProcessor:FileStatus?output_mode=json" |
  python3 -c 'import json, sys
for path, status in json.load(sys.stdin)["entry"][0]["content"]["inputs"].items():
    if status.get("type") == "finished reading":
        print(path)' > /opt/tenx/compact-finished.txt
find /opt/tenx/compact -type f -mmin +"$MINUTES" | grep -Fx -f /opt/tenx/compact-finished.txt |
  while read -r f; do rm -f "$f"; done
```

```
*/10 * * * * root MINUTES=<minutes> sh /opt/tenx/compact-clean.sh
```

`/opt/tenx/splunk-auth` is a file that only root can read, holding the heavy forwarder's admin login for curl: `user = "admin:<password>"`. A file of the second folder deleted before the heavy forwarder has read it is lost.

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

Start the second Receiver as in step 3, named `tenx-receiver-win-2` and with `fluentbitInputPort 24227`.

**The heavy forwarder's own rules** apply before compaction: the file holds each event as its `SEDCMD`, `_raw` masks and other index-time rules left it. Events a `nullQueue` filter drops are not written. Fields a rule of the heavy forwarder's own writes with `WRITE_META` are not on the compact events.

**A source that can be read only once**, such as an event log channel, gets its baseline from a clone on the heavy forwarder:

```ini title="transforms.conf"
[tenx_route_file]
INGEST_EVAL = $pd:_destinationKey$=if(index=="<index>" AND isnull(tenx_sourcetype), "rfs:tenx", null()), $pd:_doRouteClone$=if(index=="<index>" AND isnull(tenx_sourcetype), "true", null())
```

The heavy forwarder writes each event to the file and also sends it to the indexers raw, both copies in the index the Universal Forwarder gave it. In the searches of step 7, read the raw copies with `index=<index> NOT sourcetype::tenx_*` and the compact ones with `index=<index>` before `` `tx` ``.

A sender pointed at a Fluent Bit HEC input in front of the Receiver is compacted; a source posting straight to Splunk's own HEC endpoint is not covered.

With indexer acknowledgement on the heavy forwarder's output to the indexers (`useACK = true`), an indexer restart loses no compact event. A block whose acknowledgement is lost in the restart is sent again, and its events are indexed twice.

After a Receiver is stopped and started, Fluent Bit sends the records that waited on its retry schedule. The wait between tries grows, so their compact events can arrive minutes after the Receiver is back.

Each Receiver reads up to 2 MB a second by default (`forwarderInputBytesLimit`), and records that arrive faster wait in Fluent Bit's buffer on disk. For a sourcetype that sends more, raise the limit, set it to 0 for no byte limit, or add Receivers as above.

**Switching it off.** Remove the `TRANSFORMS-zzz_tenx` lines from the heavy forwarder's `props.conf` and restart it. The chosen sourcetypes then go to the indexers raw, and no new file reaches `/opt/tenx/rfs`. Once the files in `/opt/tenx/compact/events` stop changing and the heavy forwarder reports them as finished reading, stop Fluent Bit and the Receivers.

Keep the Log10x App on the search head for the compact events already indexed. A `tx` search over an index that now also holds raw events warns that it leaves them out; name them in the app's `tenx-raw-events` macro to return both.
