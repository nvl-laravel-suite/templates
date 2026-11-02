// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@nicolasvlachos/voucher-builder/template-creator', async()=>import('../../src/template-creator'))
vi.mock('@nicolasvlachos/voucher-builder/template-renderer', async()=>import('../../src/template-renderer'))
import { LaravelTemplateScreen } from '../laravel-host'
import { createExperienceDocument } from '../../src/template-platform/demo-documents'
import { materializeFamilyDocument } from '../../src/template-platform/catalog'
import type { EditorBootstrap, TemplateRepository } from './contracts'
import type { GroupVariantDocument } from '../../src/template-platform/types'

function fixture(structural=false):EditorBootstrap {
 const raw=createExperienceDocument();raw.source.definition.name='Shared family';raw.content.title={kind:'content',id:'copy',revision:1,path:'value'}
 if(structural)raw.variationPoints=[{id:'weight',label:'Weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string',enum:['normal','bold']}}]
 const snapshot=structuredClone(raw);snapshot.content.title='PREVIOUS PRIVATE SNAPSHOT'
 const source:GroupVariantDocument={format:'template-document',schemaVersion:1,target:'document',source:{mode:'group-variant',group:{id:'family',revision:1},overrides:{content:{title:'LOCAL COPY'},...(structural?{variations:{weight:{kind:'node-style',value:'bold'}}}:{} )}}}
 const effective=materializeFamilyDocument(snapshot,source.source.overrides);effective.source.definition.id='t_variant';effective.source.definition.name='Celebration'
 return {template:{id:'variant',key:'variant',name:'Celebration',groupId:'family',status:'active'},version:1,sourceChecksum:'1'.repeat(64),source,document:effective,family:{id:'family',revisionId:'f1',revision:1,document:snapshot,source:raw},currentRevisionId:null,capabilities:{schemaVersion:1,compilerVersions:['template-platform/1'],sourceModes:['standalone','group-variant'],targets:['document','email'],engines:{bindings:true,shared:true},pdf:false,assetTypes:[],variantOverrides:['content','settingsDefaults','exposedInputs','exposedSettings','variations']},previewAssets:{},issues:[]}
}
let root:Root,container:HTMLDivElement
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(node=>!node.closest('[hidden]')&&(node.textContent?.trim()===label||node.getAttribute('aria-label')===label||[...node.querySelectorAll('[aria-label]')].some(child=>child.getAttribute('aria-label')===label)))!
const samples={facts:{code:'CODE',experience:'Trip',validUntil:'2027'}}

it('restores the raw inherited reference on reset and reauthorizes it instead of exposing a captured family value',async()=>{
 const bootstrap=fixture();const loadResource=vi.fn(async()=>{throw new Error('Resource read no longer allowed.')})
 const repository={load:async()=>bootstrap,loadResource} as unknown as TemplateRepository
 await act(async()=>root.render(<LaravelTemplateScreen id="variant" repository={repository} previewData={samples}/>))
 await act(async()=>button('Reset content Voucher heading').click())
 expect(loadResource).toHaveBeenCalledWith('variant','copy',1,expect.anything())
 expect(container.textContent).toContain('Resource read no longer allowed.')
 expect([...container.querySelectorAll<HTMLIFrameElement>('iframe')].some(frame=>frame.srcdoc.includes('PREVIOUS PRIVATE SNAPSHOT'))).toBe(false)
})

it('compiles a structural variant with raw family authority and its own template identity',async()=>{
 const bootstrap=fixture(true);const saveDraft=vi.fn(async(_id,document,version)=>({document,version:version+1}))
 const repository={load:async()=>bootstrap,saveDraft,publish:async()=>({id:'r',revision:1})} as unknown as TemplateRepository
 await act(async()=>root.render(<LaravelTemplateScreen id="variant" repository={repository} previewData={samples}/>))
 await act(async()=>button('Publish').click())
 const saved=saveDraft.mock.calls[0][1] as GroupVariantDocument
 expect(saved.compiled?.artifacts.html).toContain('<title>Celebration</title>')
 expect(saved.compiled?.artifacts.html).not.toContain('<title>Shared family</title>')
 expect(saved.source.overrides.content?.title).toBe('LOCAL COPY')
})

it('blocks publication and family preparation on a rejected structural input buffer',async()=>{
 const bootstrap=fixture(true)
 for(const document of [bootstrap.family!.source!,bootstrap.family!.document,bootstrap.document!])document.variationPoints![0].schema={type:'string',minLength:4}
 const saveDraft=vi.fn();const publish=vi.fn();const prepareFamilyChange=vi.fn()
 const repository={load:async()=>bootstrap,saveDraft,publish,prepareFamilyChange,listFamilyChanges:async()=>[],listGroups:async()=>[]} as unknown as TemplateRepository
 await act(async()=>root.render(<LaravelTemplateScreen id="variant" repository={repository} previewData={samples}/>))
 await act(async()=>button('Variation points').click())
 const input=container.querySelector<HTMLInputElement>('input[aria-label="Weight"]')!
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'x');input.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))
 expect(input.getAttribute('aria-invalid')).toBe('true')
 await act(async()=>button('Publish').click())
 expect(publish).not.toHaveBeenCalled();expect(saveDraft).not.toHaveBeenCalled()
 await act(async()=>button('More actions').click())
 const familyAction=[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node=>node.textContent?.trim()==='Family changes')!
 await act(async()=>familyAction.click())
 await act(async()=>button('Detach family').click())
 await act(async()=>button('Prepare family change').click())
 expect(prepareFamilyChange).not.toHaveBeenCalled()
 expect(container.textContent).toContain('Fix the highlighted fields')
})
