import { Command } from './command';
import { Dependencies } from './dependencies';
import { platformType } from './base';

export class Plugin {
  path: string;

  desc: string;

  dep: Dependencies;

  command: Command;

  autoUpdate = true;

  test: Command;

  preInstall: Command;

  postInstall: Command;

  preRun: Command;

  postRun: Command;

  preUpgrade: Command;

  postUpgrade: Command;

  preUninstall: Command;

  postUninstall: Command;

  usage: any;

  constructor(pluginPath: string, config: any) {
    if (!platformType) {
      throw `current operating system [${platformType}] is not supported`;
    }
    this.path = pluginPath;
    this.desc = config?.['desc'];
    this.dep = new Dependencies(config?.dep);
    this.command = new Command(this.path, config?.command);
    this.autoUpdate = config?.['auto-update'] || false;
    this.test = new Command(this.path, config?.test);
    this.preInstall = new Command(this.path, config?.['pre-install']);
    this.postInstall = new Command(this.path, config?.['post-install']);
    this.preRun = new Command(this.path, config?.['pre-run']);
    this.postRun = new Command(this.path, config?.['post-run']);
    this.preUpgrade = new Command(this.path, config?.['pre-upgrade']);
    this.postUpgrade = new Command(this.path, config?.['post-upgrade']);
    this.preUninstall = new Command(this.path, config?.['pre-uninstall']);
    this.postUninstall = new Command(this.path, config?.['post-uninstall']);
    this.usage = config?.['usage'];
  }

  async check() {
    await this.dep.check();
    this.command.check();
  }
}
