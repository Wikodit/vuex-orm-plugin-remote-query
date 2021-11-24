/* eslint-disable @typescript-eslint/no-explicit-any */
import isPlainObject from './isPlainObject';

export function serializeArgs<Args = any>({
  args,
  scope,
}: {scope?: string, args: Args}): string {
  // Sort the object keys before stringifying
  return `${scope}/${JSON.stringify(args, (k, value) => (isPlainObject(value)
    ? Object.keys(value)
      .sort()
      .reduce<any>((acc, key) => {
        acc[key] = (value as any)[key];
        return acc;
      }, {})
    : value))}`;
}

export default serializeArgs;
