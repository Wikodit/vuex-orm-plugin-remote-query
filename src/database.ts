/* eslint-disable no-underscore-dangle */
import { Database as VuexOrmDatabase } from '@vuex-orm/core';

export class Database extends VuexOrmDatabase {
  private static ormDatabase = new Database();

  static get default(): Database {
    return this.ormDatabase;
  }
}

export default Database;
