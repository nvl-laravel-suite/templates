// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@nicolasvlachos/voucher-builder/template-creator',async()=>import('../../src/template-creator'))
vi.mock('@nicolasvlachos/voucher-builder/template-renderer',async()=>import('../../src/template-renderer'))
import { LaravelPublishedTemplateScreen } from '../laravel-published-host'
import { createExperienceDocument } from '../../src/template-platform/demo-documents'
import type { PreparedPublishedTemplate, TemplateRepository } from './contracts'
const prepared=(revisionId:string):PreparedPublishedTemplate=>({revisionId,document:createExperienceDocument(),data:{facts:{code:revisionId,experience:'Trip',validUntil:'2027'},inputs:{recipient:'Saved recipient',message:'Saved message'},settings:{message_size:22,message_alignment:'center'},content:{brand:'BRAND',title:'TITLE'}},previewAssets:{}})
let root:Root,container:HTMLDivElement
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('opens only the prepared published customer route and hydrates owner values/settings',async()=>{
 const preparePublished=vi.fn(async(id:string)=>prepared(id));const onChange=vi.fn()
 const repository={preparePublished} as unknown as TemplateRepository
 await act(async()=>root.render(<StrictMode><LaravelPublishedTemplateScreen revisionId="release" repository={repository} owner={{id:'order'}} initialInputs={{recipient:'Saved recipient'}} initialSettings={{message_size:22}} onPersonalizationChange={onChange}/></StrictMode>))
 expect(preparePublished).toHaveBeenLastCalledWith('release',{owner:{id:'order'},inputs:{recipient:'Saved recipient'},settings:{message_size:22}},{signal:expect.any(AbortSignal)})
 const customer=container.querySelector('[data-template-workspace-mode="personalize"]')!
 expect(customer.querySelector<HTMLInputElement>('input[aria-label^="Recipient"]')?.value).toBe('Saved recipient')
 expect(customer.querySelector<HTMLInputElement>('input[aria-label="Message size"]')?.value).toBe('22')
 expect(customer.querySelector<HTMLIFrameElement>('iframe')?.srcdoc).toContain('release')
 await act(async()=>customer.querySelector<HTMLButtonElement>('[aria-label="Reset Message size"]')!.click())
 expect(onChange.mock.lastCall?.[0]).toEqual({inputs:{recipient:'Saved recipient',message:'Saved message'},settings:{}})
})
it('suppresses delayed published preparation after a revision/owner change',async()=>{
 let oldResolve!:(value:PreparedPublishedTemplate)=>void
 const repository={preparePublished:vi.fn(async(id:string)=>id==='old'?new Promise<PreparedPublishedTemplate>(yes=>oldResolve=yes):prepared(id))} as unknown as TemplateRepository
 await act(async()=>root.render(<LaravelPublishedTemplateScreen revisionId="old" repository={repository} owner={{id:'one'}}/>))
 await act(async()=>root.render(<LaravelPublishedTemplateScreen revisionId="new" repository={repository} owner={{id:'two'}}/>))
 await act(async()=>oldResolve(prepared('old')))
 const frame=container.querySelector<HTMLIFrameElement>('[data-template-workspace-mode="personalize"] iframe')!
 expect(frame.srcdoc).toContain('new');expect(frame.srcdoc).not.toContain('>old<')
})
