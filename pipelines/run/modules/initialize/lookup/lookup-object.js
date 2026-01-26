// @loader: tenx

import {TenXInput, TenXLookup, TenXObject, TenXEnv, TenXUnit} from '@tenx/tenx'

export class LookupUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return (config.unitName == "transform") && (TenXEnv.get("lookupFile")) && (!TenXEnv.get("quiet"));
    }
    
     constructor() { 
        TenXConsole.log("📋 Enriching TenXObjects with lookup field: '" + TenXEnv.get("lookupValueField") + "'" + " from file: " + TenXEnv.get("lookupFile"));
     }
}

/**
 * Input constructors are designed to initialize specific resources at the start of 
 * pipeline execution. These include functions for loading.csv/.tsv lookup tables via {@link TenXLookup.load},
 * connecting to GeoIP DB files {@link TenXLookup.loadGeoIPDB()} to allow for geo-referencing,
 * validating startups args via {@link TenXInput.test} and more. 
 * the 'lookupEnabled' argument is set, apply to all inputs, otherwise to none.
 */
export class LookupInput extends TenXInput {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("lookupFile");
    }

    constructor() {
        TenXLookup.load(TenXEnv.get("lookupFile"), true); 
    }
}

/**
 * Object constructors initialize tenxObjects structured from input events.
 * This can be used to enrich instances with calculated fields that combine intrinsic, extracted and reflected fields
 * with configuration values using {@link TenXEnv.get()}, increase atomic counters {@link TenXCounter.inc()},
 * or filter instances from the pipeline using {@link TenXObject.drop()}.
 */
export class LookupSummary extends TenXSummary {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("lookupFile");
    }

    /** 
     *  This constructor dynamically assigns the lookupValueField with the result of a {@link TenXLookup.get()} for the value of LookupKeyField. 
    */
    constructor() {    

        this.set(                               
            TenXEnv.get("lookupValueField"),             // set the target 'lookupValueField' field into this
            TenXLookup.get(                              // query the 'lookupFile' table 
                TenXEnv.get("lookupFile"), 
                this.get(TenXEnv.get("lookupKeyField")), // get the 'lookupKeyField' from this to use as the key
                TenXEnv.get("lookupValueColumn")         // select the 'lookupValueColumn' value if specified
            )
        );
    }
}
