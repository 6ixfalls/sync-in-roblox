import regedit = require("regedit");
import path = require("path");

const RobloxStudioRegKey = "HKCU\\SOFTWARE\\Roblox\\RobloxStudio";

function FindStudioFolders(): Promise<{studioPath: string, pluginPath: string}> {
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
                    var pluginFolder = keyData.values["rbxm_local_plugin_last_directory"].value || path.join(process.env.APPDATA, "../Local", "Roblox", "Plugins");
                    var studioPath = path.resolve(contentFolder, "../");
                    resolve({studioPath: studioPath, pluginPath: pluginFolder});
                }
            },
            1024 * 102400
        );
    });
}

(async function () {
    const studioFolders = await FindStudioFolders();
    const studioInstallationDirectory = studioFolders.studioPath;
    const pluginInstallationDirectory = studioFolders.pluginPath;

    if (!studioInstallationDirectory) {
        return console.error("Could not find Roblox Studio installation");
    } else if (!pluginInstallationDirectory) {
        return console.error("Could not find Roblox Studio plugin directory");
    }
    
    //"C:\Users\brypo\AppData\Local\Roblox Studio\RobloxStudioBeta.exe" -task EditPlace -placeId 7563381206
    const studioExecutablePath = path.resolve(studioInstallationDirectory, "RobloxStudioBeta.exe");

    console.log(studioExecutablePath);
    console.log(pluginInstallationDirectory);
})();
