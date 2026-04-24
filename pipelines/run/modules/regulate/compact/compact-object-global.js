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
// IMPORTANT: both CompactInput and CompactObject gate loading on
// `compactRegulatorLookupFile`. Without that gate, the engine's static
// analyzer resolves the TenXLookup.get("compactRegulatorLookupFile", ...)
// reference at init — and fails because no lookup with that name is loaded.
// The matching gate on the stream.yaml's writeObjects block ensures the
// ternary field expression is only analyzed when the class is loaded.

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

    // Gate class loading on lookup file presence. The engine's static
    // analyzer resolves every reachable statement in shouldEncode at init
    // time, including `TenXLookup.get("compactRegulatorLookupFile", ...)`.
    // That reference FAILS when no lookup named compactRegulatorLookupFile
    // is loaded. Blocking the whole class from loading when no file is set
    // avoids the issue — the stream.yaml's writeObjects block uses the
    // same gate, so the shouldEncode reference in the field expression is
    // also only analyzed when the class is loaded.
    static shouldLoad(config) {
       return TenXEnv.get("compactRegulatorLookupFile");
    }

    // Per-event compact decision. Pure — returns the bool, doesn't mutate
    // the event (fields are immutable after construction).
    //
    // Called from the forwarder output stream.yaml ternary:
    //     output=shouldEncode() ? encode() : fullText
    get shouldEncode() {

        if ((!this.isObject) || (this.isDropped)) return false;

        var defaultEncodeRaw = TenXEnv.get("compactRegulatorDefault", false);
        var defaultEncode = (defaultEncodeRaw == true) || (defaultEncodeRaw == "true");

        var fieldSetKey = this.joinFields("_", TenXEnv.get("compactRegulatorFieldNames"));
        if (!fieldSetKey) return defaultEncode;

        var entry = TenXLookup.get("compactRegulatorLookupFile", fieldSetKey);
        if (!entry) return defaultEncode;

        // TEMP DEBUG: bypass parts parsing to isolate
        return true;

        var parts = TenXString.split(entry, ":");
        var encode = parts[0] == "true";
        var untilEpochSec = TenXMath.parseDouble(parts[1]);

        // Expired → self-heal to default.
        var nowSec = TenXDate.now() / 1000;
        if (nowSec >= untilEpochSec) {
            if (TenXLog.isDebug()) {
                TenXLog.debug("compact entry expired. fieldSet={}, untilEpochSec={}, nowSec={}, falling back to default={}",
                    fieldSetKey, untilEpochSec, nowSec, defaultEncode);
            }
            return defaultEncode;
        }

        if (TenXLog.isDebug()) {
            TenXLog.debug("compact lookup hit. fieldSet={}, encode={}, untilEpochSec={}",
                fieldSetKey, encode, untilEpochSec);
        }
        return encode;
    }
}
