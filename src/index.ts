import regedit = require("regedit");
import * as path from "path";
import * as http from "http";
import * as fs from "fs";
import death = require("death");
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import * as yargs from "yargs";

import Plugin from "./plugin/plugin";

const RobloxStudioRegKey = "HKCU\\SOFTWARE\\Roblox\\RobloxStudio";

var defaultPort = 5462;

function FindStudioFolders(): Promise<{
    studioPath: string;
    pluginPath: string;
}> {
    return new Promise((resolve, reject) => {
        regedit.list(
            RobloxStudioRegKey,
            "A",
            (err: Error, result: any) => {
                if (err) {
                    reject(err);
                }

                var keyData = result[RobloxStudioRegKey];

                if (!keyData.exists) {
                    reject(
                        new Error("Could not find Roblox Studio installation")
                    );
                } else {
                    var contentFolder = keyData.values["ContentFolder"].value;
                    var pluginFolder =
                        keyData.values["rbxm_local_plugin_last_directory"]
                            .value ||
                        path.join(
                            process.env.APPDATA,
                            "../Local",
                            "Roblox",
                            "Plugins"
                        );
                    var studioPath = path.resolve(contentFolder, "../");
                    resolve({
                        studioPath: studioPath,
                        pluginPath: pluginFolder,
                    });
                }
            },
            1024 * 102400
        );
    });
}

(async function () {
    const argv = await yargs
        .option("placeid", {
            alias: "i",
            description: "Specify a placeID to publish to.",
            type: "number",
            requiresArg: true,
        })
        .option("port", {
            alias: "p",
            description: "Specify a port for the plugin webserver to run on.",
            type: "number",
        })
        .help()
        .alias("help", "h").argv;

    if (argv.port) {
        defaultPort = argv.port;
    }

    const studioFolders = await FindStudioFolders();
    const studioInstallationDirectory = path.normalize(
        studioFolders.studioPath
    );
    const pluginInstallationDirectory = path.normalize(
        studioFolders.pluginPath
    );

    var studioInstallationDirectoryExists =
        fs.existsSync(studioInstallationDirectory) &&
        fs.lstatSync(studioInstallationDirectory).isDirectory();
    var pluginInstallationDirectoryExists =
        fs.existsSync(pluginInstallationDirectory) &&
        fs.lstatSync(pluginInstallationDirectory).isDirectory();

    if (!studioInstallationDirectory || !studioInstallationDirectoryExists) {
        return console.error("Could not find Roblox Studio installation");
    } else if (
        !pluginInstallationDirectory ||
        !pluginInstallationDirectoryExists
    ) {
        return console.error("Could not find Roblox Studio plugin directory");
    }

    //"C:\Users\brypo\AppData\Local\Roblox Studio\RobloxStudioBeta.exe" -task EditPlace -placeId 7563381206
    const studioExecutablePath = path.resolve(
        studioInstallationDirectory,
        "RobloxStudioBeta.exe"
    );

    console.log("Roblox Studio was found in " + studioExecutablePath);
    console.log(
        "Roblox Studio plugin folder detected to be in " +
            pluginInstallationDirectory
    );

    var headerUUID = uuidv4();

    var fileChunkData: string;
    fileChunkData = JSON.stringify({
        ReturnHeader: headerUUID,
        RBXLXData: { Test: "This message is being sent from studio!" },
    });

    const plugin = new Plugin(
        defaultPort,
        headerUUID,
        pluginInstallationDirectory
    );
    var studioPID: number;

    const fileServer = http.createServer();

    death(() => {
        plugin.destroy();
        if (studioPID) {
            process.kill(studioPID, "SIGTERM");
        }
        fileServer.close();
    });

    fileServer.on("request", async (req, res) => {
        req.on("error", (err) => {
            console.error(err);
            // Handle error
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false }));
            return;
        });

        res.on("error", (err) => {
            console.error(err);
            // Handle error
        });

        var body: any;
        if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
                buffers.push(chunk);
            }

            body = JSON.parse(Buffer.concat(buffers).toString());
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        var url = req.url;
        var path = url.substring(1);

        if (path === "ping") {
            res.write(JSON.stringify({ success: true }));
            res.end();
        } else if (path === "request") {
            res.write(fileChunkData);
            res.end();
        } else if (path === "error") {
            // log error to console
            console.log(
                "\x1b[31m%s\x1b[0m",
                "[Roblox Studio | Error]: " + body.Error
            );
            // tell user about script error, then exit while deleting plugin
            console.log(
                "The Roblox Studio script errored during sync, exiting!"
            );
            if (studioPID) {
                process.kill(studioPID, "SIGTERM");
            }
            plugin.destroy();
            process.exit(0);
        } else if (path === "finished") {
            // log result to console in green
            console.log(
                "\x1b[32m%s\x1b[0m",
                "[Roblox Studio | Success]: " + body.ReturnMessage
            );
            // tell user about script finish, then exit while deleting plugin
            console.log("The Roblox Studio script ran successfully.");
            if (studioPID) {
                process.kill(studioPID, "SIGTERM");
            }
            plugin.destroy();
            process.exit(0);
        }
    });

    fileServer.listen(defaultPort, () => {
        console.log(
            "The plugin listener is listening on port " + defaultPort + "!"
        );
    });

    var childProc = execFile(studioExecutablePath, [
        "-task",
        "EditPlace",
        "-placeId",
        argv.placeid.toString(),
    ]);
    studioPID = childProc.pid;
})();
