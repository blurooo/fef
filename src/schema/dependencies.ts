import { arch, platformType } from './base';
import { lookpath } from 'lookpath';
import { toArray } from '../utils/array';

export class Dependencies {
  os: string[];

  command: string[];

  plugin: string[];

  constructor(dep: any) {
    this.os = toArray(dep?.os);
    this.command = toArray(dep?.command);
    this.plugin = toArray(dep?.plugin);
  }

  public async check() {
    this.checkOs();
    await this.checkCommand();
  }

  private checkOs() {
    if (this.os.length === 0) {
      return;
    }
    const i = this.os.findIndex(cur => cur === platformType || cur === `${platformType}.${arch}`);
    if (i === -1) {
      throw `the plugin does not support the ${platformType}.${arch} operating system`;
    }
  }

  private async checkCommand() {
    for (const command of this.command) {
      try {
        await lookpath(command);
      } catch (e) {
        throw `${command} command does not exist in the system, please check before installing this plugin`;
      }
    }
  }
}
