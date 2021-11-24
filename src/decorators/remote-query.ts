import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ComputedOptions } from 'vue';
import { Response } from '@vuex-orm/plugin-axios';
import type {
  Model, ModelClass, RemoteQueryGetters, RQFetcherParams,
} from '@/model';

export type UseRemoteQuery<T> = (
  args?:
  | ((this: any) => any)
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  | Record<string, any>,
  params?: RQFetcherParams,
  forceVM?: Vue,
) => ComputedOptions<any>;

export interface RemoteQueryQuery<T> extends AxiosRequestConfig {
  rawResponse?: boolean;
}

export type RemoteQueryParams<T extends Model, A extends any[], > = {
  query?: RemoteQueryQuery<T> | ((this: ModelClass<T>, ...args: A) => RemoteQueryQuery<T>);
  transformResponse?: (response: Response, target: ModelClass<T>) => any;
};

export function RemoteQuery<T extends Model, A extends any[], >(this: any,
  params: RemoteQueryParams<T, A>) {
  return (target: typeof Model, propertyName: string): void => {
    (target as any)[propertyName] = function (
      args?: (this: any) => any,
      overrideParams?: RQFetcherParams,
    ) {
      return target.useFetch.call(this, args, { ...params, ...overrideParams } as any);
    };
  };
}

export default RemoteQuery;
