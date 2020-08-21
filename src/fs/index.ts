import fs from 'fs';
import util from 'util';

export default new class {

    constants = fs.constants

    access = util.promisify(fs.access)

    mkdir = util.promisify(fs.mkdir)

    writeFile = util.promisify(fs.writeFile)

    symlink = util.promisify(fs.symlink)

    unlink = util.promisify(fs.unlink)

    link = async (source: string, target: string) => {
        try {
            await this.unlink(target);
        } catch (e) {}
        return this.symlink(source, target);
    }

}