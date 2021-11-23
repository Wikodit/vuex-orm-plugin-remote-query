/* eslint-disable @typescript-eslint/no-explicit-any */
import VuexORM from '@vuex-orm/core';
import VuexORMAxios, { GlobalConfig } from '@vuex-orm/plugin-axios';
import axios from 'axios';
import type { Plugin } from 'vuex';

import { Database } from './database';

export interface OrmSettings {
  axiosConfig?: GlobalConfig | true;
  database?: Database;
}

export default class OrmPlugin {
  public static install(settings: OrmSettings = {}): Plugin<any> {
    if (settings.axiosConfig) {
      VuexORM.use(VuexORMAxios, {
        axios,
        ...(typeof settings.axiosConfig === 'object' ? settings.axiosConfig : undefined),
      });
    }
    return (store: any) => {
      const plugin = VuexORM.install(settings.database ?? Database.default);
      plugin(store);
    };
  }
}
