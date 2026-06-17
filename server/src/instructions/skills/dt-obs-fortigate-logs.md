# FortiGate Firewall Log Analysis Skill

Query, parse, and analyze FortiGate/FortiOS firewall logs ingested via the `logs:pipeline_Fortiparser_8080` OpenPipeline pipeline in Dynatrace.

## Log Source Identification

These logs come from a **Fortinet FortiGate Next-Generation Firewall** (FortiOS).

- **Device**: `MRTDDCASRV01_FWT` (a FortiGate appliance, model F2K6 series)
- **Virtual Domain (VDOM)**: `VD_OCP` — a segmented firewall policy context, likely protecting an OpenShift/OCP cluster network
- **Syslog transport**: RFC 3164 (`<priority>` header), e.g. `<189>` → facility 23 (local7), severity 5 (notice)
- **Log format**: FortiOS structured key=value pairs appended after the syslog header
- **Pipeline**: `logs:pipeline_Fortiparser_8080` (ingested on port 8080)

### FortiGate Log Types

| `type` | `subtype` | Description |
|--------|-----------|-------------|
| `traffic` | `forward` | Network traffic forwarded between interfaces (most common) |
| `traffic` | `local` | Traffic to/from the FortiGate itself |
| `traffic` | `sniffer` | One-arm sniffer traffic |
| `event` | `system` | System events (config changes, HA, etc.) |
| `event` | `user` | User auth events |
| `utm` | `webfilter` | Web filter UTM events |
| `utm` | `ips` | IPS/IDS events |
| `utm` | `av` | Antivirus events |

## OpenPipeline Parser (DPL Pattern)

FortiGate logs are an unordered sequence of `key=value` pairs separated by spaces — exactly what the `KVP{}` (Key-Value Pairs) DPL matcher is designed for. This is far simpler and more robust than field-by-field patterns: it handles any field order, optional fields, and future FortiOS fields automatically.

### KVP-Based Parser — Recommended (Validated Against Live Data)

The `KVP{}` matcher captures all key=value pairs into a single `variant_object`. Use `fieldsFlatten` to promote all keys to top-level `fw_fields.<key>` columns accessible in downstream pipeline commands.

**How it works:**
- `LD ' '` skips the syslog RFC 3164 header (`<189>logver=... `) up to and including the first space before the KV sequence
- Everything after is a flat sequence of FortiOS `key=value` or `key="value"` pairs separated by spaces
- `KVP{}` iterates until it can no longer match, collecting all pairs into a `variant_object`
- `fieldsFlatten fw_fields` expands the object into `fw_fields.srcip`, `fw_fields.action`, etc.

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| filter contains(content, "type=\"traffic\"")
| parse content, "LD ' ' KVP{WORD:key '=' (('\"' LD:value '\"') | NSPACE:value) ' '?}:fw_fields"
| fieldsFlatten fw_fields
| fieldsAdd
    sent_bytes = toLong(fw_fields.sentbyte),
    rcvd_bytes = toLong(fw_fields.rcvdbyte),
    duration   = toLong(fw_fields.duration),
    dstport    = toLong(fw_fields.dstport),
    proto_name = if(fw_fields.proto == "6",  "TCP",
                 else: if(fw_fields.proto == "17", "UDP",
                 else: if(fw_fields.proto == "1",  "ICMP",
                 else: fw_fields.proto)))
