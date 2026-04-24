// @loader: tenx

import { TenXObject, TenXEnv, TenXMath, TenXLookup, TenXConsole, TenXDate, TenXString } from '@tenx/tenx'

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
// Exposes a `shouldEncode` getter on every TenXObject. Returns:
//   - No entry for the event's field-set          → `compactRegulatorDefault` (env)
//   - Entry exists but untilEpochSec has passed   → `compactRegulatorDefault` (self-heal)
//   - Otherwise                                   → entry's <encode> value
//
// Both classes gate on compactRegulatorLookupFile. When that env isn't set,
// neither class loads — and the forwarder stream.yaml's compact-lookup path
// (the only place that references `shouldEncode`) is disabled by its own
// writeObjects gate on the same flag. No dangling references, no parse
// failures, no engine changes required.

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
        }
    }
}

export class CompactObject extends TenXObject {

    // Gate on the same flag as CompactInput. CompactInput's constructor runs
    // first (top-to-bottom file order) so TenXLookup.load has already
    // registered the lookup by the time shouldEncode's body is parsed —
    // no parse-time name-resolution failure.
    static shouldLoad(config) {
       return TenXEnv.get("compactRegulatorLookupFile");
    }

    // Per-event compact decision. Pure — returns the bool, doesn't mutate
    // the event (fields are immutable after construction).
    //
    // Called from the forwarder output stream.yaml's compact-lookup path:
    //     encoded=shouldEncode() ? encode() : fullText
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
