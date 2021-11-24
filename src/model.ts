/* eslint-disable @typescript-eslint/no-explicit-any */
import { Collection, Instance, Model as VuexORMModel } from '@vuex-orm/core';
import type { Config, Request } from '@vuex-orm/plugin-axios';
import type { AxiosError } from 'axios';
import qs from 'qs';
import type { NonFunctionKeys } from 'utility-types';
import Vue, { ComputedOptions } from 'vue';

import {
  Attr, PrimaryKey, RemoteQueryParams,
} from './decorators';
import { ModelAction } from './decorators/model-action';
import { serializeArgs } from './utils/serializeArgs';

export interface RemoteQueryGetters<T> {
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isUninitialized: boolean;
  refetch(): void;
  data: T | null;
  error: Error | null;
}

export type RQFetcherParams = (Omit<Config, 'params'> & {
  withCount?: true;
  persistEntities?: boolean;
  endpoint?: string;
  pollingInterval?: number;
  refetchOnMount?: boolean;
  skip?(this: any): boolean;
});

type RQCacheItem = {
  k: string, // cache key
  o: RemoteQueryGetters<any>, // observer
  s: Set<symbol>, // subscribers
};

type RQCacheByCacheKey = Record<string, RQCacheItem>;

type RQCacheBySymbol = Record<symbol, RQCacheItem>;

export function isAxiosError(error: unknown): error is AxiosError {
  return !!(typeof error === 'object' && error && (error as AxiosError).isAxiosError);
}

// eslint-disable-next-line no-use-before-define
export interface ModelClass<T extends Model>{
  new (data: any): T;
  _rqCacheByCacheKey: RQCacheByCacheKey;
  _rqCacheBySymbol: RQCacheBySymbol;
  entity: string;
  endpoint?: string;
  api(): Request;
  fetchForObservable(
    o: RemoteQueryGetters<Collection<T>>,
    args: any,
    params?: RQFetcherParams,
  ): void;
}

// eslint-disable-next-line no-use-before-define
export type SchemaOf<T extends Model> = Pick<T, NonFunctionKeys<T>>;

export class Model extends VuexORMModel {
  static endpoint?: string;

  static _rqCacheByCacheKey: RQCacheByCacheKey = {};

  static _rqCacheBySymbol: RQCacheBySymbol = {};

  /**
   * Here we use a mixed solution : XHR to have error + buffer, iframe to allow downloading
   * without freezing the browser
   */
  static async download<T extends Model>(
    this: ModelClass<T>,
    path: string,
    query: Record<string, any> = {},
  ): Promise<void> {
    const queryString = qs.stringify({
      ...query,
      _: `${Date.now()}${Math.floor(Math.random() * 1000)}`, // random id to avoid cache/stall
    });

    // @todo prepend with baseUrl from axios
    const src = `${this.endpoint}/${path}?${queryString}`;

    const response = await this.api().axios.get(
      src,
      {
        responseType: 'blob',
        headers: {
          Accept: 'application/octet-stream',
        },
      },
    );

    const filename = response.headers['content-disposition']?.split('filename=')[1]?.split(';');
    if (filename && response.data) {
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      [link.download] = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      throw new Error('Not a file');
    }
  }

  static async fetchById<T extends Model>(
    this: ModelClass<T>,
    id: string,
    query?: Record<string, any>,
    requestParams: Omit<Config, 'params'>& { persistEntities?: boolean } = {},
  ): Promise<Instance<T> | null> {
    const res = await this.api().get(`${this.endpoint}/${id}`, {
      params: query,
      ...requestParams,
      save: !(requestParams.save === false || requestParams.persistEntities === false),
    });

    if (requestParams.save === false || requestParams.persistEntities === false) {
      // but also let's parse it to the model anyway to have helper methods
      if (requestParams.persistEntities === false && res.response.data) {
        return new this(res.response.data);
      }
      // Then entities are not parsed, so we explicitely returns datas
      return res.response.data;
    }

    if (res.entities && res.entities[this.entity].length === 1) {
      return res.entities[this.entity][0] as Instance<T>;
    }

    return null;
  }

