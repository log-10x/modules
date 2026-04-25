-- 10x 'optimize' lua config --

-- this script loaded by tenx-optimize.conf to configure the 10x sub-process and event processing

-- Record processing

	-- When 'filterNonProcessed' is true, records not processed by the 10x proc
	-- are filtered to allow 10x to process them before they move forward in the Fluent Bit pipeline.
	-- into the Fluentb Bit pipeline with a 'tenx=true' value that marks them as processed.

	-- If set to false, send events to 10x and move them forward in the Fluent Bit pipeline.
	-- This is helpful if 10x aggregates events while raw events are shipped out.

	-- In the 10x 'optimize' configuration, events are handled, possibly dropped,
	-- and surviving events are losslessly compacted by the 10x pipeline, so this is true

	filterNonProcessed = true


-- Launching 10x

	-- the following values are used to formulate the 'tenx_proc' argument
	-- to launch the 10x process to which to write events

	-- Define 10x arguments for running in 'optimize' mode (reducer with optimization enabled)
	tenx_run_args = "@run/input/forwarder/fluentbit/regulate/config.yaml __SAVE_APPS_REDUCER__ reducerOptimize true"

	-- get the path of this config script
	configPath = assert(debug.getinfo(1).source:match("@?(.*[/\\])"))

	-- evaluate the 10x executor script path
	scriptPath = configPath .. "./tenx.lua"

	-- run the 10x script
	dofile(scriptPath)
