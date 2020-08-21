import { platformType, arch } from './base';
import { toArray } from '../utils/array';
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

  private val: {[index:string]: string} = {} as globalVal;

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
    process.env['PATH'] = `${this.binPath}${path.delimiter}${process.env['PATH']}`;
    process.env['FEF_PLUGIN_PATH'] = this.val.pd;
  }

  run(...args: string[]) {
    this.injectEnv();
    const commands = this.getCommands();
    for (let command of commands) {
      if (args && args.length > 0) {
        command = `${command} ${args.join(' ')}`;
      }
      execSync(command, {
        stdio: 'inherit',
        env: process.env
      });
    }
  }

  // exception not thrown
  runLess() {
    try {
      this.run();
    } catch(e) {
      return;
    }
  }

  check() {
    if (this.commands.length === 0) {
      throw `no command was found for the ${platformType} system`;
    }
  }
}
