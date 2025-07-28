declare module 'generate-schema' {
  export interface SchemaObject {
    [key: string]: any;
  }
  export function json(data: any): SchemaObject;
}
