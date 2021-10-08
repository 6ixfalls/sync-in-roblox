-- selene: allow(undefined_variable)
---@diagnostic disable-next-line: undefined-global
local ServerPort = {{PORT}}
-- selene: allow(undefined_variable)
---@diagnostic disable-next-line: undefined-global
local ReturnHeader = {{HEADER}}

local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")

local Succ, Resp = pcall(HttpService.RequestAsync, HttpService, {
    Url = "http://localhost:" .. ServerPort .. "/ping",
    Method = "GET"
})

if not Succ or Resp.StatusCode ~= 200 then
    error([[!! Please delete the sync_in_roblox_plugin.lua file in your Roblox Studio plugins directory! This message is to inform you that a leftover plugin file from sync-in-roblox is still in Roblox Studio. !!
        If this error came during run-in-roblox execution, check your console for more details.]], 0)
    return
end

function SyncFiles()
    local Success, ServerDataResponse = pcall(HttpService.RequestAsync, HttpService, {
        Url = "localhost:" .. ServerPort .. "/request",
        Method = "GET",
    })
    
    if not Success or ServerDataResponse.StatusCode ~= 200 then
        return error(ServerDataResponse)
    end

    local ResponseData = HttpService:JSONDecode(ServerDataResponse.Body)
    local LocalReturnHeader = ResponseData.ReturnHeader

    if LocalReturnHeader ~= ReturnHeader then
        return error("Return header mismatch")
    end

    local RbxlxData = ResponseData.RBXLXData
    return RbxlxData.Test
end

local log
log = LogService.MessageOut:Connect(function(message, messageType)
    if messageType == Enum.MessageType.MessageError then
        log:Disconnect()
        HttpService:RequestAsync({
            Url = "localhost:" .. ServerPort .. "/error",
            Method = "POST",
            Body = HttpService:JSONEncode({Error = message})
        })
    end
end)

local succ, message = xpcall(SyncFiles, debug.traceback)

if not succ then
    log:Disconnect()
    HttpService:RequestAsync({
        Url = "localhost:" .. ServerPort .. "/error",
        Method = "POST",
        Body = HttpService:JSONEncode({Error = message})
    })
end

task.wait(4)
log:Disconnect()

HttpService:RequestAsync({
    Url = "localhost:" .. ServerPort .. "/finished",
    Method = "POST",
    Body = HttpService:JSONEncode({ReturnMessage = message})
})