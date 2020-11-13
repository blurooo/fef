import path from 'path';
import fs from '../fs';
import rp from 'request-promise';
import VersionStyle from '../dep/version';
import Linker from '../linker';
import util from 'util';
import { exec } from 'child_process';
import { PluginInfo } from './plugin';
import config from '../config';
import { LATEST, DEFAULT_VERSION, UNKNOWN_VERSION } from '../utils/constant';

const execAsync = util.promisify(exec);

export class Git {
  private gitAccount: any;

  private checkTask: any = {};

  private isSSH = false;

  private readonly silent: boolean;

  constructor(silent: boolean) {
    this.silent = silent;
  }

  public async enablePlugin(pluginVer: string, dep?: boolean): Promise<PluginInfo> {
    let [plugin, ver] = pluginVer.split('@');
    let pluginFullName = plugin;
    if (!plugin.startsWith(config.pluginPrefix)) {
      pluginFullName = config.pluginPrefix + plugin;
    } else {
      plugin = plugin.substring(config.pluginPrefix.length);
    }
    if (!ver || ver === LATEST) {
      ver = LATEST;
    }
    ver = VersionStyle.toFull(ver);
    if (!VersionStyle.check(ver)) {
      return Promise.reject(`invalid version: ${pluginVer}`);
    }
    const pluginInfo = new PluginInfo(config.pluginRootDir, plugin, pluginFullName, ver, config.protocolFileName);
    if (this.checkTask[pluginInfo.pluginPath]) {
      return pluginInfo;
    } else {
      this.checkTask[pluginInfo.pluginPath] = 'init';
    }
    if (ver !== LATEST) {
      try {
        // 完成标志存在且非latest版本则不需要下载
        const doneFile = path.join(pluginInfo.pluginPath, config.fefDoneFile);
        await fs.access(doneFile, fs.constants.F_OK);
        return pluginInfo;
      } catch (e) {
      }
    }
    let url = await this.getRepoInfo(pluginFullName);
    if (!url) {
      return Promise.reject(`unknown pkg: ${pluginFullName}`);
    }
    url = await this.transformUrl(url);
    let checkTag = '';
    let previousPluginPath = '';
    if (ver == LATEST) {
      const [ currentTag, latestTag ] = await Promise.all([
        this.getCurrentTag(pluginInfo.pluginPath),
        this.getTag(url)
      ]);
      if (!latestTag) {
        return Promise.reject('no valid version found');
      }
      if (currentTag !== UNKNOWN_VERSION) {
        // 版本一致
        if (currentTag === latestTag) {
          return pluginInfo;
        }
        // 无效版本
        if (currentTag !== latestTag && VersionStyle.gt(currentTag, latestTag)) {
          return pluginInfo;
        }
        // 无更更新的场景
        const protocol = await pluginInfo.getProtocol();
        if (!protocol.autoUpdate) {
          return pluginInfo;
        }
        previousPluginPath = pluginInfo.getOtherPluginPath(pluginFullName, currentTag);
      }
      checkTag = latestTag;
      ver = LATEST;
    } else {
      const invalidVer = await this.getTag(url, ver);
      if (!invalidVer) {
        return Promise.reject(`unknown version:${url}@${ver}`);
      }
      ver = invalidVer;
      checkTag = ver;
    }
    pluginInfo.checkoutTag = checkTag;
    const pluginRealPath = pluginInfo.getPluginRealPath();
    try {
      await fs.access(pluginRealPath, fs.constants.F_OK);
      await fs.deleteDir(pluginRealPath);
    } catch (e) {
      try {
        this.silent || console.log(`download ${plugin}@${ver} from ${url}`);
        await this.clone(url, checkTag, pluginRealPath);
      } catch (e) {
        this.checkTask[pluginInfo.pluginPath] = e;
      }
    }
    if (ver === LATEST) {
      await fs.link(pluginRealPath, pluginInfo.pluginPath);
    }
    await this.enableDeps(pluginInfo);
    if (!dep) {
      await Promise.all(Object.keys(this.checkTask).map(async (pluginPath: string) => {
        try {
          await fs.access(path.join(pluginPath, config.fefDoneFile), fs.constants.F_OK);
        } catch (e) {
          return Promise.reject(`check fail, ${pluginPath}: ${this.checkTask[pluginPath]}`);
        }
      }));
    }
    // 确保非依赖
    if (previousPluginPath && !this.checkTask[previousPluginPath]) {
      fs.deleteDir(previousPluginPath).catch(e => {
        this.silent || console.log(`remove ${previousPluginPath} fail: ${e}`);
      });
    }
    return pluginInfo;
  }

