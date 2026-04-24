// @loader: tenx

import { TenXObject, TenXEnv, TenXLookup, TenXConsole, TenXDate, TenXString } from '@tenx/tenx'

// Declarative, field-set keyed compaction predicate.
//
// Reads a lookup file where each row declares a compaction decision for a
// specific field-set value. Same identity semantics as the rate regulator's
// mute file, so users can target the same patterns the Reporter attributes
// cost to.
//
// Entry format (standard CSV with `key,value` header):
//
//     <fieldSet>,<true|false>
//
// `true`  → compact via encode()
// `false` → preserve fullText
//
// Example (with compactRegulatorFieldNames: [symbolMessage]):
//     payment_retry_gateway_timeout,true
//     auth_audit_trail,false
//
// For time-bounded overrides, users remove the entry (e.g. via GitOps PR) to
// fall back to compactRegulatorDefault. An earlier design embedded an
// `untilEpochSec` in the value string (`true:1745856000:reason`), but the
// tenx DSL doesn't support local-array access — `parts[1]` translates to a
// field lookup that returns empty. Keeping the format to a single bare value
// sidesteps that quirk and matches the rate regulator's mute-file shape.
//
// Exposes a `shouldEncode` getter on every TenXObject (when loaded) that
// returns:
//   - No entry for the event's field-set → `compactRegulatorDefault` (env)
//   - Entry is "true"                    → true
//   - Entry is anything else             → false

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

        TenXLookup.load(TenXEnv.get("compactRegulatorLookupFile"), true);
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

        return TenXString.startsWith(entry, "true");
    }
}