```

> **Why KVP is better than field-by-field parsing:**
> - **Order-independent** — FortiOS field order can vary across firmware versions and log types
> - **Resilient** — unknown or new fields (e.g. `crscore`, `crlevel`, `policyname`) are silently captured without breaking the pattern
> - **Concise** — one pattern covers all FortiOS log types (traffic, event, utm, etc.)
> - **Future-proof** — new FortiOS fields appear automatically in `fw_fields` without any pattern changes

### KVP Pattern Breakdown

| Element | Purpose |
|---------|---------|
| `LD ' '` | Skips the syslog header up to the first space before the KV block |
| `WORD:key` | Matches any FortiOS key name (`[A-Za-z0-9_]+`) |
| `'\"' LD:value '\"'` | Captures quoted values like `devname="MRTDDCASRV01_FWT"` — strips the quotes |
| `NSPACE:value` | Captures unquoted values (no whitespace) like `srcip=10.82.136.14`, `proto=17` |
| `((...) \| NSPACE:value)` | Alternation: try quoted match first, fall back to unquoted |
| `' '?` | Optional trailing space — handles the last pair which has no separator |
| `:fw_fields` | Exports the full `variant_object` |
| `fieldsFlatten fw_fields` | Expands to `fw_fields.action`, `fw_fields.srcip`, etc. for use in `filter`, `summarize`, `fields` |

> **Important**: `NSPACE` (no-space) is the correct matcher for unquoted FortiOS values — not `WORD`. FortiOS values include hyphens, dots, and slashes (e.g. `date=2026-06-15`, `srcip=10.82.136.14`, `poluuid=3c76e29c-...`) which `WORD` won't match. `NSPACE` matches any non-whitespace sequence.

> **Type casting**: All `fw_fields.*` values are strings after KVP. Use `toLong()` for numeric comparisons and aggregations.

### Inspect Raw KVP Output

To see all captured fields from a single record (useful for debugging or discovering new field names):

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| limit 1
| parse content, "LD ' ' KVP{WORD:key '=' (('\"' LD:value '\"') | NSPACE:value) ' '?}:fw_fields"
| fields timestamp, fw_fields
```

## Key Field Reference

| Field | DPL Type | Description | Example |
|-------|----------|-------------|---------|
| `fw.devname` | string | FortiGate device hostname | `MRTDDCASRV01_FWT` |
| `fw.devid` | string | FortiGate serial number | `F2K61FTK21900863` |
| `fw.vd` | string | Virtual domain (VDOM) | `VD_OCP` |
| `fw.type` | string | Log type | `traffic` |
| `fw.subtype` | string | Log subtype | `forward` |
| `fw.level` | string | Severity level | `notice` |
| `fw.srcip` | IP | Source IP address | `10.82.136.14` |
| `fw.srcport` | long | Source port | `60370` |
| `fw.srcintf` | string | Source interface | `bond0.979` |
| `fw.srcintfrole` | string | Source interface role | `lan` |
| `fw.dstip` | IP | Destination IP address | `10.82.137.79` |
| `fw.dstport` | long | Destination port | `4789` |
| `fw.dstintf` | string | Destination interface | `bond0.978` |
| `fw.dstintfrole` | string | Destination interface role | `dmz` |
| `fw.srccountry` | string | Source GeoIP country | `Reserved` (RFC1918) |
| `fw.dstcountry` | string | Destination GeoIP country | `Reserved` (RFC1918) |
| `fw.proto` | long | IP protocol number (6=TCP, 17=UDP, 1=ICMP) | `17` |
| `fw.action` | string | Firewall action | `accept`, `deny`, `drop`, `reset` |
| `fw.policyid` | long | Firewall policy rule ID | `17` |
| `fw.service` | string | Matched service object | `udp_4789` |
| `fw.duration` | long | Session duration (seconds) | `326` |
| `fw.sentbyte` | long | Bytes sent (src→dst) | `58737` |
| `fw.rcvdbyte` | long | Bytes received (dst→src) | `0` |
| `fw.sentpkt` | long | Packets sent | `71` |
| `fw.rcvdpkt` | long | Packets received | `0` |
| `fw.sessionid` | long | Unique session identifier | `2390443731` |
| `fw.trandisp` | string | NAT translation disposition | `noop` (no NAT) |
| `fw.appcat` | string | Application category | `unscanned` |

## Core Workflows

All workflows use the shared KVP parse pattern. If fields were pre-extracted at ingestion via an OpenPipeline processor, replace the `parse` + `fieldsAdd` block with direct field references (e.g. `fw_fields["srcip"]` or promoted attribute names).

### Reusable Parse Block

All queries below use this pattern — shown once here for clarity:

