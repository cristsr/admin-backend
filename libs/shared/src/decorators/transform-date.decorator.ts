import { Transform } from 'class-transformer';

const toIsoString = (date: Date) => date?.toISOString() ?? null;

export function TransformDate() {
  const toPlain = Transform(({ value }) => toIsoString(value), {
    toPlainOnly: true,
  });

  const toClass = Transform(({ value }) => (value ? new Date(value) : null), {
    toClassOnly: true,
  });

  return function (target: unknown, key: string) {
    toPlain(target, key);
    toClass(target, key);
  };
}
