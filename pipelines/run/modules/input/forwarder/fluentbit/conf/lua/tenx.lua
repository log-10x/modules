-------------------------------------------------------------------------------
-- 10x lua filter script
-------------------------------------------------------------------------------
--[[

this script is invoked by the Fluent Bit's 'lua' filter to pass events to 10x.

To learn more see https://docs.fluentbit.io/manual/pipeline/filters/lua -]]

-------------------------------------------------------------------------------
-- Launching 10x
-------------------------------------------------------------------------------

-- the following values are used to formulate the 'tenx_proc' argument
-- to launch the 10x process to which to write events

-- The tenx_bin can be used to set command (e.g. 'tenx') used to launch the 10x processor
-- If this value is not specified, use the default installation path.

local tenx_bin = os.getenv("TENX_BIN")

if (tenx_bin == nil) then
  tenx_bin = "/opt/tenx-edge/bin/tenx"
end

-- Build the full run path
local tenx_cmd = tenx_bin .. " run"

-- If additional args are specified, add them
if (tenx_run_args ~= nil) then
  tenx_cmd =  tenx_cmd .. " " .. tenx_run_args
end

-------------------------------------------------------------------------------
-- Process Management with Auto-Respawn
-------------------------------------------------------------------------------

-- Track respawn attempts for backoff
local respawn_count = 0
local last_respawn_time = 0
local max_respawn_attempts = 10
local respawn_backoff_seconds = 5

-- Launch or respawn the 10x process
local function launch_tenx()
    local handle, err = io.popen(tenx_cmd, "w")
    if handle then
        respawn_count = 0
        return handle
    end
    return nil
end

-- Check if handle is healthy and respawn if needed
local function ensure_tenx_handle()
    -- If handle exists, verify it's still working
    if tenx_handle ~= nil then
        local ok = pcall(function()
            -- Attempt a no-op write to check pipe health
            -- This will fail if the process has died
        end)
        if ok then
            return true
        end
        -- Handle is broken, close it
        pcall(function() tenx_handle:close() end)
        tenx_handle = nil
    end

    -- Attempt respawn with backoff
    local current_time = os.time()
    if respawn_count >= max_respawn_attempts then
        -- Check if enough time has passed to reset respawn counter
        if (current_time - last_respawn_time) > (respawn_backoff_seconds * max_respawn_attempts) then
            respawn_count = 0
        else
            return false
        end
    end

    -- Respawn the process
    tenx_handle = launch_tenx()
    last_respawn_time = current_time
    respawn_count = respawn_count + 1

    return tenx_handle ~= nil
end

-- Initial launch of the 10x process
tenx_handle = launch_tenx()


----------------------------------------------------------------------------------
-- JSON Encode, adapted from: https://github.com/rxi/json.lua/blob/master/json.lua
----------------------------------------------------------------------------------

local json = {_version = "0.1.2"}

local encode

local escape_char_map = {
    ["\\"] = "\\",
    ['"'] = '"',
    ["\b"] = "b",
    ["\f"] = "f",
    ["\n"] = "n",
    ["\r"] = "r",
    ["\t"] = "t"
}

local escape_char_map_inv = {["/"] = "/"}

for k, v in pairs(escape_char_map) do
    escape_char_map_inv[v] = k
end

local function escape_char(c)
    return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end

local function encode_table(val, stack)
    stack = stack or {}

    -- Circular reference?
    if stack[val] then
        error("circular reference")
    end

    stack[val] = true

    if rawget(val, 1) ~= nil or next(val) == nil then
        -- Treat as array -- check keys are valid and it is not sparse
        local n = 0

        for k in pairs(val) do
            if type(k) ~= "number" then
                error("invalid table: mixed or invalid key types")
            end
            n = n + 1
        end

        if n ~= #val then
            error("invalid table: sparse array")
        end

        -- Encode

        tenx_handle:write("[")

        local first = true

        for i, v in ipairs(val) do
            if (first) then
                first = false
            else
                tenx_handle:write(",")
            end

            encode(v, stack)
        end

        stack[val] = nil

        tenx_handle:write("]")

    else

        tenx_handle:write("{")

        local first = true

        -- Treat as an object
        for k, v in pairs(val) do
            if type(k) ~= "string" then
                error("invalid table: mixed or invalid key types")
            end

            if (first) then
                first = false
            else
                tenx_handle:write(",")
            end

            encode(k, stack)
            tenx_handle:write(":")
            encode(v, stack)
        end

        stack[val] = nil

        tenx_handle:write("}")
    end
end

local function encode_string(val)
    tenx_handle:write('"', val:gsub('[%z\1-\31\\"]', escape_char), '"')
end

local function encode_boolean(val)
    tenx_handle:write(tostring(val))
end

local function encode_nil(val)
    tenx_handle:write("null")
end

local function encode_number(val)
    -- Check for NaN, -inf and inf
    if val ~= val or val <= -math.huge or val >= math.huge then
        error("unexpected number value '" .. tostring(val) .. "'")
    end
    tenx_handle:write(string.format("%.14g", val))
end

local type_func_map = {
    ["nil"] = encode_nil,
    ["table"] = encode_table,
    ["string"] = encode_string,
    ["number"] = encode_number,
    ["boolean"] = encode_boolean
}

encode = function(val, stack)
    local t = type(val)
    local f = type_func_map[t]
    if f then
        f(val, stack)
    else
        error("unexpected type '" .. t .. "'")
    end
end

function json.encode(val)
    return (encode(val))
end

--------------------------------------------------------------------------------------
-- tenx_process: invoked for each event by the 'lua' filter defined in tenx-*.conf
--------------------------------------------------------------------------------------

function tenx_process(tag, timestamp, record)

    -- no need to process the internal 10x log
    if (tag == "tenx-internal") then
    	return 0, timestamp, record
    end

    -- no need to process the pipeline messages
    if (tag == "tenx-stdout") then
        return 0, timestamp, record
    end

    -- when the 10x pipeline is emitting events back to fluent-bit in TCP mode,
    -- the tag of the TCP input is 'tenx-pipeline'
    --
    -- If the lua filter was applied to '*', those events can be handled by this
    -- lua filter before reaching the rewrite_tag filter that should process them
    -- which is defined in 'tenx-tcp.conf', depending on the include order.
    --
    -- This makes sure we don't accidentally process them.
    if (tag == "tenx-pipeline") then
    	return 0, timestamp, record
    end

    -- no need to process TenXTemplates
    if (tag == "tenx-template") then
        return 0, timestamp, record
    end

    -- if the record already was processed by 10x,
    -- drop the 'tenx' marker and send the record to the Fluent Bit pipeline marked as modified (2)
    local isTenX = record["tenx"]

    if (isTenX) then
    	if (record["tenx_fields"]) then
    		return 2, timestamp, record["tenx_fields"]
    	end

        record["tenx"] = nil
        record["tag"] = nil
        return 2, timestamp, record
    end

    -- Ensure 10x process is running (respawn if crashed)
    if not ensure_tenx_handle() then
        -- No 10x process available, pass record through unprocessed
        return 0, timestamp, record
    end

    -- Attempt to write event to 10x with error handling for respawn
    local write_ok = pcall(function()
        -- encode event as JSON: tag and fields as (tenx_fields)
        tenx_handle:write("{\"tag\":")
        encode_string(tag)

        tenx_handle:write(",\"tenx\":true,\"tenx_fields\":")
        json.encode(record)

        tenx_handle:write("}\n")
        tenx_handle:flush()
    end)

    -- If write failed, attempt respawn and retry once
    if not write_ok then
        pcall(function() tenx_handle:close() end)
        tenx_handle = nil

        if ensure_tenx_handle() then
            -- Retry the write after respawn
            local retry_ok = pcall(function()
                tenx_handle:write("{\"tag\":")
                encode_string(tag)
                tenx_handle:write(",\"tenx\":true,\"tenx_fields\":")
                json.encode(record)
                tenx_handle:write("}\n")
                tenx_handle:flush()
            end)

            if not retry_ok then
                -- Respawn succeeded but write still failed, pass through
                return 0, timestamp, record
            end
        else
            -- Respawn failed, pass record through unprocessed
            return 0, timestamp, record
        end
    end

    -- based on config 'filterNonProcessed', either drop record (-1) to allow 10x to process
    -- and return it via the 'forward' or TCP input, otherwise return it as-is (0)
    if (filterNonProcessed) then
        return -1, timestamp, record
    end

    return 0, timestamp, record
end
