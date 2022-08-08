import { join } from 'path';
import { glob } from 'glob';

export function resolveProto(folder: string, name: string) {
  /*glob(join(__dirname, 'assets', folder), (err, files) => {
    if (err) {
      console.log('GLOB ERROR');
      console.error(err);
    }
    console.log(files);
  });*/

  return join(__dirname, 'assets', folder, name + '.proto');
}

export function resolveManyProto(folder, names: string[]) {
  return names.map((name) => resolveProto(folder, name));
}
