/* eslint-disable max-classes-per-file */
import {
  Attr,
  BelongsTo,
  Model,
  OrmModel,
} from '../../src';

export enum Entity {
  User = 'User',
  Post = 'Post',
}

@OrmModel('User', { endpoint: 'users' })
export class User extends Model {
  @Attr()
  public title!: string;

  @Attr()
  public body!: string;

  @Attr()
  public userId?: number;

  @BelongsTo(Entity.User, 'userId')
  public user!: User | null;
}

@OrmModel('Post', { endpoint: 'posts' })
export class Post extends Model {
  @Attr()
  public title!: string;

  @Attr()
  public body!: string;

  @Attr()
  public userId?: number;

  @BelongsTo(Entity.User, 'userId')
  public user!: User | null;
}
