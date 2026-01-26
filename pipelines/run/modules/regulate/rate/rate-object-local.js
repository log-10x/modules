// @loader: tenx

import { TenXObject, TenXEnv, TenXCounter, TenXMap, TenXMath, TenXLog, TenXConsole } from '@tenx/tenx'

export class LocalRegulatorInput extends TenXInput {

    // only load class if a global lookup file is not available
    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return !TenXEnv.get("rateRegulatorLookupFile");
    }

    constructor() {

        if (!TenXEnv.get("quiet")) {
            TenXConsole.log("🚦 Applying local rate regulator to: " + this.inputName);
        }

        if (!TenXEnv.get("levelField")) {
            throw new Error("the rate regulator module requires 'level' enrichment: https://doc.log10x.com/run/initialize/level/");
        }

        var resetIntervalMs = TenXEnv.get("rateRegulatorResetIntervalMs", 300000);

        if (!(resetIntervalMs >= 60000)) {
            throw new Error("the 'rateRegulatorResetIntervalMs' argument must be at least 60000 (1 minute), received: " + resetIntervalMs);
        }

        var minSampleRate = TenXEnv.get("rateRegulatorMinRetentionThreshold", 0.01);

        if (!(minSampleRate >= 0.01)) {
            throw new Error("the 'rateRegulatorLookupRetain' argument must be greater than  0.01, received: " + minSampleRate);
        }
    }
}

export class LocalRegulatorObject extends TenXObject {

    get shouldRetainEventWithoutLookup() {

        if ((!this.isObject) || (this.isDropped)) return true;

        var ingestionCostPerGB = TenXEnv.get("rateRegulatorIngestionCostPerGB", 1.5);
        var maxSharePerFieldSet = TenXEnv.get("rateRegulatorMaxSharePerFieldSet", 0.2);
        var budgetPerHour = TenXEnv.get("rateRegulatorBudgetPerHour", 1);

        // Calculate event cost based on byte size and ingestion cost per GB
        var utf8Size = this.utf8Size();
        var eventCost = utf8Size * ingestionCostPerGB / 1e9;

        if (TenXLog.isDebug()) {
            TenXLog.debug("utf8Size: {}, eventCost: {}", utf8Size, eventCost);
        }

        var retentionThreshold = 1;
        var localFieldSetSuffix = this.joinFields("_", TenXEnv.get("rateRegulatorFieldNames"));

        var resetIntervalMs = TenXEnv.get("rateRegulatorResetIntervalMs", 300000); // 5min default

        // Track spending per field set (e.g., per event type identified by symbolMessage)
        // fieldSetSpend = -1 indicates no field set tracking (fieldNames not configured, or event lacks values for them)
        var fieldSetSpend = -1;

        if (localFieldSetSuffix) {
            // Increment field set counter and get value before increment
            // Counter resets every resetIntervalMs, tracking spend per field set
            fieldSetSpend = TenXCounter.getAndInc("LocalRegulator_" + localFieldSetSuffix, eventCost, resetIntervalMs);
        }

        // Track global spending across all events
        // Counter resets every resetIntervalMs, tracking total spend in current window
        var totalSpend = TenXCounter.getAndInc("LocalRegulator_global_cost_total", eventCost, resetIntervalMs);

        // Always retain the first event in a window (for both global and field set counters)
        // This ensures we never drop the very first event, which helps establish baseline metrics
        if ((totalSpend == 0) || (fieldSetSpend == 0)) {
            return true;
        }

        // Calculate projected spending if we retain this event
        // This accounts for the current event cost to prevent overspending
        var projectedGlobalSpend = totalSpend + eventCost;
        var budgetPerWindow = ((budgetPerHour * resetIntervalMs) / 3600000);

        var globalBudgetUtilization = TenXMath.min(projectedSpend / budgetPerWindow, 1);

        // Probability-based throttling: inversely proportional to remaining budget
        // retentionThreshold represents the threshold above which we drop events
        // At 0% utilization → retentionThreshold = 1.0 → never drop (random() > 1.0 never true)
        // At 100% utilization → retentionThreshold = 0.0 → always drop (random() > 0.0 always true)
        retentionThreshold = 1 - globalBudgetUtilization;

        // Apply field set budget limit if possible
        // Prevents any single field set from consuming more than maxSharePerFieldSet of total budget
        var fieldSetBudgetUtilization = -1; // -1 indicates field set tracking not used
        
        if (fieldSetSpend > 0) {
            var projectedFieldSetSpend = fieldSetSpend + eventCost;
            var fieldSetBudgetPerWindow = budgetPerWindow * maxSharePerFieldSet;

            fieldSetBudgetUtilization = TenXMath.min(projectedFieldSetSpend / fieldSetBudgetPerWindow, 1);

            // Use the more restrictive (lower) retention threshold
            // This ensures we throttle if EITHER global or field set budget is exceeded
            var fieldSetRetentionThreshold = 1 - fieldSetBudgetUtilization;
            retentionThreshold = TenXMath.min(retentionThreshold, fieldSetRetentionThreshold);
        }

        // Apply minimum retention threshold to ensure critical events are always retained
        // Boost multiplier only applies to the minimum threshold, not the entire threshold
        // This prevents boost values < 1.0 from reducing retention when under budget
        var minRetentionThreshold = TenXEnv.get("rateRegulatorMinRetentionThreshold", 0.1);
        var boostMap = TenXMap.fromEntries(TenXEnv.get("rateRegulatorLevelBoost"));
        var level = this.get(TenXEnv.get("levelField"));
        var boost = TenXMap.get(boostMap, level, 1);
        
        // Ensure retentionThreshold never falls below minimum retention threshold (adjusted by boost)
        // Boost only affects the minimum floor: higher severity events get higher minimum retention
        // The calculated threshold (based on budget) is unaffected by boost
        retentionThreshold = TenXMath.max(retentionThreshold, minRetentionThreshold * boost);

        // Probabilistic drop decision
        // retentionThreshold is the threshold: drop when random() > retentionThreshold
        // Higher retentionThreshold → lower drop rate → more retention
        if (TenXMath.random() > retentionThreshold) {
            this.drop();

            if (TenXLog.isDebug()) {
                TenXLog.debug("drop by cost (local). fieldSetSuffix={}, totalSpend={}, budgetPerWindow={}, globalBudgetUtilization={}, fieldSetBudgetUtilization={}, retentionThreshold={}, boost={}, eventCost={}",
                    localFieldSetSuffix, totalSpend, budgetPerWindow, globalBudgetUtilization, fieldSetBudgetUtilization, retentionThreshold, boost, eventCost);
            }
        } else {
            if (TenXLog.isDebug()) {
                TenXLog.debug("retained (local). fieldSetSuffix={}, totalSpend={}, budgetPerWindow={}, globalBudgetUtilization={}, retentionThreshold={}, boost={}, eventCost={}", 
                    localFieldSetSuffix, totalSpend, budgetPerWindow, globalBudgetUtilization, retentionThreshold, boost, eventCost);
            }
        }

        return true;
    }
}
