import { expect, it, vi } from 'vitest'
vi.mock('@nicolasvlachos/voucher-builder/template-renderer',async()=>import('../../src/template-renderer'))
import { createTemplateDefinition, exportBindingDocument, type StandaloneTemplateDraft } from '../../src/template-renderer'
import { createExperienceDocument } from '../../src/template-platform/demo-documents'
import { applyTemplateResource, referenceTemplateContent, resolveReusableContent } from './resources'
import type { ResourceRevision, TemplateRepository } from './contracts'
const resource = (document: unknown): ResourceRevision => ({ id:'shared-copy',key:'copy',name:'Copy',kind:'content',scope:'tenant',groupId:null,templateId:null,revision:2,revisionId:'r2',checksum:'sum',document })
it('preserves raw content references and resolves exact revisions once per preview load', async () => {
 const source = createExperienceDocument()
 const ref = resource({heading:'Pinned title'})
 const next = referenceTemplateContent(source,'title',ref,'heading')
 expect(next.content.title).toEqual({kind:'content',id:'shared-copy',revision:2,path:'heading'})
 expect(next.dependencies).toEqual([{resourceId:'shared-copy',revision:2}])
 const loadResource=vi.fn(async()=>ref)
 const content=await resolveReusableContent('template',{a:next.content.title,b:next.content.title},{loadResource} as Pick<TemplateRepository,'loadResource'>)
 expect(content).toEqual({a:'Pinned title',b:'Pinned title'});expect(loadResource).toHaveBeenCalledTimes(1)
 expect(loadResource).toHaveBeenCalledWith('template','shared-copy',2,{signal:undefined})
 expect(source.content.title).not.toEqual(next.content.title)
})
it('detects cycles and refuses missing content paths',async()=>{
 const loadResource=vi.fn(async()=>resource({loop:{kind:'content',id:'shared-copy',revision:2,path:'loop'}}))
 await expect(resolveReusableContent('t',{a:{kind:'content',id:'shared-copy',revision:2,path:'loop'}},{loadResource})).rejects.toThrow(/Circular/)
 await expect(resolveReusableContent('t',{a:{kind:'content',id:'shared-copy',revision:2,path:'absent'}},{loadResource})).rejects.toThrow(/missing/)
})
it('imports resources explicitly, retaining dependency pins and source identity',()=>{
 const source=createExperienceDocument()
 const next=applyTemplateResource(source,{...resource({colors:{primary:'#123456'}}),kind:'theme'})
 expect(next.theme.colors.primary).toBe('#123456');expect(next).not.toHaveProperty('artifacts')
 expect(next.dependencies).toEqual([{resourceId:'shared-copy',revision:2}])
 const layout=applyTemplateResource(source,{...resource(createTemplateDefinition('Layout')),kind:'layout'})
 expect(layout.source.definition.id).toBe(source.source.definition.id)
 expect(source.source.definition.roots.length).toBeGreaterThan(0)
})

it('resolves PHP resourceId references with backend precedence and caches canonical alias identities',async()=>{
 const content={alias:{kind:'content',resourceId:'shared-copy',revision:2,path:'heading'},canonical:{kind:'content',id:'shared-copy',revision:2,path:'heading'},both:{kind:'content',id:'ignored-legacy-copy',resourceId:'shared-copy',revision:2,path:'heading'},ordinary:{resourceId:'ordinary-data',revision:2}}
 const before=structuredClone(content);const loadResource=vi.fn(async()=>resource({heading:'Resolved alias'}))
 expect(await resolveReusableContent('t',content,{loadResource})).toEqual({alias:'Resolved alias',canonical:'Resolved alias',both:'Resolved alias',ordinary:content.ordinary})
 expect(loadResource).toHaveBeenCalledOnce();expect(loadResource).toHaveBeenCalledWith('t','shared-copy',2,{signal:undefined});expect(content).toEqual(before)
})
it('projects alias snapshots and uses authoritative identifiers in reference identity',async()=>{
 const {projectSnapshotContent,projectResolvedContent,reusableContentIdentity}=await import('./resources')
 const raw={title:{kind:'content',id:'legacy-copy',resourceId:'shared-copy',revision:2,path:'heading'}};const alias={title:{kind:'content',resourceId:'shared-copy',revision:2,path:'heading'}}
 expect(reusableContentIdentity(raw)).toEqual(reusableContentIdentity(alias))
 expect(projectSnapshotContent({moved:alias.title},raw,{title:'Authorized snapshot'})).toEqual({moved:'Authorized snapshot'})
 expect(projectResolvedContent(raw,{title:'Resolved alias'})).toEqual({title:'Resolved alias'});expect(raw.title.id).toBe('legacy-copy')
})
it('detects mixed-alias cycles and rejects malformed aliases before transport',async()=>{
 const loadResource=vi.fn(async()=>resource({loop:{kind:'content',id:'shared-copy',revision:2,path:'loop'}}))
 await expect(resolveReusableContent('t',{a:{kind:'content',resourceId:'shared-copy',revision:2,path:'loop'}},{loadResource})).rejects.toThrow(/Circular/)
 loadResource.mockClear()
 for(const ref of [{kind:'content',resourceId:'shared-copy',id:'',revision:2},{kind:'content',resourceId:'shared-copy',revision:2,path:'safe.constructor'},{kind:'content',resourceId:'shared-copy',revision:2,extra:true}])await expect(resolveReusableContent('t',{a:ref},{loadResource})).rejects.toThrow(/Invalid/)
 expect(loadResource).not.toHaveBeenCalled()
})
it('changes resolution identity when a valid reference acquires malformed raw fields',async()=>{
 const {reusableContentIdentity}=await import('./resources')
 const valid={title:{kind:'content',id:'shared-copy',revision:2,path:'heading'}}
 const invalid={title:{...valid.title,unexpected:true}}
 const otherInvalid={title:{...valid.title,unexpected:false}}
 expect(reusableContentIdentity(invalid)).not.toEqual(reusableContentIdentity(valid))
 expect(reusableContentIdentity(invalid)).not.toEqual(reusableContentIdentity(otherInvalid))
 expect(reusableContentIdentity({title:{unexpected:true,path:'heading',revision:2,id:'shared-copy',kind:'content'}})).toEqual(reusableContentIdentity(invalid))
 const loadResource=vi.fn(async()=>resource({heading:'Resolved'}))
 await expect(resolveReusableContent('t',invalid,{loadResource})).rejects.toThrow(/Invalid/)
 expect(loadResource).not.toHaveBeenCalled()
})
