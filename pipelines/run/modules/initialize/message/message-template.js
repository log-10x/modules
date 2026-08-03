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

            if (!TenXString.includes(symbolSequence, "_")) {

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
        }
    }
}
