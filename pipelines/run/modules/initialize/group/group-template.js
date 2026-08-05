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

        if (this.groupSize == 1) {

            var event = this.get(TenXEnv.get("inputField"));
            var groupHead = false;

            // timestamped templates are assumed to be a group head
            if (this.timestamped) {

                groupHead = true;

            } else if (TenXString.startsWith(event, TenXEnv.get("messageNegators"))) {

                // Continuation-shaped lines are not group heads, whatever
                // severity-shaped tokens they carry. Evidence ranking:
                // an own timestamp is near-conclusive head evidence (checked
                // above), a continuation indent/prefix is near-conclusive
                // NON-head evidence (checked here), and a severity token in
                // the text is weak head evidence (checked below) that any
                // line ABOUT severities defeats — e.g. the object-dump
                // fragment "  severityText: 'info'," was classified a head
                // because level inference read 'info' as its severity, which
                // orphaned every dump line as its own event. With this veto
                // those lines weld into their parent event instead: on the
                // otel demo corpus, unpatterned events drop 3,287 -> 517 and
                // per-line dump fragments consolidate into one event per dump.
                groupHead = false;

            } else if (TenXTemplate.getStatic(TenXEnv.get("levelField"))) {

                // templates with an assigned severity level are assumed to be a group head
                groupHead = true;

            } else if (TenXString.startsWith(event, TenXEnv.get("groupIndicators"))) {

                // instances starting with a group indicator term are assumed to be a group head
                // https://doc.log10x.com/run/transform/group/#groupindicators
                groupHead = true;

            }

            GroupTemplate.isGroup = groupHead;

        }
    }  
}
