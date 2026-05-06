/** Generic CRUD body factories */
export type CreateBody<T> = T;
export type UpdateBody<T> = T & { id: string };
export type PatchBody<T> = Partial<T> & { id: string };
