import path from 'path';
import { Plugin } from '../schema/plugin';
import { parseYaml } from '../utils/yaml';

export class PluginInfo {
  pluginRootPath: string;
  pluginPath: string;
  pluginFullName: string;
  pluginName: string;
  checkoutTag: string | undefined;
  ver: string;
  protocolFile: string;
  private protocol: Plugin | undefined;

  constructor(
    pluginRootPath: string,
    plugin: string,
    pluginFullName: string,
    ver: string,
    protocolFileName: string,
  ) {
    this.pluginRootPath = pluginRootPath;
    this.pluginName = plugin;
    this.pluginFullName = pluginFullName;
    this.ver = ver;
    this.pluginPath = path.join(this.pluginRootPath, `${this.pluginFullName}@${this.ver}`);
    this.protocolFile = path.join(this.pluginPath, protocolFileName);
  }

  getPluginRealPath(): string {
    return path.join(this.pluginRootPath, `${this.pluginFullName}@${this.checkoutTag}`);
  }

  getOtherPluginPath(fullName: string, tag: string): string {
    return path.join(this.pluginRootPath, `${fullName}@${tag}`);
  }

  async getProtocol(): Promise<Plugin> {
    if (!this.protocol) {
      const protocol = await parseYaml(this.protocolFile);
      this.protocol = new Plugin(this.pluginPath, protocol);
    }
    return this.protocol;
  }
}
