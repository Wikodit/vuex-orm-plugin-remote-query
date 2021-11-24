/* eslint-disable no-use-before-define */
/* eslint-disable max-classes-per-file */
import { AxiosResponse } from 'axios';
import {
  Attr,
  BelongsTo,
  Model,
  OrmModel,
  PrimaryKey,
  RemoteQuery,
  UseRemoteQuery,
} from '../../src';

export enum Entity {
  User = 'User',
  Post = 'Post',
}

export class BaseModel extends Model {
  @PrimaryKey()
  @Attr()
  public id!: number;

  @RemoteQuery({
    query: (params: {page: number}) => ({ params }),
  })
  static useFetchAll: UseRemoteQuery<any[]>;

  @RemoteQuery({
    query: (params: {page: number}) => ({ params }),
    transformResponse: ({ entities, response }) => {
      const count = response?.headers?.['x-model-count'] ?? null;
      return { data: entities, count: count !== null ? +count : null };
    },
  })
  static useFetchAllWithCount: UseRemoteQuery<{ data: any[], count: number }>;

  @RemoteQuery({
    query(id: string) {
      return { url: `${this.endpoint}/${id}` };
    },
    transformResponse: ({ entities }, target) => entities?.[target.entity]?.[0] ?? null,
  })
  static useFetchById: UseRemoteQuery<any | null>;
}

@OrmModel('Post', { endpoint: 'posts' })
export class Post extends BaseModel {
  @Attr()
  public title!: string;

  @Attr()
  public body!: string;

  @Attr()
  public userId?: number;

  @BelongsTo(Entity.User, 'userId')
  public user!: User | null;
}

@OrmModel('User', { endpoint: 'users' })
export class User extends BaseModel {
  @Attr()
  name!: string;

  @Attr()
  username!: string;

  @Attr()
  email!: string;

  @Attr()
  address!: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };

  @Attr()
  phone!: string;

  @Attr()
  website!: string;

  @Attr()
  company!: {
    name: string
    catchPhrase: string
    bs: string
  };
}
