/* eslint-disable @typescript-eslint/no-explicit-any */
import { Collection, Instance, Model as VuexORMModel } from '@vuex-orm/core';
import type { Config, Request } from '@vuex-orm/plugin-axios';
import type { AxiosError } from 'axios';
import qs from 'qs';
import type { NonFunctionKeys } from 'utility-types';

import {
  Attr, PrimaryKey,
} from './decorators';
import { ModelAction } from './decorators/model-action';

export function isAxiosError(error: unknown): error is AxiosError {
  return !!(typeof error === 'object' && error && (error as AxiosError).isAxiosError);
}

// eslint-disable-next-line no-use-before-define
interface ModelClass<T extends Model>{
  new (data: any): T;
  entity: string;
  endpoint?: string;
  api(): Request;
}

// eslint-disable-next-line no-use-before-define
export type SchemaOf<T extends Model> = Pick<T, NonFunctionKeys<T>>;

export class Model extends VuexORMModel {
  static endpoint?: string;

  @PrimaryKey()
  @Attr()
  public id!: string;

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

  async destroy(): Promise<void> {
    await this.modelClass.api().delete(`${this.modelClass.endpoint}/${this.id}`, { delete: this.id });
  }

  async patch<T extends Model>(
    this: T,
    data: Partial<SchemaOf<T>>,
    params: Omit<Config, 'params'> = {},
  ): Promise<Instance<T> | null> {
    const res = await this.modelClass.api().patch(
      `${this.modelClass.endpoint}/${this.id}`, data, params,
    );
    return res.entities?.[this.modelClass.entity]?.[0] as Instance<T> ?? null;
  }

  static async patch<T extends Model>(
    this: ModelClass<T>,
    id: string,
    data: Partial<SchemaOf<T>>,
  ): Promise<Instance<T> | null> {
    const res = await this.api().patch(`${this.endpoint}/${id}`, data);
    return res.entities?.[this.entity]?.[0] as Instance<T> ?? null;
  }

  static async post<T extends Model>(
    this: ModelClass<T>,
    data: Partial<SchemaOf<T>>,
    params: Omit<Config, 'params'> = {},
  ): Promise<Instance<T> | null> {
    const res = await this.api().post(`${this.endpoint}`, data, params);
    if (res.entities) {
      return res.entities[this.entity][0] as Instance<T>;
    }
    return null;
  }

  get modelClass(): typeof Model {
    return this.constructor as typeof Model;
  }
}

export default Model;
