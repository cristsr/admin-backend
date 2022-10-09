export const equal = (arr: any[], key: string) => {
  const [first] = arr;

  return arr.every((v) => {
    if (key) {
      return v[key] === first[key];
    }

    return v === first;
  });
};
