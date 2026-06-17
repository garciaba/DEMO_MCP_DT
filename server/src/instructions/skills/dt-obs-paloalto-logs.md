# Palo Alto Networks PAN-OS Log Analysis Skill

Query, parse, and analyze Palo Alto Networks PAN-OS firewall logs ingested via the `logs:pipeline_Paloalto_Parser_5290` OpenPipeline pipeline in Dynatrace.

## Log Source Identification

These logs come from **Palo Alto Networks Next-Generation Firewalls** running **PAN-OS 11.1.6-h3**, forwarded in **LEEF 2.0** (Log Event Extended Format) over syslog.

- **Devices observed**: `MRTMAEXCOMMFWP`, `MRTXDC1PUB01FWP`, `MRTXDC1PUB01FWP`, `AWSTRAFW01`
- **Syslog transport**: RFC 3164 (`<150>` header — facility 18 / local2, severity 6 / informational)
- **Log format**: LEEF 2.0 with `|` as the field separator in the extension block
- **Pipeline**: `logs:pipeline_Paloalto_Parser_5290` (ingested on port 5290)
- **Log categories in pipeline**: `TRAFFIC` only

### Log Format Structure

```
<150>Jun 15 15:24:28 <syslog_host> LEEF:2.0|<vendor>|<product>|<fw_version>|<action>|x7C|<key=value|key=value|...>
```

| Section | Example | Notes |
|---------|---------|-------|
| Syslog header | `<150>Jun 15 15:24:28 MRTDCA01PASM.seat.vwg` | RFC 3164 — priority + timestamp + relay host |
| LEEF version | `LEEF:2.0` | Always 2.0 for PAN-OS |
| Vendor | `Palo Alto Networks` | Fixed |
| Product | `PAN-OS Syslog Integration` | Fixed |
| FW version | `11.1.6-h3` | PAN-OS firmware version |
| Action | `allow` / `drop` / `deny` / `reset-both` | Top-level firewall decision |
| Separator | `x7C` | LEEF 2.0 custom separator declaration (0x7C = `\|`) |
| Extension | `cat=TRAFFIC\|src=10.x\|dst=...` | Key=value pairs separated by `\|` |

## DPL Parser (Validated Against Live Data)

### Two-Stage Approach

PAN-OS LEEF logs require two parse steps:
1. **Header parse** — split the 6-field LEEF header using `[^|]+` (non-pipe character class) as field matchers
2. **Extension parse** — apply `KVP{}` to the `key=value|key=value` extension block using `|` as the pair separator

