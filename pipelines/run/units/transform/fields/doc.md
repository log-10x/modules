---
icon: material/equal
---

Extracts JSON objects and KV structures from [TenXTemplates](https://doc.log10x.com/run/template) as named fields.

This process enables [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to access nested JSON/KV values at runtime as named members.

For an hybrid JSON/plain event whose [text](https://doc.log10x.com/api/js/#TenXBaseObject+text) value is:

``` json 
17/06/24 17:38:00 INFO ExecutorRunnable: Prepared Local resources Map(__spark__.jar -> resource 
{ scheme: "hdfs" host: "10.10.34.11" port: 9000 
file: "/user/curi/.sparkStaging/application_1485248649253_0144/spark-assembly-1.6.0-hadoop2.2.0.jar" } 
size: 109525492 timestamp: 1497001131801 type: FILE visibility: PRIVATE)
```

To increase a [counter](https://doc.log10x.com/api/js/#TenXCounter) identified by a JSON field (scheme) value with that of a KV entry (size):

``` js
TenXCounter.inc(this.scheme, this.size);
```

To [drop](https://doc.log10x.com/api/js/#TenXObject+drop) the instance if either a KV entry (e.g., _visibility_) or JSON field (e.g., _port_) match a specified value:

``` js 
this.drop((this.visibility == "PRIVATE") || (this.port == 9000));
```

### :material-format-letter-case: Names

A field whose name is not a variable name, such as `user-agent` or `Account Name`, is named by the `l1e_` prefix and its name as written. This works in an output's `fields` (`l1e_user-agent`), in `get("l1e_user-agent")` and in `encode("l1e_user-agent")`, which writes the value under the key `l1e_user-agent`.

### :material-code-array: Arrays

If a JSON/KV field appears more than once within an TenXObject's text, it can be accessed as an array field to access individual entries (e.g., `this.myField[i]`).      

### :material-file-tree: Readers

`fieldReaders` selects the readers that find the fields of each TenXTemplate, in place of the JSON and key-value scan: `xml`, `kv`, `json`, `columns` and `lines`. The first reader that reads a template's text gives its fields, once per template. Each event of the template then reads its values from its own text at the same places.

An XML field is named by its path, such as `Event.System.EventID`, or by the attribute that `fieldNameAttributes` names, such as `Event.EventData.SubjectUserName` with `Data@Name`. A JSON field is named by its key path, such as `userIdentity.arn` or `resources[].ARN`. A column is named by its position in `fieldColumns`.

A `lines` field is named by the headings above it and its own name, such as `Subject.Account Name`. Classic Windows event text, the form an event has when it is not rendered as XML, reads with these settings:

``` yaml
fieldReaders: [lines]
fieldLineSeparators: ["=", ":\t"]
```

A value ends at its line. To read `Message` as the whole message, add `fieldLineRestNames: [Message]`. To read `Privileges` as a list of its lines, add `fieldLineListNames: [Privileges]`.

### :material-tag-multiple: Fields on compact events

`compactFields` lists fields that `encode()` writes beside each compact event, in its record, so that a destination can index them without expanding the event:

``` yaml
fieldReaders: [xml]
fieldNameAttributes: [Data@Name]
compactFields:
  - Event.System.EventID=EventCode
  - Event.EventData.NewProcessName=process_path
```

An event whose listed fields cannot be given exactly as its text holds them is written whole instead. `compactFieldsWhole()` returns why, so that an aggregator can count such events.

### :material-file-cog: Profiles

A profile sets `fieldReaders` and `compactFields` for one source. It lists the fields that the source's Splunk add-on reads to fill its CIM data models, under the add-on's names:

- `windows-security-xml.yaml`: Windows Security events in XML.
- `windows-security-classic.yaml`: Windows Security events in classic text.
- `sysmon.yaml`: Sysmon events.
- `stream-dns.yaml`, `stream-tcp.yaml` and `stream-ip.yaml`: Splunk Stream DNS, TCP and IP events.
- `fortigate.yaml`: FortiGate key=value logs.

The profiles are in the config folder [run/fields](https://github.com/log-10x/config/tree/main/pipelines/run/fields). Select one by its path on the launch line:

```bash
tenx @run/input/forwarder/fluentbit @apps/receiver receiverOptimize true @run/fields/sysmon.yaml
```

Select one profile per Receiver. Two profiles that share an entry list it twice, which stops the launch. The first lines of each file name the add-on version it was checked with and the data models its fields fill.
