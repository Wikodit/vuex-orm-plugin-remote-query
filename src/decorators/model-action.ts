/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Model as VuexORMModel } from '@vuex-orm/core';
import type { ActionContext, Module } from 'vuex';

import type { DecoratedModelClass } from './orm-model';

export function isModelAction(fct: unknown): fct is (...args: any[]) => any {
  return typeof fct === 'function';
}

function ensureModulePresence(modelClass: DecoratedModelClass): modelClass is (
  DecoratedModelClass &
  { _module: Module<any, any> }
) {
  if (!Object.prototype.hasOwnProperty.call(modelClass, '_module')) {
    // eslint-disable-next-line no-proto
    const parentModule = modelClass._module;

    Object.defineProperty(modelClass, '_module', {
      writable: false,
      enumerable: true, // @todo should be false
      configurable: false,
      value: {
        state: { ...parentModule?.state },
        mutations: { ...parentModule?.mutations },
        actions: { ...parentModule?.actions },
        getters: { ...parentModule?.getters },
      },
    });
  }
  return true;
}

export function ModelAction() {
  return (
    target: (VuexORMModel | typeof VuexORMModel) & {[key: string]: any},
    key: string,
    descriptor: PropertyDescriptor,
  ): void => {
    const modelAction = target[key];
    if (!isModelAction(modelAction)) {
      return;
    }

    let isStaticAction: boolean;
    let modelClass: DecoratedModelClass;

    if (typeof target.modelClass === 'function') {
      isStaticAction = false;
      modelClass = target.modelClass;
    } else {
      isStaticAction = true;
      modelClass = target as any;
    }

    if (!ensureModulePresence(modelClass)) return;

    // actionHandler is a real vuex action, which bind and call the model action
    // payload should always be an array (if called through `dispatch`)
    // if it's an instance action, first argument should be the model instance
    const actionHandler = (context: ActionContext<any, any>, payload: any[]): any => {
      if (isStaticAction) {
        const [instance, ...args] = payload ?? [];
        modelAction.call(instance, ...args);
      } else {
        modelAction.call(modelClass, ...(payload ?? []));
      }
    };

    if (typeof modelClass._module.actions === 'object' && isModelAction(actionHandler)) {
      modelClass._module.actions[key] = actionHandler;
      target[key] = function actionModel(...args: any[]) {
        if (isStaticAction) {
          modelClass.dispatch(key, [this, ...args]);
        } else {
          modelClass.dispatch(key, args);
        }
      };
    }

    descriptor.writable = false;
    descriptor.configurable = false;
  };
}

export default ModelAction;
