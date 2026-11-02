import { expect, it, vi } from 'vitest'
import { createTemplateSession } from './session'
import type { EditorBootstrap, TemplateRepository, TemplateSourceDocument } from './contracts'

it('compiles structural group source with its captured bootstrap before publishing and ignores derived output on change',async()=>{
 const source={format:'template-document',schemaVersion:1,target:'document',source:{mode:'group-variant',group:{id:'family',revision:1},overrides:{variations:{point:{kind:'node-style',value:'bold'}}}}} as TemplateSourceDocument
 const bootstrap={template:{id:'t'},source,version:1,capabilities:{engines:{bindings:true,shared:true}},family:{id:'family',revision:1}} as EditorBootstrap
 const compile=vi.fn(async(document:TemplateSourceDocument,_caps:unknown,context:EditorBootstrap)=>{expect(context.family?.revision).toBe(1);return {...document,compiled:{sourceKey:'source',artifacts:{engine:'bindings',html:'<p>Compiled</p>',css:'',bindings:[]}}} as TemplateSourceDocument})
 const saveDraft=vi.fn(async(_id,document,version)=>({document,version:version+1}));const publish=vi.fn(async()=>({id:'release',revision:1}))
 const repository={load:async()=>bootstrap,saveDraft,publish} as unknown as TemplateRepository
 const session=createTemplateSession({repository,compile});await session.load('t');await session.publish()
 expect(compile).toHaveBeenCalledTimes(1);expect(saveDraft.mock.calls[0][1]).toHaveProperty('compiled')
 session.change(source);expect(session.getState().dirty).toBe(false)
})
