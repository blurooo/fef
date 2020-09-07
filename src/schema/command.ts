import { arch, platformType } from './base';
import { toArray } from '../utils/array';
import execa from 'execa';
import { execSync } from 'child_process';
import path from 'path';

const valRegexp = new RegExp('\\${var:.*?}', 'ig');

function getVal(symbol: string): string {
  return symbol.substring('${var:'.length, symbol.length - 1);
}

type globalVal = {
  pd: string;
};

export class Command {
  private val: { [index: string]: string } = {} as globalVal;

  private commands: string[] = [];

  private readonly binPath: string = '';

  constructor(pluginPath: string, command: any) {
    this.val.pd = pluginPath;
    this.binPath = path.join(pluginPath, '.bin');
    const osArchCommands = command?.[`${platformType}.${arch}`];
    const osCommands = command?.[platformType];
    const defaultCommands = command?.default;
    if (osArchCommands) {
      this.commands = toArray(osArchCommands);
    } else if (osCommands) {
      this.commands = toArray(osCommands);
    } else if (defaultCommands) {
      this.commands = toArray(defaultCommands);
    }
  }

  getCommands(): string[] {
    return this.commands.map((c) => {
      if (!c || typeof c !== 'string') {
        throw `invalid command: [${c}]`;
      }
      return c.replace(valRegexp, (match) => {
        const v = getVal(match);
        if (this.val[v] !== undefined) {
          return this.val[v];
        }
        throw `global variable [${v}] not currently supported`;
      });
    });
  }

  injectEnv() {
    // 注入依赖path
    process.env.PATH = `${this.binPath}${path.delimiter}${process.env.PATH}`;
    process.env.FEF_PLUGIN_PATH = this.val.pd;
  }

  run(...args: string[]) {
    this.injectEnv();
    const commands = this.getCommands();
    for (let command of commands) {
      if (args && args.length > 0) {
        command = `${command} ${args.join(' ')}`;
      }
      // todo 使用exec可以避开shell参数解析的问题
      // 例如 lizard -x "node_modules/*"
      // 使用execSync，会将node_modules/*解析成 node_modules/.bin node_modules/@lodash ...
      // 需要改成 lizard -x "node_modules/\*"
      // 但是execa则可以使用 lizard -x "node_modules/*"（不支持lizard -x "node_modules/\*"）
      // 目前先兼容旧模式，等待feflow和actions/fef运行时对齐，再统一切换为execa
      // execa.commandSync(command, {
      //   stdio: 'inherit',
      //   env: process.env,
      // });
      execSync(command, {
        stdio: 'inherit',
        env: process.env,
      });
    }
  }

  // exception not thrown
  runLess() {
    try {
      this.run();
    } catch (e) {
      return;
    }
  }

  check() {
    if (this.commands.length === 0) {
      throw `no command was found for the ${platformType} system`;
    }
  }
}
