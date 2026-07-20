import { Transform } from 'class-transformer';

const toIsoString = (date: Date) => date?.toISOString() ?? null;

const toDate = (value: string) => {
  if (!value) return null;

  return new Date(value);
};

export function TransformDate() {
  const toPlain = Transform(({ value }) => toIsoString(value), {
    toPlainOnly: true,
  });

  const toClass = Transform(({ value }) => toDate(value), {
    toClassOnly: true,
  });

  return function (target: unknown, key: string) {
    toPlain(target, key);
    toClass(target, key);
  };
}
