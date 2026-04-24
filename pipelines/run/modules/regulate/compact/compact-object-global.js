// @loader: tenx

import { TenXObject, TenXEnv, TenXMath, TenXLog, TenXLookup, TenXConsole, TenXDate, TenXString } from '@tenx/tenx'

// Declarative, field-set keyed compaction predicate.
//
// Reads a lookup file where each line declares a compaction decision for a
// specific field-set value. Same identity semantics as the rate regulator's
// mute file, so users can target the same patterns the Reporter attributes
// cost to.
//
// Entry format (first row is the standard `key,value` CSV header):
//
//     <fieldSet>,<encode>:<untilEpochSec>[:<reason>]
//
// `encode` is "true" (compact via encode()) or "false" (preserve fullText).
//
// Example (with compactRegulatorFieldNames: [symbolMessage]):
//     payment_retry_gateway_timeout,true:1745856000:OPS-5123 spike mitigation
//     auth_audit_trail,false:1745856000:compliance — keep verbose
//
// Exposes a `shouldEncode` getter on every TenXObject via one of two
// sibling classes — exactly one loads based on whether the compact lookup
// file is configured. This split keeps shouldEncode resolvable in every
// deployment (forwarder stream.yaml Path 2 references it unconditionally)
// while letting the active class's body parse only when the lookup is
// actually registered — no parse-time name-resolution against a missing
// lookup.
//
// The forwarder output stream.yaml calls `shouldEncode` in a single ternary
// field expression: `output=shouldEncode() ? encode() : fullText`. One stream
// per output, per-event decision at serialization time. No field mutation —
// TenXObject fields are immutable after construction, so the routing lives
// in the stream expression, not on the event.

export class CompactInput extends TenXInput {

    static shouldLoad(config) {
       return TenXEnv.get("compactRegulatorLookupFile");
    }

    constructor() {

        if (!TenXEnv.get("quiet")) {
            TenXConsole.log("🗜️ Applying compaction predicate to: " + this.inputName + " using: " + TenXEnv.get("compactRegulatorLookupFile"));
        }

        if (!TenXEnv.get("compactRegulatorFieldNames")) {
            throw new Error("the 'compactRegulatorFieldNames' argument must be set to identify compact-lookup entries");
        }

        var lastModified = TenXLookup.load(TenXEnv.get("compactRegulatorLookupFile"), true);

        var compactRegulatorLookupRetain = TenXEnv.get("compactRegulatorLookupRetain", 300000);

        if (TenXDate.now() - lastModified > compactRegulatorLookupRetain) {
            if (!TenXEnv.get("quiet")) {
                TenXConsole.log("⚠️ Compact lookup file is stale, lastModified: {}, retainInterval: {}",
                    lastModified, compactRegulatorLookupRetain);
            }
            TenXLog.info("Compact lookup file is stale, lastModified: {}, retainInterval: {}",
                lastModified, compactRegulatorLookupRetain);
        }
    }
}

// Inactive variant — loads when compact lookup is NOT configured.
// Preserves pre-compact-module semantics: every event is eligible to encode
// when the forwarder's Path 2 fires (encodeObjects=true).
export class CompactObjectInactive extends TenXObject {

    static shouldLoad(config) {
       return !TenXEnv.get("compactRegulatorLookupFile");
    }

    get shouldEncode() {
        return this.isObject && !this.isDropped;
    }
}

// Active variant — loads when compact lookup IS configured. Per-event
// decision based on a field-set key lookup into the compact CSV.
export class CompactObjectActive extends TenXObject {

    static shouldLoad(config) {
       return TenXEnv.get("compactRegulatorLookupFile");
    }

    get shouldEncode() {

        if ((!this.isObject) || (this.isDropped)) return false;

        var defaultEncodeRaw = TenXEnv.get("compactRegulatorDefault", false);
        var defaultEncode = (defaultEncodeRaw == true) || (defaultEncodeRaw == "true");

        var fieldSetKey = this.joinFields("_", TenXEnv.get("compactRegulatorFieldNames"));
        if (!fieldSetKey) return defaultEncode;

        var entry = TenXLookup.get("compactRegulatorLookupFile", fieldSetKey);
        if (!entry) return defaultEncode;

        // Entry format: "<encode>:<untilEpochSec>[:<reason>]"
        var encode = TenXString.startsWith(entry, "true:");
        var parts = TenXString.split(entry, ":");
        var untilEpochSec = TenXMath.parseDouble(parts[1]);

        // Expired → self-heal to default.
        var nowSec = TenXDate.now() / 1000;
        if (nowSec >= untilEpochSec) return defaultEncode;

        return encode;
    }
}
