import { platformType, arch, toArray } from './base';
import { execSync, exec } from 'child_process';
import path from 'path';
import ExecResult from "../utils/exec-result";

const valRegexp = new RegExp('\\${var:.*?}', 'ig');

function getVal(symbol: string): string {
  return symbol.substring('${var:'.length, symbol.length - 1);
}

type globalVal = {
  pd: string;
};

export class Command {

  private val: {[index:string]: string} = {} as globalVal;

  private ctx: any;

  private commands: string[] = [];

  private binPath: string = '';

  constructor(ctx: any, pluginPath: string, command: any) {
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
    this.ctx = ctx;
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

  run(...args: string[]) {
    const envPath = `${this.binPath}${path.delimiter}${process.env['PATH']}`;
    // 准入依赖path
    process.env['PATH'] = envPath;
    process.env['FEF_PLUGIN_PATH'] = this.val.pd;
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

  async runPipe(...args: string[]): Promise<ExecResult> {
    const envPath = `${this.binPath}${path.delimiter}${process.env['PATH']}`;
    // 准入依赖path
    process.env['PATH'] = envPath;
    const commands = this.getCommands();
    let gStdout: string = '';
    let gStderr: string = '';
    let gErr: Error;
    for (let command of commands) {
      if (args && args.length > 0) {
        command = `${command} ${args.join(' ')}`;
      }
      let result = await this.runCommandPipe(command, process.env);
      if (result.stdout) {
        gStdout += result.stdout.toString()
      }
      if (result.stderr) {
        gStderr += result.stderr.toString()
      }
      if (result.err) {
        gErr = result.err;
        break;
      }
    }
    // @ts-ignore
    return Promise.resolve(new ExecResult(gErr, gStdout, gStderr));
  }

  private runCommandPipe(command: string, env: NodeJS.ProcessEnv): Promise<ExecResult> {
    return new Promise((resolve) => {
      exec(command, {
        env
      }, (err, stdout, stderr) => {
        return resolve(new ExecResult(err, stdout, stderr));
      });
    });
  }

  // exception not thrown
  runLess() {
    try {
      this.run();
    } catch(e) {
      this.ctx.logger.debug(e);
      this.ctx.logger.error(`[command interrupt] ${e}`);
      return;
    }
  }

  check() {
    if (this.commands.length === 0) {
      throw `no command was found for the ${platformType} system`;
    }
  }
}
