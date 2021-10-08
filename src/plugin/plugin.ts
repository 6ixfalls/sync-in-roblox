import * as fs from "fs";

var pluginData = fs.readFileSync("./plugin/plugin_template.lua", "utf8");

export default class Plugin {
    fileLocation!: string;
    headerString: string;

    constructor(port: number, UUID: string, pluginDirectory: string) {
        this.headerString = UUID;
        pluginData = pluginData.replace("{{PORT}}", `"${port.toString()}"`);
        pluginData = pluginData.replace("{{HEADER}}", `"${this.headerString}"`);

        this.fileLocation = pluginDirectory + "\\sync_in_roblox_plugin.lua";
        fs.writeFileSync(this.fileLocation, pluginData);
    }

    public destroy() {
        console.log("Plugin file is being cleaned up.");
        fs.unlinkSync(this.fileLocation);
    }
}
