-- transform.lua
-- Transforms Fluent Bit records into EveryUp native format:
--   { "level": "error|warn|info", "message": "...", "metadata": {...} }

local function normalize_level(raw_level)
    raw_level = string.upper(tostring(raw_level or ""))

    if raw_level == "FATAL" or raw_level == "CRITICAL" or raw_level == "ERROR" or raw_level == "ERR" then
        return "error"
    elseif raw_level == "WARN" or raw_level == "WARNING" then
        return "warn"
    elseif raw_level == "INFO" or raw_level == "INFORMATION" or raw_level == "DEBUG" or raw_level == "TRACE" or raw_level == "VERBOSE" then
        return "info"
    end

    return nil
end

local function infer_level_from_message(message)
    local text = string.upper(tostring(message or ""))

    if string.match(text, "^%s*%[?FATAL%]?[%s:%-]") or
       string.match(text, "^%s*%[?CRITICAL%]?[%s:%-]") or
       string.match(text, "^%s*%[?ERROR%]?[%s:%-]") or
       string.match(text, "^%s*%[?ERR%]?[%s:%-]") then
        return "error"
    elseif string.match(text, "^%s*%[?WARN%]?[%s:%-]") or
           string.match(text, "^%s*%[?WARNING%]?[%s:%-]") then
        return "warn"
    elseif string.match(text, "^%s*%[?INFO%]?[%s:%-]") or
           string.match(text, "^%s*%[?DEBUG%]?[%s:%-]") or
           string.match(text, "^%s*%[?TRACE%]?[%s:%-]") then
        return "info"
    end

    return nil
end

local function infer_level(record, message)
    local raw_level = record["level"] or record["levelname"] or record["severity"] or
        record["logLevel"] or record["log_level"] or record["lvl"]

    local level = normalize_level(raw_level)
    if level then
        return level
    end

    level = infer_level_from_message(message)
    if level then
        return level
    end

    if record["stream"] == "stderr" then
        return "error"
    end

    return "info"
end

function transform(tag, timestamp, record)
    local entry = {}

    -- Extract message from common fields
    entry["message"] = record["message"] or record["msg"] or record["log"] or ""
    entry["level"] = infer_level(record, entry["message"])

    -- Collect remaining fields as metadata
    local metadata = {}
    local skip = {
        message = true,
        msg = true,
        log = true,
        level = true,
        levelname = true,
        severity = true,
        logLevel = true,
        log_level = true,
        lvl = true,
    }
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