```dql
| parse content, "LONG:syslog_pri '>' LD ' '
  KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcip    = fw_fields["srcip"],
    fw.dstip    = fw_fields["dstip"],
    fw.srcport  = toLong(fw_fields["srcport"]),
    fw.dstport  = toLong(fw_fields["dstport"]),
    fw.proto    = toLong(fw_fields["proto"]),
    fw.action   = fw_fields["action"],
    fw.policyid = toLong(fw_fields["policyid"]),
    fw.service  = fw_fields["service"],
    fw.duration = toLong(fw_fields["duration"]),
    fw.sentbyte = toLong(fw_fields["sentbyte"]),
    fw.rcvdbyte = toLong(fw_fields["rcvdbyte"]),
    fw.srcintf  = fw_fields["srcintf"],
    fw.dstintf  = fw_fields["dstintf"],
    fw.srcintfrole = fw_fields["srcintfrole"],
    fw.dstintfrole = fw_fields["dstintfrole"]
```

### 1. Traffic Overview — Top Flows by Volume

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcip    = fw_fields["srcip"],    fw.dstip    = fw_fields["dstip"],
    fw.dstport  = toLong(fw_fields["dstport"]),
    fw.proto    = toLong(fw_fields["proto"]),   fw.action   = fw_fields["action"],
    fw.sentbyte = toLong(fw_fields["sentbyte"]), fw.rcvdbyte = toLong(fw_fields["rcvdbyte"])
| summarize
    sessions    = count(),
    sent_bytes  = sum(fw.sentbyte),
    rcvd_bytes  = sum(fw.rcvdbyte),
    total_bytes = sum(fw.sentbyte) + sum(fw.rcvdbyte),
    by: {fw.srcip, fw.dstip, fw.dstport, fw.proto, fw.action}
| sort total_bytes desc
| limit 20
```

### 2. Denied / Blocked Traffic — Security Review

Pre-filtering with `contains()` before parsing reduces processing overhead on large datasets:

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| filter contains(content, "action=\"deny\"") or contains(content, "action=\"drop\"")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcip    = fw_fields["srcip"],    fw.dstip    = fw_fields["dstip"],
    fw.srcport  = toLong(fw_fields["srcport"]),
    fw.dstport  = toLong(fw_fields["dstport"]),
    fw.action   = fw_fields["action"],
    fw.policyid = toLong(fw_fields["policyid"]), fw.service  = fw_fields["service"]
| summarize
    block_count = count(),
    unique_src  = countDistinct(fw.srcip),
    by: {fw.dstip, fw.dstport, fw.service, fw.action, fw.policyid}
| sort block_count desc
| limit 20
```

### 3. Traffic by Protocol and Action

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.proto  = toLong(fw_fields["proto"]),
    fw.action = fw_fields["action"],
    protocol  = if(toLong(fw_fields["proto"]) == 6,  "TCP",
                else: if(toLong(fw_fields["proto"]) == 17, "UDP",
                else: if(toLong(fw_fields["proto"]) == 1,  "ICMP",
                else: toString(fw_fields["proto"]))))
| summarize count(), by: {protocol, fw.action}
| sort `count()` desc
```

### 4. Bandwidth Usage Over Time (Time Series)

```dql
fetch logs, from:now()-6h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.sentbyte = toLong(fw_fields["sentbyte"]),
    fw.rcvdbyte = toLong(fw_fields["rcvdbyte"])
| makeTimeseries
    sent_bytes = sum(fw.sentbyte),
    rcvd_bytes = sum(fw.rcvdbyte),
    sessions   = count(),
    interval: 5m
```

### 5. Top Talkers (Source IPs by Bandwidth)

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcip    = fw_fields["srcip"],
    fw.sentbyte = toLong(fw_fields["sentbyte"]),
    fw.rcvdbyte = toLong(fw_fields["rcvdbyte"])
| summarize
    sessions = count(),
    total_mb = (sum(fw.sentbyte) + sum(fw.rcvdbyte)) / 1048576,
    by: {fw.srcip}
| sort total_mb desc
| limit 10
```

