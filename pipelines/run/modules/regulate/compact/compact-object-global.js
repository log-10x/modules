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
// IMPORTANT: CompactInput ALWAYS loads and always registers the
// `compactRegulatorLookupFile` lookup — either the user's configured
// file or a shipped empty default. This makes TenXLookup.get() in
// shouldEncode safe to call regardless of user config. When the user
// hasn't configured a file, the lookup is effectively empty → get()
// returns null for every key → shouldEncode falls through to the
// no-entry branch (below).

export class CompactInput extends TenXInput {

    static shouldLoad(config) {
       return true;
    }

    constructor() {

        var userFile = TenXEnv.get("compactRegulatorLookupFile");

        // Resolve the file to load: user's override or the empty default.
        var file = userFile;
        if (TenXString.length(userFile) == 0) {
            file = TenXEnv.path("run/modules/regulate/compact/compact-lookup-default.csv");
        }

        if (TenXString.length(userFile) > 0 && !TenXEnv.get("quiet")) {
            TenXConsole.log("🗜️ Applying compaction predicate to: " + this.inputName + " using: " + userFile);
        }

        var lastModified = TenXLookup.load(file, true);

        var compactRegulatorLookupRetain = TenXEnv.get("compactRegulatorLookupRetain", 300000);

        if (TenXString.length(userFile) > 0 && TenXDate.now() - lastModified > compactRegulatorLookupRetain) {
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

    // Always load so the shouldEncode getter is safe to call from the
    // forwarder output stream even when the lookup file isn't set.
    // shouldEncode early-returns before any TenXLookup.get call if the
    // compactRegulatorLookupFile env is empty — so the static analyzer
    // still sees the lookup name reference as reachable, but at runtime
    // it's never executed unless lookupFile is actually set.
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

        // The tenx DSL does NOT short-circuit on Return() inside If()
        // — all statements in this function execute regardless. So every
        // TenXLookup.get() reachable here must be wrapped in a conditional
        // that short-circuits its BODY, not its flow. Result: all real
        // compact logic is nested inside one top-level If that only
        // evaluates its body when the lookup file is actually configured.
        //
        // When the lookup file is NOT set, this function returns true —
        // preserving the legacy encode-all semantics for forwarder streams
        // that unconditionally gate only on <fwd>EncodeObjects.
        if (TenXString.length(TenXEnv.get("compactRegulatorLookupFile")) > 0) {

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

        return true;
    }
}
