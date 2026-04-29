-- 10x 'report' lua config --

-- this script loaded by tenx-report.conf to configure the 10x sub-process and event processing

-- Record processing

	-- When 'filterNonProcessed' is true, records not processed by the 10x proc
	-- are filtered to allow 10x to process them before they move forward in the Fluent Bit pipeline.
	-- into the Fluentb Bit pipeline with a 'tenx=true' value that marks them as processed.

	-- If set to false, send events to 10x and move them forward in the Fluent Bit pipeline.
	-- This is helpful if 10x aggregates events while raw events are shipped out.

	-- In the 10x 'report' configuration, 10x is a passive observer — it reads,
	-- aggregates, and publishes metrics, but does NOT write events back. The
	-- raw events stay on the Fluent Bit pipeline and ship to the original
	-- destination(s) unchanged. So this is false.

	filterNonProcessed = false


-- Launching 10x

	-- the following values are used to formulate the 'tenx_proc' argument
	-- to launch the 10x process to which to write events

	-- Define 10x arguments for running in 'report' mode (reducer with read-only enabled).
	-- The reducer wrapper is the same as regulate — only `reducerReadOnly true` flips
	-- the gating in the generic forward output module so the return socket is never
	-- bound or connected. Aggregators still publish TenXSummary metrics.
	tenx_run_args = "@run/input/forwarder/fluentbit/regulate/config.yaml @apps/reducer reducerReadOnly true"

	-- get the path of this config script
	configPath = assert(debug.getinfo(1).source:match("@?(.*[/\\])"))

	-- evaluate the 10x executor script path
	scriptPath = configPath .. "./tenx.lua"

	-- run the 10x script
	dofile(scriptPath)
