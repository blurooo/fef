import fs from 'fs';
import util from 'util';
import yaml from 'js-yaml';

const readFile = util.promisify(fs.readFile);

export async function parseYaml(path: any) {
  const content = await readFile(path, 'utf8');
  return yaml.safeLoad(content?.toString());
}