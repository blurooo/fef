import fs from 'fs';
import util from 'util';
import path from 'path';
import Bobolink from 'bobolink';

export default new class {
  public bobolink = new Bobolink({
    concurrency: 5,
    timeout: 0,
    handler: (cb: any) => {
      return cb();
    }
  });

  public constants = fs.constants

  public access = util.promisify(fs.access)

  public mkdir = util.promisify(fs.mkdir)

  public writeFile = util.promisify(fs.writeFile)

  public symlink = util.promisify(fs.symlink)

  public unlink = util.promisify(fs.unlink)

  public rmdir = util.promisify(fs.rmdir)

  public lstat = util.promisify(fs.lstat)

  public readdir = util.promisify(fs.readdir);

  public async link(source: string, target: string) {
    try {
      const stats = await this.lstat(target);
      if (stats.isFile() || stats.isSymbolicLink()) {
        await this.unlink(target);
      } else if (stats.isDirectory()) {
        await this.deleteDir(target);
      }
    } catch (e) {
    }
    return this.symlink(source, target);
  }

  public async deleteDir(dirPath: string) {
    const files = await this.readdir(dirPath);
    const awaitPs = [];
    for (let file of files) {
      file = path.join(dirPath, file);
      const stats = await this.lstat(file);
      if (stats.isDirectory()) {
        await this.deleteDir(file);
      }
      const res = this.bobolink.push(() => {
        return this.unlink(file);
      });
      awaitPs.push(res);
    }
    await Promise.all(awaitPs);
    return this.rmdir(dirPath);
  }
};
