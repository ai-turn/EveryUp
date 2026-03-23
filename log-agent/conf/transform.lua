-- transform.lua
-- Transforms Fluent Bit records into EveryUp native format:
--   { "level": "error|warn|info", "message": "...", "metadata": {...} }

function transform(tag, timestamp, record)
    local entry = {}

    -- Extract message from common fields
    entry["message"] = record["message"] or record["msg"] or record["log"] or ""

    -- Extract and normalize level
    local raw_level = record["level"] or record["levelname"] or record["severity"] or ""
    raw_level = string.upper(raw_level)

    if raw_level == "FATAL" or raw_level == "CRITICAL" or raw_level == "ERROR" or raw_level == "ERR" then
        entry["level"] = "error"
    elseif raw_level == "WARN" or raw_level == "WARNING" then
        entry["level"] = "warn"
    elseif raw_level == "INFO" or raw_level == "INFORMATION" or raw_level == "DEBUG" or raw_level == "TRACE" then
        entry["level"] = "info"
    else
        entry["level"] = "error"
    end

    -- Collect remaining fields as metadata
    local metadata = {}
    local skip = { message = true, msg = true, log = true, level = true, levelname = true, severity = true }
    for k, v in pairs(record) do
        if not skip[k] then
            metadata[k] = v
        end
    end
    if next(metadata) then
        entry["metadata"] = metadata
    end

    -- If no message found, serialize entire record as message
    if entry["message"] == "" then
        local parts = {}
        for k, v in pairs(record) do
            parts[#parts + 1] = k .. "=" .. tostring(v)
        end
        entry["message"] = table.concat(parts, " ")
    end

    return 1, timestamp, entry
end
