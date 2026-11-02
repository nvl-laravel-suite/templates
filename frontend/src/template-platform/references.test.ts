import { expect, it } from 'vitest'
import { createExperienceDocument } from './demo-documents'
import { recompileTemplateDocument } from './recompile'
import type { DataSchema, JsonObject } from '../template-core/schema'
it('preserves exact reusable content references for backend resolution and rejects malformed references', () => {
  const doc = createExperienceDocument()
  doc.content.title = { kind: 'content', id: 'copy', revision: 2, path: 'heading' }
  expect(recompileTemplateDocument(doc, doc.source.definition).content.title).toEqual(doc.content.title)
  doc.content.title = { kind: 'content', id: 'copy', revision: 0 }
  expect(() => recompileTemplateDocument(doc, doc.source.definition)).toThrow(/content/)
})

it('preserves backend resourceId aliases and backend precedence without rewriting raw source',async()=>{
 const {isContentReference,validateAuthoredContent,contentReferenceId}=await import('./references')
 const doc=createExperienceDocument();const schema:DataSchema={type:'object',properties:{title:{type:'string' as const}},required:['title'],additionalProperties:false}
 const refs:JsonObject[]=[{kind:'content',id:'legacy',revision:2},{kind:'content',resourceId:'backend',revision:2,path:'heading'},{kind:'content',id:'legacy',resourceId:'backend',revision:2}]
 for(const ref of refs){
  expect(isContentReference(ref)).toBe(true);if(!isContentReference(ref))throw new Error('Expected valid content reference');expect(validateAuthoredContent(schema,{title:ref})).toEqual([])
  expect(contentReferenceId(ref)).toBe('resourceId' in ref?ref.resourceId:ref.id)
  doc.content.title=ref;expect(recompileTemplateDocument(doc,doc.source.definition).content.title).toEqual(ref)
 }
})
it('rejects malformed supplied aliases, unknown properties and unsafe reference paths',async()=>{
 const {isContentReference,validateAuthoredContent}=await import('./references')
 const schema:DataSchema={type:'object',properties:{title:{type:'string' as const}},required:['title'],additionalProperties:false}
 const refs:JsonObject[]=[{kind:'content',revision:2},{kind:'content',resourceId:'',revision:2},{kind:'content',resourceId:'backend',id:'',revision:2},{kind:'content',resourceId:'backend',id:4,revision:2},{kind:'content',resourceId:'backend',revision:2,path:'constructor.secret'},{kind:'content',resourceId:'backend',revision:2,path:'safe.prototype'},{kind:'content',resourceId:'backend',revision:2,unexpected:true}]
 for(const ref of refs){
  expect(isContentReference(ref)).toBe(false);expect(validateAuthoredContent(schema,{title:ref}).length).toBeGreaterThan(0)
 }
})
