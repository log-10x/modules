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

            // a line whose first label (the word before its first ":  ") is a child
            // label continues the event above it, timestamp or not (PostgreSQL DETAIL:)
            var childLabel = false;
            var labelEnd = TenXString.indexOf(event, ":  ", 0);
            if (labelEnd > 0) {
                var label = TenXString.endsWith(TenXString.substring(event, 0, labelEnd), TenXEnv.get("groupChildLabels"));
                if (label) {
                    var labelStart = labelEnd - TenXString.length(label);
                    childLabel = (labelStart == 0) || TenXString.includes(" :]", TenXString.substring(event, labelStart - 1, labelStart));
                }
            }

            // a line that is one name=value pair, its name without a space and its
            // value without another '=', is a field of the record above it. A
            // severity word in its value names that field's value, not a new
            // record: the classic text of a Windows event writes each field on
            // its own line, and `OpCode=Info` or `Type=Warning` read as INFO or
            // WARN and cut the event in two
            var nameValueLine = false;
            var nameEnd = TenXString.indexOf(event, "=", 0);
            if (nameEnd > 0) {
                var name = TenXString.substring(event, 0, nameEnd);
                nameValueLine = (TenXString.indexOf(event, "=", nameEnd + 1) == -1) &&
                    (!TenXString.includes(name, " ")) && (!TenXString.includes(name, "\t"));
            }

            if (!TenXEnv.get("groupJoinLines", true)) {

                // every line, or every record a forwarder sends, heads its own
                // event: nothing joins the event above it
                // https://doc.log10x.com/run/initialize/group/#groupjoinlines
                groupHead = true;

            } else if (childLabel) {

                groupHead = false;

            } else if (this.timestamped) {

                // timestamped templates are assumed to be a group head
                groupHead = true;

            } else if (TenXString.startsWith(event, TenXEnv.get("messageNegators"))) {

                // a continuation-shaped line is not a group head, whatever
                // severity-shaped tokens it carries: an own timestamp (above)
                // is head evidence, a continuation indent or prefix is not,
                // and a severity word in the text (below) is weak evidence
                // that a line about severities ("  severityText: 'info',")
                // defeats, so dump lines weld into their parent event
                groupHead = false;

            } else if ((TenXTemplate.getStatic(TenXEnv.get("levelField"))) && (!nameValueLine)) {

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
