export const DOCUMENT_SCHEMA_VERSION = 1;
export type CadDocument = {schemaVersion:1; id:string; name:string; items:unknown[]; modifiedAt:string};
export function validateDocument(value:unknown):CadDocument {
 if(!value || typeof value!=='object') throw new Error('Invalid document');
 const v=value as Record<string,unknown>;
 if(v.schemaVersion!==DOCUMENT_SCHEMA_VERSION) throw new Error('Unsupported document schema version');
 if(typeof v.id!=='string'||!v.id.trim()||typeof v.name!=='string'||!v.name.trim()||!Array.isArray(v.items)||typeof v.modifiedAt!=='string') throw new Error('Malformed document');
 return v as CadDocument;
}
export function parseDocument(json:string):CadDocument {return validateDocument(JSON.parse(json));}
export function serializeDocument(document:CadDocument):string {return JSON.stringify(validateDocument(document),null,2);}
export function createDocument(id:string,name='Без имени'):CadDocument {
 if(!id.trim()) throw new Error('Document id required');
 return {schemaVersion:1,id,name,items:[],modifiedAt:new Date().toISOString()};
}
