import path from 'path';
import { Plugin } from '../schema/plugin';
import { parseYaml } from "../utils/yaml";

export class PluginInfo {

    pluginRootPath: string;
    pluginPath: string;
    pluginName: string;
    checkoutTag: string | undefined;
    ver: string;
    protocolFile: string;
    private protocol: Plugin | undefined;

    constructor(pluginRootPath: string,
                plugin: string,
                ver: string,
                protocolFileName: string) {
        this.pluginRootPath = pluginRootPath;
        this.pluginName = plugin;
        this.ver = ver;
        this.pluginPath = path.join(this.pluginRootPath, `${this.pluginName}@${this.ver}`);
        this.protocolFile = path.join(this.pluginPath, protocolFileName);
    }

    getPluginRealPath(): string {
        return path.join(this.pluginRootPath, `${this.pluginName}@${this.checkoutTag}`);
    }

    async getProtocol(): Promise<Plugin> {
        if (!this.protocol) {
            const protocol = await parseYaml(this.protocolFile);
            this.protocol = new Plugin(this.pluginPath, protocol);
        }
        return this.protocol;
    }

}