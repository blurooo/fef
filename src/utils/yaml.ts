import fs from 'fs';
import yaml from 'js-yaml';

export function parseYaml(path: any) {
  let config;

  if (fs.existsSync(path)) {
    try {
      config = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
    } catch (e) {
      throw new Error(e);
    }
  }

  return config;
}