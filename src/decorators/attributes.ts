/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-shadow */
import { Model, Database } from '@vuex-orm/core';

type Mutator<T> = (value: T) => T;

/**
 * Sets the property as the primary key of the model
 */
export function PrimaryKey() {
  return (target: Record<string, any>, propertyName: string | symbol): void => {
    (target.constructor as any).primaryKey = propertyName;
  };
}

export enum FieldType {
  String = 'string',
  Attr = 'attr',
  BelongsTo = 'belongsTo',
  BelongsToMany = 'belongsToMany',
  Boolean = 'boolean',
  HasManyBy = 'hasManyBy',
  HasMany = 'hasMany',
  HasManyThrough = 'hasManyThrough',
  HasOne = 'hasOne',
  Increment = 'increment',
  MorphMany = 'morphMany',
  MorphOne = 'morphOne',
  MorphTo = 'morphTo',
  MorphToMany = 'morphToMany',
  MorphedByMany = 'morphedByMany',
  Number = 'number',
}

export type FieldDecorator = (target: Model, propertyName: string | symbol) => void;
export type FieldFactory = (database: Database) => any;

function ensureFieldFactoriesPresence(
  target: typeof Model & { _fieldFactories?: Record<string | symbol, FieldFactory> },
): target is (
  (typeof Model) &
  { _fieldFactories: Record<string | symbol, FieldFactory> }
) {
  if (!Object.prototype.hasOwnProperty.call(target, '_fieldFactories')) {
    const parentFieldFactories = target._fieldFactories;

    Object.defineProperty(target, '_fieldFactories', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: {
        ...parentFieldFactories,
      },
    });
  }
  return true;
}

/**
 * Adds the property as a model field
 * @param fieldType The field attribute
 */
export function Field(fieldType: FieldType, modelKeyParams: string[] | null, params: any) {
  return (target: Model, propertyName: string | symbol): void => {
    const modelClass = target.constructor as typeof Model;
    if (ensureFieldFactoriesPresence(modelClass)) {
      // First `any` is to ignore fact it can be symbol, which does not play nice with TS
      // Second `any` is because argument numbers are variable.
      modelClass._fieldFactories[propertyName as any] = (database) => {
        const modelParams = [];
        // modelKeys are always firts params
        if (Array.isArray(modelKeyParams)) {
          for (const entityName of modelKeyParams) {
            modelParams.push(database.model(entityName));
          }
        }
        return (Model[fieldType] as any)(...[...modelParams, ...params]);
      };
    }
  };
}

/**
 * Adds the property as a string typed field
 * @param defaultValue The default value for the field (if undefined the default will be '')
 */
export function StringAttr(defaultValue?: string): FieldDecorator {
  return Field(FieldType.String, null, arguments);
}

/**
 * Adds the property as an incremental field
 */
export function IncrementAttr(): FieldDecorator {
  return Field(FieldType.Increment, null, arguments);
}

/**
 * Adds the property as a generic attribute field
 * @param defaultValue The default value for the field (if undiefine dthe default will be '')
 */
export function Attr(defaultValue?: any): FieldDecorator {
  return Field(FieldType.Attr, null, arguments);
}

/**
 * Adds the property as a number typed field
 * @param defaultValue The default value for the field (if undefined the default will be 0)
 */
export function NumberAttr(defaultValue?: number): FieldDecorator {
  return Field(FieldType.Number, null, arguments);
}

/**
 * Adds the property as a boolean typed field
 * @param defaultValue The default value for the field (if undefined the default will be FALSE)
 */
export function BooleanAttr(value: any, mutator?: Mutator<boolean | null>): FieldDecorator {
  return Field(FieldType.Boolean, null, arguments);
}

/**
 * Adds the property as a 'Has Many' relationship field
 * @param related The class of the related model
 * @param foreignKey The foreign key of the related model
 * @param localKey The local key on the parent model
 */
export function HasMany(
  related: string, foreignKey: string, localKey?: string,
): FieldDecorator {
  return Field(FieldType.HasMany, [related], [foreignKey, localKey]);
}

/**
 * Adds the property as a 'Has One' relationship field
 * @param related The class of the related model
 * @param foreignKey The foreign key of the related model
 * @param localKey The local key on the parent model
 */
export function HasOne(
  related: string, foreignKey: string, localKey?: string,
): FieldDecorator {
  return Field(FieldType.HasOne, [related], [foreignKey, localKey]);
}

/**
 * Adds the property as a 'Belongs To' relationship field
 * @param parent The class of the parent model
 * @param foreignKey The foreign key of this model
 * @param ownerKey The key on the parent model
 */
export function BelongsTo(
  parent: string, foreignKey: string, ownerKey?: string,
): FieldDecorator {
  return Field(FieldType.BelongsTo, [parent], [foreignKey, ownerKey]);
}

export function HasManyBy(
  parent: string, foreignKey: string, ownerKey?: string,
): FieldDecorator {
  return Field(FieldType.HasManyBy, [parent], [foreignKey, ownerKey]);
}

export function HasManyThrough(
  related: string,
  through: string,
  firstKey: string,
  secondKey: string,
  localKey?: string,
  secondLocalKey?: string,
): FieldDecorator {
  return Field(FieldType.HasManyThrough, [related, through], [
    firstKey,
    secondKey,
    localKey,
    secondLocalKey,
  ]);
}

export function BelongsToMany(
  related: string,
  pivot: string,
  foreignPivotKey: string,
  relatedPivotKey: string,
  parentKey?: string,
  relatedKey?: string,
): FieldDecorator {
  return Field(FieldType.BelongsToMany, [related, pivot], [
    foreignPivotKey,
    relatedPivotKey,
    parentKey,
    relatedKey,
  ]);
}

export function MorphTo(
  id: string, type: string,
): FieldDecorator {
  return Field(FieldType.MorphTo, null, arguments);
}

export function MorphOneField(
  related: string, id: string, type: string, localKey?: string,
): FieldDecorator {
  return Field(FieldType.MorphOne, [related], [id, type, localKey]);
}

export function MorphManyField(
  related: string, id: string, type: string, localKey?: string,
): FieldDecorator {
  return Field(FieldType.MorphMany, [related], [id, type, localKey]);
}

export function MorphToManyField(
  related: string,
  pivot: string,
  relatedId: string,
  id: string,
  type: string,
  parentKey?: string,
  relatedKey?: string,
): FieldDecorator {
  return Field(FieldType.MorphToMany, [related, pivot], [
    relatedId,
    id,
    type,
    parentKey,
    relatedKey,
  ]);
}

export function MorphedByManyField(
  related: string,
  pivot: string,
  relatedId: string,
  id: string,
  type: string,
  parentKey?: string,
  relatedKey?: string,
): FieldDecorator {
  return Field(FieldType.MorphedByMany, [related, pivot], [
    relatedId,
    id,
    type,
    parentKey,
    relatedKey,
  ]);
}
