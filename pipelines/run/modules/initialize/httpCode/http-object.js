// @loader: tenx

import { TenXEnv, TenXMath, TenXString, TenXTemplate, TenXObject, TenXUnit } from '@tenx/tenx'
import { GroupTemplate } from '../group/group-template'

export class HttpCodeUnit extends TenXUnit {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return (config.unitName == "transform") && (TenXEnv.get("httpCodeField")) && (!TenXEnv.get("quiet"));
    }
    
     constructor() { 
        TenXConsole.log("🌐 Enriching TenXObjects with HTTP code field: '" + TenXEnv.get("httpCodeField") + "'");
     }
}

export class HttpCodeTemplate extends TenXTemplate {

    // only load this class if the 'httpCodeField' env var is set
    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("httpCodeField");
    }

    // This constructor is invoked by the engine once for each unique tenXTemplate discovered
    // at runtime based on log event structures
    constructor() {

        // only extract HTTP codes from standalone events (e.g., do not look for HTTP codes in stack trace lines)
        // To learn more see https://doc.log10x.com/run/initialize/group
        if (!GroupTemplate.isStandalone) {
            return;
        }

        // make sure the template contains HTTP status code indicators (e.g., GET, HTTP)
        // To learn more see https://doc.log10x.com/run/transform/structure/#members
        if (!TenXString.includes(this.template, TenXEnv.get("httpCodeKeywords"))) {
            return;
        }

        // search for a token contained in the list of allowed HTTP codes  (e.g., 200, 404)
        var token = this.findToken("variable", TenXEnv.get("httpCodeValidValues"));

        if (!token) {
            return;
        }

        // check if the subsequent token does not preclude the candidate (e.g., preclude '404#')
        if (TenXString.includes(TenXEnv.get("httpCodePrecludersAfter"), this.token(token + 1))) {
            return;
        }

        // check if the preceding token does not preclude the candidate (e.g., preclude '?404')

        // Retrieve the previous token for precluder checks, improving code readability and reuse.
        var prevToken = this.token(token - 1); 
        
        // Compute if the previous token is a precluder, used in conditional logic below.
        var precluderBefore = TenXString.includes(TenXEnv.get("httpCodePrecludersBefore"), prevToken); 

        // explicitly make sure that we preclude candidates preceded by ':' or ' :',
        // UNLESS they are preceeded by a keyword or by '":" or '": ' to accommodate JSON fields (e.g., "code":200 or "code": 200).
        var isColonPattern = false;
        var checkOffset = 0;

        if (prevToken == ":") { // Check if previous token is exactly ":", setting up for colon pattern handling.
            
            isColonPattern = true;
            checkOffset = 2; // Offset for check in "key":code (check at token-2).
       
        } else if (prevToken == " " && this.token(token - 2) == ":") { // Check for space followed by colon, handling "key": code.
            
            isColonPattern = true;
            checkOffset = 3; // Offset for check in "key": code (check at token-3).
        }

        if (isColonPattern) { // If colon pattern detected, perform check.

            var suspect = this.token(token - checkOffset);

            if (suspect != "\"") {
                if (!TenXString.includes(TenXEnv.get("httpCodeKeywords"), suspect)) {
                    return; // Exit if failed the check
                }
            }

        } else if (precluderBefore) { // Else, if not colon pattern but still a precluder, preclude the candidate.
            return; // Exit for other precluders.
        }

        // assign the token to a static variable for all instances of this template
        HttpCodeTemplate.httpToken = token;
    }
}

export class HttpCodeObject extends TenXObject {

    // only load this class if the 'httpCodeField' env var is set
    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("httpCodeField");
    }

    // Invoked by the engine for each log event matching the template, 
    // using shared state (e.g., token position) set by HttpCodeTemplate 
    // to extract and assign the HTTP status code to the target 'httpCodeField' field.
    constructor() {

        var httpToken = HttpCodeTemplate.httpToken;

        if (httpToken) {

            // make sure for the current instance the token points to a valid number
            var httpCodeNum = TenXMath.parseInt(this.token(httpToken));

            if (httpCodeNum) {
                this.set(TenXEnv.get("httpCodeField"), httpCodeNum);
            } 
        }
    }
}