### Complete Parser (Header + Extension)

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
```

After `fieldsFlatten`, all extension fields are available as `pa_fields.<FieldName>`. All values are strings — use `toLong()` / `toDouble()` for numeric operations.

### DPL Pattern Breakdown

| Element | Purpose |
|---------|---------|
| `LD 'LEEF:'` | Skip syslog header up to the `LEEF:` token |
| `[^|]+` | Match one or more non-pipe characters — safely captures header fields that contain spaces (e.g. `Palo Alto Networks`) |
| `'|'` | Literal pipe separator between LEEF header fields |
| `KVP{...}:pa_fields` | Capture all extension key=value pairs into a `variant_object` |
| `[^=|]+:key` | Key matcher: any chars except `=` and `|` — covers all PAN-OS field names |
| `[^|]*:value` | Value matcher: any chars except `|` (zero or more — handles empty values like `usrName=`) |
| `'|'?` | Optional trailing pipe — handles the last pair which has no terminator |
| `fieldsFlatten pa_fields` | Expands `pa_fields` variant_object into `pa_fields.<key>` top-level columns |

> **Key difference from FortiGate**: PAN-OS LEEF uses `|` as the KVP pair separator (not space), and values can be empty strings. The `[^|]*` (zero-or-more) matcher handles empty values like `usrName=|`, `SrcMac=|`, etc.

## Key Field Reference

### LEEF Header Fields (from header parse)

| Field | Description | Example |
|-------|-------------|---------|
| `leef_version` | LEEF format version | `2.0` |
| `leef_vendor` | Vendor name | `Palo Alto Networks` |
| `leef_product` | Product name | `PAN-OS Syslog Integration` |
| `leef_fw_version` | PAN-OS firmware version | `11.1.6-h3` |
| `leef_action` | Firewall decision | `allow`, `drop`, `deny`, `reset-both` |

### Extension Fields (from `pa_fields.*`)

| Field | Description | Example |
|-------|-------------|---------|
| `pa_fields.cat` | Log category | `TRAFFIC` |
| `pa_fields.DeviceName` | PAN-OS device hostname | `MRTMAEXCOMMFWP` |
| `pa_fields.VirtualSystem` | Virtual system (vsys) | `vsys1`, `vsys2` |
| `pa_fields.SerialNumber` | Device serial number | `013201003876` |
| `pa_fields.src` | Source IP | `10.202.2.233` |
| `pa_fields.dst` | Destination IP | `87.58.85.23` |
| `pa_fields.srcPort` | Source port | `60436` |
| `pa_fields.dstPort` | Destination port | `443` |
| `pa_fields.srcPostNAT` | Post-NAT source IP | `217.10.95.162` |
| `pa_fields.dstPostNAT` | Post-NAT destination IP | `87.58.85.23` |
| `pa_fields.srcPostNATPort` | Post-NAT source port | `3870` |
| `pa_fields.proto` | IP protocol | `tcp`, `udp`, `gre` |
| `pa_fields.Application` | App-ID detected application | `ssl`, `web-browsing`, `zscaler-internet-access` |
| `pa_fields.RuleName` | Matched security policy name | `SASE_ZSCALER-01` |
| `pa_fields.SourceZone` | Source security zone | `CBB_vINET` |
| `pa_fields.DestinationZone` | Destination security zone | `INTERNET_vINET` |
| `pa_fields.IngressInterface` | Ingress interface | `ethernet1/7.3442` |
| `pa_fields.EgressInterface` | Egress interface | `ethernet1/4.150` |
| `pa_fields.srcBytes` | Bytes sent (src→dst) | `454` |
| `pa_fields.dstBytes` | Bytes received (dst→src) | `70` |
| `pa_fields.totalBytes` | Total bytes | `524` |
| `pa_fields.srcPackets` | Packets sent | `3` |
| `pa_fields.dstPackets` | Packets received | `1` |
| `pa_fields.totalPackets` | Total packets | `4` |
| `pa_fields.SessionID` | Session identifier | `1307125` |
| `pa_fields.ElapsedTime` | Session duration (seconds) | `0` |
| `pa_fields.SessionEndReason` | Why session ended | `n/a`, `policy-deny`, `tcp-fin` |
| `pa_fields.URLCategory` | URL category | `computer-and-internet-info`, `any` |
| `pa_fields.Subtype` | Traffic subtype | `start`, `end`, `drop` |
| `pa_fields.ActionSource` | What triggered the action | `from-policy` |
| `pa_fields.devTime` | Device-side event timestamp | `Jun 15 2026 13:24:27 GMT` |
| `pa_fields.LogForwardingProfile` | Log forwarding profile name | `log_FP` |
| `pa_fields.vSrcName` | Virtual source name | `vINET-FW` |
| `pa_fields.RuleUUID` | Policy rule UUID | `9ab97962-6caf-48c7-a7c0-1d9049642ea5` |

## Core Workflows

All workflows share the same parse block — shown in full in the first workflow and abbreviated in subsequent ones.

### 1. Traffic Overview by Device and Action

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| fieldsAdd
    src_bytes = toLong(pa_fields.srcBytes),
    dst_bytes = toLong(pa_fields.dstBytes)
| summarize
    sessions  = count(),
    total_mb  = (sum(src_bytes) + sum(dst_bytes)) / 1048576,
    blocked   = countIf(leef_action == "drop" or leef_action == "deny"),
    by: {pa_fields.DeviceName, pa_fields.VirtualSystem, leef_action, pa_fields.proto}
| sort sessions desc
| limit 20
```

### 2. Blocked / Denied Traffic — Security Review

Pre-filtering on `leef_action` before parsing cuts processing cost significantly since the action is in the LEEF header (no KVP parsing needed for the filter):

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| filter contains(content, "|drop|") or contains(content, "|deny|")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| summarize
    block_count  = count(),
    unique_src   = countDistinct(pa_fields.src),
    by: {pa_fields.dst, pa_fields.dstPort, pa_fields.proto, pa_fields.RuleName, pa_fields.SessionEndReason, leef_action}
| sort block_count desc
| limit 20
```

### 3. Top Applications by Bandwidth

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| fieldsAdd
    src_bytes = toLong(pa_fields.srcBytes),
    dst_bytes = toLong(pa_fields.dstBytes)
| summarize
    sessions  = count(),
    total_mb  = (sum(src_bytes) + sum(dst_bytes)) / 1048576,
    by: {pa_fields.Application, pa_fields.proto, leef_action}
| sort total_mb desc
| limit 20
```

### 4. Bandwidth Over Time (Time Series)

```dql
fetch logs, from:now()-6h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| fieldsAdd
    src_bytes = toLong(pa_fields.srcBytes),
    dst_bytes = toLong(pa_fields.dstBytes)
| makeTimeseries
    sent_bytes  = sum(src_bytes),
    rcvd_bytes  = sum(dst_bytes),
    sessions    = count(),
    blocked     = countIf(leef_action == "drop" or leef_action == "deny"),
    interval: 5m
```

### 5. Top Talkers (Source IPs by Bandwidth)

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| fieldsAdd
    src_bytes = toLong(pa_fields.srcBytes),
    dst_bytes = toLong(pa_fields.dstBytes)
| summarize
    sessions = count(),
    total_mb = (sum(src_bytes) + sum(dst_bytes)) / 1048576,
    by: {pa_fields.src, pa_fields.VirtualSystem, pa_fields.DeviceName}