  static async fetchForObservable<T extends Model>(
    this: ModelClass<T>,
    observable: RemoteQueryGetters<Collection<T>>,
    query: any,
    params: RemoteQueryParams<T, any> & RQFetcherParams = {},
  ): Promise<void> {
    if (observable.isUninitialized) {
      observable.isLoading = true;
      // init
      observable.isUninitialized = false;
    }

    observable.isFetching = true;

    async function fetcher(this: ModelClass<T>) {
      const { endpoint, ...requestParams } = {} as any; // params;

      const queryHandler = params.query ?? null;

      const res = await this.api().get(`${endpoint ?? this.endpoint}`, {
        ...typeof queryHandler === 'function' ? queryHandler.call(this, query) : queryHandler ?? {},
        ...requestParams,
        save: !(requestParams.save === false || requestParams.persistEntities === false),
      });

      if (typeof params.transformResponse === 'function') {
        return params.transformResponse.call(this, res, this);
      }

      let data: Collection<T> = [];

      if (requestParams.save === false || requestParams.persistEntities === false) {
        // but also let's parse it to the model anyway to have helper methods
        if (requestParams.persistEntities === false && Array.isArray(res.response.data)) {
          data = res.response.data.map((item) => new this(item));
        } else {
          // Then entities are not parsed, so we explicitely returns datas
          data = res.response.data;
        }
      }

      if (res.entities) {
        data = res.entities[this.entity] as Collection<T> ?? [];
      }

      return data;
    }

    try {
      const data = await fetcher.call(this);
      observable.data = data;
      observable.isSuccess = true;
      observable.error = null;
      observable.isError = false;
    } catch (error) {
      observable.error = error as Error;
      observable.isError = true;
      observable.isSuccess = false;
    }

    observable.isLoading = false;
    observable.isFetching = false;
  }