### 6. Long-Running Sessions (Potential Data Exfiltration or Stale Connections)

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcip    = fw_fields["srcip"],    fw.dstip    = fw_fields["dstip"],
    fw.dstport  = toLong(fw_fields["dstport"]),
    fw.action   = fw_fields["action"],
    fw.duration = toLong(fw_fields["duration"]),
    fw.sentbyte = toLong(fw_fields["sentbyte"]), fw.rcvdbyte = toLong(fw_fields["rcvdbyte"])
| filter fw.duration > 300
| sort fw.duration desc
| fields timestamp, fw.srcip, fw.dstip, fw.dstport, fw.action, fw.duration, fw.sentbyte, fw.rcvdbyte
| limit 50
```

### 7. East-West Traffic Between VLANs (Interface-Based)

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.srcintf     = fw_fields["srcintf"],     fw.srcintfrole = fw_fields["srcintfrole"],
    fw.dstintf     = fw_fields["dstintf"],     fw.dstintfrole = fw_fields["dstintfrole"],
    fw.sentbyte    = toLong(fw_fields["sentbyte"]),
    fw.rcvdbyte    = toLong(fw_fields["rcvdbyte"])
| summarize
    sessions = count(),
    total_mb = (sum(fw.sentbyte) + sum(fw.rcvdbyte)) / 1048576,
    by: {fw.srcintf, fw.srcintfrole, fw.dstintf, fw.dstintfrole}
| sort total_mb desc
```

### 8. Policy Hit Analysis (Which Firewall Rules Are Used Most)

```dql
fetch logs, from:now()-24h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")
| parse content, "LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields"
| fieldsAdd
    fw.policyid = toLong(fw_fields["policyid"]),
    fw.service  = fw_fields["service"],
    fw.action   = fw_fields["action"]
| summarize
    hit_count = count(),
    by: {fw.policyid, fw.service, fw.action}
| sort hit_count desc
| limit 20
```

## About the Sample Log

```
<189>logver=704112878 timestamp=1781518755 devname="MRTDDCASRV01_FWT" devid="F2K61FTK21900863"
vd="VD_OCP" date=2026-06-15 time=12:19:15 eventtime=1781518754832792405 tz="+0200"
logid="0000000013" type="traffic" subtype="forward" level="notice"
srcip=10.82.136.14 srcport=60370 srcintf="bond0.979" srcintfrole="lan"
dstip=10.82.137.79 dstport=4789 dstintf="bond0.978" dstintfrole="dmz"
srccountry="Reserved" dstcountry="Reserved" sessionid=2390443731 proto=17
action="accept" policyid=17 policytype="policy" poluuid="3c76e29c-5eda-51ed-defb-101c0771ea50"
service="udp_4789" trandisp="noop" appcat="unscanned" duration=326
sentbyte=58737 rcvdbyte=0 sentpkt=71 rcvdpkt=0
```

**What this specific record tells us:**
- A UDP session (proto=17) from `10.82.136.14:60370` (LAN, `bond0.979`) to `10.82.137.79:4789` (DMZ, `bond0.978`)
- Port **4789** is **VXLAN** — this is overlay network tunnel traffic, consistent with an OpenShift/Kubernetes SDN
- Session lasted **326 seconds** (~5.4 minutes), sent **58 KB** outbound, nothing received
- Policy 17 **accepted** the flow with no NAT (`trandisp=noop`)
- Both IPs are RFC1918 private (country="Reserved") — purely internal east-west traffic

## OpenPipeline Configuration Notes

To enable field extraction at ingestion time (instead of at query time), configure these extraction rules in the OpenPipeline processor for `logs:pipeline_Fortiparser_8080`.

Using `KVP{}` in the processor means **all** FortiOS fields are pre-extracted as a `variant_object` at ingestion — no per-query parsing overhead, and new fields in future FortiOS versions are captured automatically.

### Processor Rule (JSON — KVP Extract Fields)

