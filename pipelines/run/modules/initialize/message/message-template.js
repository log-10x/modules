// @loader: tenx

import {TenXTemplate, TenXEnv, TenXConsole, TenXUnit, TenXString} from '@tenx/tenx'
import {GroupTemplate} from '../group/group-template'

export class MessageUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return (config.unitName == "transform") && (TenXEnv.get("symbolMessageField")) && (!TenXEnv.get("quiet"));
    }
    
     constructor() { 
        TenXConsole.log("💬 Enriching TenXObjects with message field: '" + TenXEnv.get("symbolMessageField") + "'");
     }
}

export class MessageTemplate extends TenXTemplate {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("symbolMessageField");
    }

    constructor() {


        if ((this.groupSize > 1)  || 
            GroupTemplate.isGroup ||
            !TenXString.startsWith(this.get(TenXEnv.get("inputField")), TenXEnv.get("messageNegators"))) {

            var symbolSequence = this.symbolSequence(
                    TenXEnv.get("symbolContexts", "log,exec"),
                    TenXEnv.get("inputField"),
                    TenXEnv.get("symbolMaxLen", 0));

            var skeletonFromAny = false;

            if (!TenXString.includes(symbolSequence, "_")) {

                skeletonFromAny = true;

                symbolSequence = this.symbolSequence("any",
                    TenXEnv.get("inputField"),
                    TenXEnv.get("symbolMaxLen", 0));
            }

            TenXTemplate.setStatic(
                TenXEnv.get("symbolMessageField"), symbolSequence);

            // The hash enrichment is always assigned. `symbolMessageHashField` names
            // the field; when the user leaves it unset the field keeps its internal
            // name `tenx_hash`, so metric dimensions and the aggregation key are
            // unaffected. Setting the option is what puts the field on the wire back
            // to a coupled forwarder, see run/input/forwarder/config.yaml.
            //
            // The TenXEnv.get call is repeated rather than hoisted into a var:
            // setStatic's first argument must fold to a string literal at parse time,
            // and a var does not ("argument 1 'fieldName' must be a string literal").
            if (TenXEnv.get("symbolMessageHashField", "tenx_hash")) {
                TenXTemplate.setStatic(
                    TenXEnv.get("symbolMessageHashField", "tenx_hash"),
                    TenXString.hash(symbolSequence));
            }

            // The rendering hint: the message's shape with one marker per
            // identity token, so a consumer holding pattern + skeleton prints
            // the original log line without the engine ever shipping it (this
            // is what makes a pattern readable in a metrics-only deployment).
            // Opt-in by naming the field; unset computes and emits nothing.
            // The rendering hint MUST come from the same context branch that
            // produced the identity above. Asking the typed path for the
            // skeleton of an any-path identity yields two different
            // computations whose tokens do not line up, and the rendered line
            // drifts by a token (measured: 32% of events).
            if (TenXEnv.get("symbolSkeletonField") && skeletonFromAny) {
                TenXTemplate.setStatic(
                    TenXEnv.get("symbolSkeletonField"),
                    this.symbolSkeleton("any",
                        TenXEnv.get("inputField"),
                        TenXEnv.get("symbolMaxLen", 0)));
            }

            if (TenXEnv.get("symbolSkeletonField") && !skeletonFromAny) {
                TenXTemplate.setStatic(
                    TenXEnv.get("symbolSkeletonField"),
                    this.symbolSkeleton(
                        TenXEnv.get("symbolContexts", "log,exec"),
                        TenXEnv.get("inputField"),
                        TenXEnv.get("symbolMaxLen", 0)));
            }
        }
    }
}