  static useFetch<T extends Model>(
    this: ModelClass<T>,
    args?: (this: any) => any,
    params?: RemoteQueryParams<T, any> & RQFetcherParams,
    forceVM?: Vue,
  ): ComputedOptions<any> { // RemoteQueryGetters<T[]> {
    const { _rqCacheBySymbol, _rqCacheByCacheKey, endpoint } = this;

    const symbolByVMId: Record<number, symbol> = {};

    // Unsubscribe the symbol from the cacheKey, and release the cacheKey if it's not
    // used anymore
    function unsubscribe(symbol: symbol): void {
      if (!_rqCacheBySymbol[symbol]?.k) return;
      _rqCacheByCacheKey[_rqCacheBySymbol[symbol].k].s.delete(symbol);
      if (_rqCacheByCacheKey[_rqCacheBySymbol[symbol].k].s.size === 0) {
        // @todo clean up
        delete _rqCacheByCacheKey[_rqCacheBySymbol[symbol].k];
      }
      delete _rqCacheBySymbol[symbol];
    }

    const fetchForObservable = this.fetchForObservable.bind(this);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      get() {
        if (!forceVM && (self === this || !(this as any)._uid)) {
          throw new Error('VM can not be detected, proper `this` binding is needed, please give `this` as third parameter of useFetch or use it this way in vue-class-component: `get data() { return Model.useFetch().get?.call(this) }');
        }

        const vm = forceVM ?? this as Vue;

        // Retrieve the unique symbol for this `use` and this vm
        const vmUid = (vm as any)._uid;
        if (!symbolByVMId[vmUid]) {
          symbolByVMId[vmUid] = Symbol(`${this.constructor.name}-${vmUid}`);
          vm.$once('hook:destroyed', () => unsubscribe(symbolByVMId[vmUid]));
        }
        const symbol = symbolByVMId[vmUid];

        const queryArgs = typeof args === 'function' ? args.call(vm) : args;
        const cacheKey = serializeArgs({ args: queryArgs, scope: endpoint });

        // Nothing has changed, return the cached value
        if (_rqCacheBySymbol[symbol]?.k === cacheKey) {
          return _rqCacheBySymbol[symbol].o;
        }

        // Since cacheKey is not the same, it means some args have changed
        // thus we can safely unsubscribe the symbol to it's previous cacheKey
        unsubscribe(symbol);

        // CacheKey does not exists, we create it
        if (!_rqCacheByCacheKey[cacheKey]) {
          const o = Vue.observable({
            isError: false,
            isFetching: false,
            isLoading: false,
            isSuccess: false,
            isUninitialized: true,
            refetch: () => { fetchForObservable(o, queryArgs, params); },
            data: null,
            error: null,
          });

          _rqCacheByCacheKey[cacheKey] = {
            k: cacheKey,
            o,
            s: new Set([symbol]),
          };

          fetchForObservable(o, queryArgs, params);
        }

        // We finaly associate the symbol to the cacheKey
        _rqCacheBySymbol[symbol] = _rqCacheByCacheKey[cacheKey];
        _rqCacheByCacheKey[cacheKey].s.add(symbol);

        return _rqCacheBySymbol[symbol].o;
      },
      cache: true,
    };
  }

  static async fetchAll<T extends Model>(
    this: ModelClass<T>,
    query: Record<string, any>,
    params: (Omit<Config, 'params'> & { withCount: true; persistEntities?: boolean; endpoint?: string }),
  ): Promise<{ count: number | null; data: Collection<T>}>

  static async fetchAll<T extends Model>(
    this: ModelClass<T>,
    query?: Record<string, any>,
    params?: (Omit<Config, 'params'> & { withCount?: false; persistEntities?: boolean; endpoint?: string }),
  ): Promise<Collection<T>>

  @ModelAction()
  static async fetchAll<T extends Model, WithCount extends boolean>(
    this: ModelClass<T>,
    query?: Record<string, any>,
    params: (Omit<Config, 'params'> & {
      withCount?: WithCount;
      persistEntities?: boolean;
      endpoint?: string;
    }) = {},
  ): Promise<{ count: number | null; data: Collection<T>} | Collection<T>> {
    const { withCount, endpoint, ...requestParams } = params;

    const res = await this.api().get(`${endpoint ?? this.endpoint}`, {
      params: query,
      ...requestParams,
      save: !(requestParams.save === false || requestParams.persistEntities === false),
    });

    let data: Collection<T> = [];

    if (requestParams.save === false || requestParams.persistEntities === false) {
      // but also let's parse it to the model anyway to have helper methods
      if (requestParams.persistEntities === false && Array.isArray(res.response.data)) {
        data = res.response.data.map((item) => new this(item));
      } else {
        // Then entities are not parsed, so we explicitely returns datas
        data = res.response.data;
      }
    }

    if (res.entities) {
      data = res.entities[this.entity] as Collection<T> ?? [];
    }

    if (withCount) {
      let count: number | null = null;
      if ('x-model-count' in res.response.headers) {
        count = +res.response.headers['x-model-count'];
        if (Number.isNaN(count)) {
          count = null;
        }
      }

      return {
        count,
        data,
      };
    }

    return data;
  }

  static async fetchCount(
    query?: Record<string, any>,
    requestParams: Omit<Config, 'params'> = {},
  ): Promise<number> {
    const res = await this.api().request({
      method: 'head',
      url: `${this.endpoint}`,
      params: query,
      ...requestParams,
      save: false,
    });

    if ('x-model-count' in res.response.headers) {
      return res.response.headers['x-model-count'];
    }
    return 0;
  }

  // async destroy(): Promise<void> {
  //   await this.modelClass.api().delete(`${this.modelClass.endpoint}/${this.id}`, {
  //  delete: this.id
  // });
  // }

  // async patch<T extends Model>(
  //   this: T,
  //   data: Partial<SchemaOf<T>>,
  //   params: Omit<Config, 'params'> = {},
  // ): Promise<Instance<T> | null> {
  //   const res = await this.modelClass.api().patch(
  //     `${this.modelClass.endpoint}/${this.id}`, data, params,
  //   );
  //   return res.entities?.[this.modelClass.entity]?.[0] as Instance<T> ?? null;
  // }

  // static async patch<T extends Model>(
  //   this: ModelClass<T>,
  //   id: string,
  //   data: Partial<SchemaOf<T>>,
  // ): Promise<Instance<T> | null> {
  //   const res = await this.api().patch(`${this.endpoint}/${id}`, data);
  //   return res.entities?.[this.entity]?.[0] as Instance<T> ?? null;
  // }

  // static async post<T extends Model>(
  //   this: ModelClass<T>,
  //   data: Partial<SchemaOf<T>>,
  //   params: Omit<Config, 'params'> = {},
  // ): Promise<Instance<T> | null> {
  //   const res = await this.api().post(`${this.endpoint}`, data, params);
  //   if (res.entities) {
  //     return res.entities[this.entity][0] as Instance<T>;
  //   }
  //   return null;
  // }

  get modelClass(): typeof Model {
    return this.constructor as typeof Model;
  }
}

export default Model;