| sort total_mb desc
| limit 10
```

### 6. NAT Analysis — Identify Post-NAT Addresses

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| filter contains(content, "|allow|")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| filter pa_fields.srcPostNAT != "0.0.0.0"
| summarize
    sessions = count(),
    by: {pa_fields.src, pa_fields.srcPostNAT, pa_fields.VirtualSystem, pa_fields.DeviceName}
| sort sessions desc
| limit 20
```

### 7. Policy Hit Analysis — Top Rules by Hits

```dql
fetch logs, from:now()-24h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| summarize
    hits      = count(),
    by: {pa_fields.RuleName, pa_fields.DeviceName, pa_fields.VirtualSystem, leef_action}
| sort hits desc
| limit 20
```

### 8. Zone-to-Zone Traffic Matrix

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| fieldsAdd
    src_bytes = toLong(pa_fields.srcBytes),
    dst_bytes = toLong(pa_fields.dstBytes)
| summarize
    sessions = count(),
    total_mb = (sum(src_bytes) + sum(dst_bytes)) / 1048576,
    by: {pa_fields.SourceZone, pa_fields.DestinationZone, leef_action, pa_fields.DeviceName}
| sort sessions desc
```

### 9. Session End Reason Distribution

```dql
fetch logs, from:now()-1h
| filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")
| parse content, "LD 'LEEF:' [^|]+:leef_version '|' [^|]+:leef_vendor '|' [^|]+:leef_product '|' [^|]+:leef_fw_version '|' [^|]+:leef_action '|' [^|]+:leef_sep '|' KVP{[^=|]+:key '=' [^|]*:value '|'?}:pa_fields"
| fieldsFlatten pa_fields
| summarize count(), by: {pa_fields.SessionEndReason, leef_action}
| sort `count()` desc
```

## About the Log Format

### LEEF 2.0 vs FortiGate KV Format Comparison

| Aspect | PAN-OS LEEF 2.0 | FortiGate FortiOS |
|--------|-----------------|-------------------|
| Format | `LEEF:2.0\|vendor\|product\|version\|action\|sep\|key=value\|key=value` | `key="value" key=value ...` |
| Separator | `\|` (pipe) | ` ` (space) |
| Empty values | `key=\|` (empty string) | Field omitted if empty |
| Quoting | Never quoted | Mixed: quoted strings + bare values |
| Header | Structured 6-field LEEF prefix | Flat KV — no separate header |
| Action field | In LEEF header (field 5) | In KV block (`action=accept`) |

### KVP Pattern Differences

| | PAN-OS LEEF | FortiGate |
|--|-------------|-----------|
| Key matcher | `[^=\|]+` — exclude `=` and `\|` | `WORD` |
| Value matcher | `[^\|]*` — exclude `\|`, allow empty | `('\"' LD:value '\"') \| NSPACE` |
| Pair separator | `'\|'?` | `' '?` |
| Header skip | `[^|]+` character class per field | `LD ' '` skip to first space |

## Best Practices

1. **Pre-filter on `leef_action` before parsing** — The action (`allow`/`drop`/`deny`) is in the LEEF header, so `filter contains(content, "|drop|")` works without KVP parsing and cuts dataset size significantly
2. **Use `[^|]*` (zero-or-more) for values** — PAN-OS has many empty fields (`usrName=`, `SrcMac=`, etc.). Using `[^|]+` (one-or-more) would break on empty values
3. **Use the pipeline filter** — Always include `filter dt.openpipeline.pipelines == array("logs:pipeline_Paloalto_Parser_5290")` to scope to PAN-OS logs only
4. **Type-cast after fieldsFlatten** — All `pa_fields.*` values are strings. Use `toLong()` for `srcBytes`, `dstBytes`, `srcPort`, `dstPort`, etc. before numeric operations
5. **`leef_action` vs `pa_fields.Subtype`** — `leef_action` (header field 5) is the final firewall decision; `pa_fields.Subtype` is the traffic lifecycle stage (`start`, `end`, `drop`)
6. **NAT awareness** — `pa_fields.src`/`pa_fields.dst` are pre-NAT addresses; `pa_fields.srcPostNAT`/`pa_fields.dstPostNAT` are post-NAT. Filter `srcPostNAT != "0.0.0.0"` to find NATted flows
7. **App-ID field** — `pa_fields.Application` reflects PAN-OS App-ID classification (e.g. `ssl`, `web-browsing`, `zscaler-internet-access`), not just port/protocol. Use it for application-layer analysis
8. **Empty egress interface** — `pa_fields.EgressInterface` is empty for dropped sessions (packet never forwarded). Filter `pa_fields.EgressInterface != ""` to scope to forwarded traffic only

## Related Skills

- **dt-dql-essentials** — Required before writing any DQL queries
- **dt-obs-logs** — General log querying patterns and aggregations
- **dt-obs-fortigate-logs** — Equivalent skill for FortiGate firewall logs (same environment)
- **dt-obs-hosts** — Correlate firewall events with host-level metrics
