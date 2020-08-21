import fs from 'fs';
import util from 'util';

export default new class {
  public constants = fs.constants

  public access = util.promisify(fs.access)

  public mkdir = util.promisify(fs.mkdir)

  public writeFile = util.promisify(fs.writeFile)

  public symlink = util.promisify(fs.symlink)

  public unlink = util.promisify(fs.unlink)

  public async link(source: string, target: string) {
    try {
      await this.unlink(target);
    } catch (e) {
    }
    return this.symlink(source, target);
  }
};
