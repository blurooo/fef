import { Command } from './command';
import { Dependencies } from './dependencies';
import { platformType } from './base';

export class Plugin {
  public path: string;

  public desc: string;

  public dep: Dependencies;

  public command: Command;

  public autoUpdate = true;

  public test: Command;

  public preInstall: Command;

  public postInstall: Command;

  public preRun: Command;

  public postRun: Command;

  public preUpgrade: Command;

  public postUpgrade: Command;

  public preUninstall: Command;

  public postUninstall: Command;

  public usage: any;

  // 是否属于语言运行时，语言运行时不需要经过feflow代理执行
  public langRuntime: boolean = false;

  constructor(pluginPath: string, config: any) {
    if (!platformType) {
      throw `current operating system [${platformType}] is not supported`;
    }
    this.path = pluginPath;
    this.desc = config?.['desc'];
    this.dep = new Dependencies(config?.dep);
    this.command = new Command(this.path, config?.command);
    this.autoUpdate = config?.['auto-update'] === false ? false : true;
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
    this.langRuntime = config?.['lang-runtime'] || false;
  }

  public async check() {
    await this.dep.check();
    this.command.check();
  }
}