```json
{
  "type": "dpl",
  "enabled": true,
  "matcher": "isNotNull(content)",
  "sampleData": "<189>logver=704112878 timestamp=1781518755 devname=\"MRTDDCASRV01_FWT\" devid=\"F2K61FTK21900863\" vd=\"VD_OCP\" date=2026-06-15 time=12:19:15 eventtime=1781518754832792405 tz=\"+0200\" logid=\"0000000013\" type=\"traffic\" subtype=\"forward\" level=\"notice\" srcip=10.82.136.14 srcport=60370 srcintf=\"bond0.979\" srcintfrole=\"lan\" dstip=10.82.137.79 dstport=4789 dstintf=\"bond0.978\" dstintfrole=\"dmz\" srccountry=\"Reserved\" dstcountry=\"Reserved\" sessionid=2390443731 proto=17 action=\"accept\" policyid=17 policytype=\"policy\" poluuid=\"3c76e29c-5eda-51ed-defb-101c0771ea50\" service=\"udp_4789\" trandisp=\"noop\" appcat=\"unscanned\" duration=326 sentbyte=58737 rcvdbyte=0 sentpkt=71 rcvdpkt=0",
  "processorExpression": "PARSE(content, \"LONG:syslog_pri '>' LD ' ' KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields\")"
}
```

### Recommended Attribute Mappings (OpenPipeline → Semantic Conventions)

Map parsed fields to standard semantic conventions for better integration with other Dynatrace capabilities:

| Parsed Field | OpenPipeline Attribute | Purpose |
|---|---|---|
| `fw.srcip` | `network.source.ip` | Standard network telemetry |
| `fw.dstip` | `network.destination.ip` | Standard network telemetry |
| `fw.srcport` | `network.source.port` | Standard network telemetry |
| `fw.dstport` | `network.destination.port` | Standard network telemetry |
| `fw.proto` | `network.transport` | Convert to string: 6→tcp, 17→udp |
| `fw.action` | `event.outcome` | accept→success, deny/drop→failure |
| `fw.devname` | `observer.hostname` | Identifies the firewall sensor |
| `fw.vd` | `observer.name` | VDOM as logical observer |

## Best Practices

1. **Use KVP over field-by-field patterns** — `KVP{WORD:key '=' (DQS | WORD):value ' '?}:fw_fields` handles all FortiOS log types in one pattern, regardless of field order or optional fields
2. **Pre-filter before parsing** — Use `filter contains(content, "action=\"deny\"")` before `parse` to reduce parsing overhead. The `KVP{}` matcher still iterates all pairs; narrowing the dataset first pays off at scale
3. **Use the pipeline filter** — Always include `filter dt.openpipeline.pipelines == array("logs:pipeline_Fortiparser_8080")` to scope to FortiGate logs only
4. **Parse at ingestion when possible** — Configure the OpenPipeline KVP processor rule so `fw_fields` is pre-extracted. Queries then skip the `parse` step entirely and reference `fw_fields["key"]` directly
5. **Type-cast after KVP** — All `fw_fields` values are strings by default. Use `toLong()`, `toDouble()`, `toIp()` when you need numeric comparisons or aggregations (e.g. `sum(toLong(fw_fields["sentbyte"]))`)
6. **Timestamp alignment** — FortiGate `eventtime` is in nanoseconds. For precise correlation use `timestampFromUnixNanos(toLong(fw_fields["eventtime"]))` rather than the syslog timestamp
7. **Bytes vs packets** — Use `sentbyte`/`rcvdbyte` for bandwidth analysis; `sentpkt`/`rcvdpkt` for connection count estimation
8. **VXLAN port 4789** — Common in OCP/K8s environments. High volumes on dst port 4789 are normal SDN overlay traffic, not anomalous
9. **Reserved country** = RFC1918 private IP space — filter out for external threat intelligence queries

## Related Skills

- **dt-dql-essentials** — Required before writing any DQL queries
- **dt-obs-logs** — General log querying patterns and aggregations
- **dt-obs-kubernetes** — Correlate FortiGate VXLAN traffic with OCP pod/service topology
- **dt-obs-hosts** — Correlate with host-level metrics on firewall-adjacent hosts
