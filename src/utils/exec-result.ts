import child_process from 'child_process';

export default class ExecResult {
  err: child_process.ExecException | null;

  stdout: String | Buffer;

  stderr: String | Buffer;

  constructor(err: Error | null, stdout: String | Buffer, stderr: String | Buffer) {
    this.err = err;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}
