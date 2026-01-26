// @loader: tenx

import {TenXTemplate, TenXEnv, TenXConsole, TenXUnit} from '@tenx/tenx'
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

        if (GroupTemplate.isStandalone) {

            TenXTemplate.setStatic(
                TenXEnv.get("symbolMessageField"),
                this.symbolSequence(
                    TenXEnv.get("symbolContexts", "log,exec"),
                    TenXEnv.get("inputField"),
                    TenXEnv.get("symbolMaxLen", 0))
            );
        }
    }
}
