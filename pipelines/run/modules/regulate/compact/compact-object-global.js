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
// Exposes a `shouldEncode` getter on every TenXObject. Returns:
//   - No entry for the event's field-set          → `compactRegulatorDefault` (env)
//   - Entry exists but untilEpochSec has passed   → `compactRegulatorDefault` (self-heal)
//   - Otherwise                                   → entry's <encode> value
//
// The forwarder output stream.yaml calls `shouldEncode` in a single ternary
// field expression: `output=shouldEncode() ? encode() : fullText`. One stream
// per output, per-event decision at serialization time. No field mutation —
// TenXObject fields are immutable after construction, so the routing lives
// in the stream expression, not on the event.
//
// shouldEncode's reference to TenXLookup.get("compactRegulatorLookupFile", ...)
// is parse-safe — the 2-arg form defers lookup-name resolution until first
// call, and returns NO_VALUE at runtime when the named lookup isn't
// registered. CompactObject therefore loads unconditionally; shouldEncode's
// "compact inactive" early-return (first statement) short-circuits the
// TenXLookup call for deployments that aren't using the compact module.

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

export class CompactObject extends TenXObject {

    // Always load — shouldEncode is safe to parse and call even when no
    // lookup is registered, thanks to TenXLookup.getOrNull's lazy binding.
    static shouldLoad(config) {
       return true;
    }

    // Per-event compact decision. Pure — returns the bool, doesn't mutate
    // the event (fields are immutable after construction).
    //
    // Called from the forwarder output stream.yaml ternary:
    //     output=shouldEncode() ? encode() : fullText
    get shouldEncode() {

        if ((!this.isObject) || (this.isDropped)) return false;

        // "Compact inactive" path: when the lookup file isn't configured,
        // return true so the forwarder stream ternary emits encode() —
        // matching pre-compact-module semantics. Checking the env here at
        // per-event time is reliable (runtime TenXEnv.get returns "" for
        // unset); the init-time truthiness quirk that affected stream-level
        // gates doesn't apply inside a function body.
        if (TenXString.length(TenXEnv.get("compactRegulatorLookupFile")) == 0) return true;

        var defaultEncodeRaw = TenXEnv.get("compactRegulatorDefault", false);
        var defaultEncode = (defaultEncodeRaw == true) || (defaultEncodeRaw == "true");

        var fieldSetKey = this.joinFields("_", TenXEnv.get("compactRegulatorFieldNames"));
        if (!fieldSetKey) return defaultEncode;

        // TenXLookup.get with two args defers lookup-name resolution until
        // first invoke, so this reference compiles whether or not any compact
        // lookup is registered. At runtime it returns NO_VALUE when the lookup
        // isn't registered — the "compact inactive" early-return above makes
        // this path unreachable in the no-config case.
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
