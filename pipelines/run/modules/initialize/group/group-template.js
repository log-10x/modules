// @loader: tenx

import {TenXEnv, TenXString, TenXTemplate, TenXConsole, TenXUnit} from '@tenx/tenx'
import {LevelTemplate} from '../level/level-template'

export class GroupUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return !TenXEnv.get("quiet") && (config.unitName == "transform");
    }
    
     constructor() { 
        TenXConsole.log("🔲 Consolidating multi-line events into logical TenXObject groups");
     }
}

// this class applies a heuristic to calculate the static isGroup indicating whether instances of this template
// represent the first event in a logical event group (e.g., stack trace)
export class GroupTemplate extends TenXTemplate {

    // this constructor is invoked once per tenXTemplate instance
    constructor() {

        var event = this.get(TenXEnv.get("inputField"));
        var isGroup = false;

        // timestamped templates are assumed to be a group head
        if (this.timestamped) {

            isGroup = true;

        } else if (TenXTemplate.getStatic(TenXEnv.get("levelField"))) {

            // templates with an assigned severity level are assumed to be a group head
            isGroup = true;

        } else {

            // instances starting with a group indicator term are assumed to be a group head
            // https://doc.log10x.com/run/transform/group/#groupindicators
            isGroup = TenXString.startsWith(event, TenXEnv.get("groupIndicators"));
        }

        GroupTemplate.isGroup = isGroup;

        if (isGroup || !TenXString.startsWith(event, TenXEnv.get("groupNegators"))) {            
            GroupTemplate.isStandalone = true;
        }
    }  
}
