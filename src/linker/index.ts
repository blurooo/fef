import os from 'os';
import path from 'path';
import fs from '../fs';

/**
 * link your code to system commands
 */
export default class Linker {
  
  private readonly currentOs: NodeJS.Platform;

  private readonly startCommand: string;

  private fileMode = 0o744;

  constructor(startCommand: string) {
    this.currentOs = os.platform();
    this.startCommand = startCommand;
  }

  /**
   *
   * @param binPath
   * @param libPath
   * @param command it could be checkstyle or checkstyle@v0.0.5
   * @param name    always checkstyle, use command when it does not exist
   */
  async register(binPath: string, libPath: string, command: string, name?: string) {
    if (this.currentOs === 'win32') {
      return this.linkToWin32(binPath, command, name);
    }
    return this.linkToUnixLike(binPath, libPath, command, name);
  }

  async remove(binPath: string, libPath: string, name: string) {
    if (this.currentOs === 'win32') {
      return this.removeOnWin32(binPath, name);
    }
    return this.removeOnUnixLike(binPath, libPath, name);
  }

  private removeOnWin32(binPath: string, name: string) {
    const cmdFile = this.cmdFile(binPath, name);
    return fs.unlink(cmdFile);
  }

  private async removeOnUnixLike(binPath: string, libPath: string, name: string) {
    const commandLink = path.join(binPath, name);
    const shellFile = this.shellFile(libPath, name);
    return Promise.all([
        fs.unlink(commandLink),
      fs.unlink(shellFile)
    ]);
  }

  private async linkToWin32(binPath: string, command: string, name?: string) {
    const file = this.cmdFile(binPath, name || command);
    await this.enableDir(binPath);
    const template = this.cmdTemplate(command);
    return this.writeExecFile(file, template);
  }

  private async linkToUnixLike(
    binPath: string,
    libPath: string,
    command: string,
    name?: string
  ) {
    await this.enableDir(binPath, libPath);
    const file = this.shellFile(libPath, name || command);
    const template = this.shellTemplate(command);
    const commandLink = path.join(binPath, name || command);
    await this.writeExecFile(file, template);
    return this.link(file, commandLink);
  }

  private async link(source: string, target: string) {
    try {
      await fs.unlink(target);
    } catch (e) {}
    return fs.symlink(source, target);
  }

  private writeExecFile(file: string, content: string) {
    return fs.writeFile(file, content, {
      mode: this.fileMode,
      flag: 'w',
      encoding: 'utf8'
    });
  }

  private shellTemplate(command: string): string {
    return `#!/bin/sh\n${this.startCommand} ${command} $@`;
  }

  private cmdTemplate(command: string): string {
    return `@echo off\n${this.startCommand} ${command} %*`;
  }

  private shellFile(libPath: string, name: string): string {
    return path.join(libPath, `${name}.sh`);
  }

  private cmdFile(binPath: string, name: string): string {
    return path.join(binPath, `${name}.cmd`);
  }

  private async enableDir(...dirs: string[]) {
    if (!dirs) {
      return;
    }
    return Promise.all(dirs.map(async dir => {
      try {
        await fs.access(dir, fs.constants.F_OK);
      } catch (e) {
        return fs.mkdir(dir, { recursive: true });
      }
    }));
  }
}
