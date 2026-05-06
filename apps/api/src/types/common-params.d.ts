/** Generic ID parameter with configurable key name */
export type IdParams<TKey extends string = 'id'> = {
  [K in TKey]: string;
};

/** Common ID param variants */
export type EntityIdParams = IdParams<'id'>;
export type ResourceIdParams = IdParams<'key'>;