  private async enableDeps(pluginInfo: PluginInfo) {
    const pluginPath = pluginInfo.getPluginRealPath();
    const binPath = path.join(pluginPath, '.bin');
    const libPath = path.join(pluginPath, '.lib');
    const protocol = await pluginInfo.getProtocol();
    const tasks = protocol.dep.plugin.map(plugin => this.enablePlugin(plugin, true).then(async (depPluginInfo) => {
      const linker = new Linker(config.execName);
      const command = `${depPluginInfo.pluginName}@${depPluginInfo.ver}`;
      const depProtocol = await depPluginInfo.getProtocol();
      if (depProtocol.langRuntime) {
        const commands = protocol.command.getCommands();
        return linker.registerCustom(binPath, libPath, commands, command);
      }
      return linker.register(binPath, libPath, command, depPluginInfo.pluginName);
    }));
    // 写入安装完成标志
    return Promise.all(tasks).then(() => {
      const doneFile = path.join(pluginPath, config.fefDoneFile);
      return fs.writeFile(doneFile, '', {
        flag: 'w',
        encoding: 'utf8',
      });
    });
  }

  private async getRepoInfo(packageName: string): Promise<string> {
    const options = {
      url: `${config.storeUrl}apply/getlist?name=${packageName}`,
      method: 'GET',
    };
    return rp(options).then((response: any) => {
      const data = JSON.parse(response);
      !this.gitAccount && (this.gitAccount = data?.account);
      return data?.data?.[0]?.repo;
    });
  }

  private async getTag(repoUrl: string, version?: string) {
    const { stdout } = await execAsync(`git ls-remote --tags --refs ${repoUrl}`, {
      windowsHide: true,
    });

    const tagListStr = stdout?.toString()?.trim();
    if (!tagListStr) {
      return;
    }

    const tagList = tagListStr.split('\n');
    let satisfiedMaxVersion: string | undefined;
    for (const tagStr of tagList) {
      const [, tagReference] = tagStr.split('\t');
      const tag = tagReference?.substring('refs/tags/'.length);
      if (!VersionStyle.check(tag)) {
        continue;
      }
      if (tag === version) {
        return tag;
      }
      if (version && !VersionStyle.satisfies(tag, version)) {
        continue;
      }
      if (!satisfiedMaxVersion || VersionStyle.gt(tag, satisfiedMaxVersion)) {
        satisfiedMaxVersion = tag;
      }
    }
    return satisfiedMaxVersion;
  }

  private clone(url: string, tag: string, pkgPath: string) {
    return execAsync(`git clone -b ${tag} --depth 1 ${url} ${pkgPath}`, {
      windowsHide: true,
    });
  }

  private async transformUrl(url: string, account?: any) {
    const hostname = this.getHostname(url);
    const isSSH = await this.isSupportSSH(`git@${hostname}`);
    if (isSSH) {
      if (/https?/.test(url)) {
        return url.replace(/https?:\/\//, 'git@').replace(/\//, ':');
      }
      return url;
    }
    let transformedUrl;
    if (/https?/.test(url)) {
      transformedUrl = url;
    } else {
      transformedUrl = url.replace(`git@${hostname}:`, `http://${hostname}/`);
    }
    if (account) {
      this.gitAccount = account;
    }
    if (this.gitAccount) {
      const { username, password } = this.gitAccount;
      return transformedUrl.replace(/http:\/\//, `http://${username}:${password}@`);
    }
    return transformedUrl;
  }

  private getHostname(url: string): string {
    if (/https?/.test(url)) {
      const match: any = url.match(/^http(s)?:\/\/(.*?)\//);
      return match[2];
    }
    const match: any = url.match(/@(.*):/);
    return match[1];
  }

  private async isSupportSSH(url: string) {
    if (this.isSSH) {
      return this.isSSH;
    }
    let stderr;
    try {
      const res: any = await execAsync(`ssh -vT ${url}`, { timeout: 1000, windowsHide: true });
      stderr = res?.stderr?.toString();
    } catch (err) {
      stderr = err?.stderr?.toString();
    }
    this.isSSH = /Authentication succeeded/.test(stderr);
    return this.isSSH;
  }

  private async getCurrentTag(
    repoPath: string
  ): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C ${repoPath} tag -l`, { windowsHide: true });
      let tags = stdout?.toString().trim().split('\n');
      tags = tags.filter(v => VersionStyle.check(v)).sort((a, b) => VersionStyle.gt(a, b) ? -1 : 1);
      return tags?.[0] || DEFAULT_VERSION;
    } catch (e) {
      return UNKNOWN_VERSION;
    }
  }

}
