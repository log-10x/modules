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

            if (TenXEnv.get("symbolMessageHashField")) {
                TenXTemplate.setStatic(
                    TenXEnv.get("symbolMessageHashField"), TenXString.hash(symbolSequence));
            }
        }
    }
}
