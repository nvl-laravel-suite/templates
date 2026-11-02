// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { TemplateWorkspace } from './workspace'
import { createExperienceDocument } from './demo-documents'
let root: Root; let container: HTMLDivElement
beforeEach(()=>{ vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); container=document.createElement('div'); document.body.append(container); root=createRoot(container) })
afterEach(()=>{ act(()=>root.unmount()); container.remove(); vi.unstubAllGlobals() })
const facts=(code:string)=>({ facts:{code,experience:'Experience',validUntil:'2027'} })
const customer=()=>container.querySelector<HTMLElement>('[data-template-workspace-mode="personalize"]')!
it('hydrates changed host facts without discarding local inputs or their history', async()=>{
 const document=createExperienceDocument()
 await act(async()=>root.render(<TemplateWorkspace initialDocument={document} mode="personalize" previewData={facts('FIRST')} />))
 const input=customer().querySelector<HTMLInputElement>('input[aria-label^="Recipient"]')!
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Changed');input.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))
 await act(async()=>root.render(<TemplateWorkspace initialDocument={document} mode="personalize" previewData={facts('SECOND')} />))
 const frame=customer().querySelector<HTMLIFrameElement>('iframe')!
 expect(frame.srcdoc).toContain('SECOND');expect(frame.srcdoc).not.toContain('FIRST');expect(input.value).toBe('Changed')
 const undo=customer().querySelector<HTMLButtonElement>('[aria-label="Undo personalization"]')!
 expect(undo.disabled).toBe(false);await act(async()=>undo.click());expect(frame.srcdoc).toContain('SECOND')
})
it('shows the effective template default and returns to it on reset',async()=>{
 const document=createExperienceDocument();document.settingsDefaults.message_size=20
 await act(async()=>root.render(<TemplateWorkspace initialDocument={document} mode="personalize" previewData={facts('ABC')} initialSettings={{message_size:22}} />))
 expect(customer().querySelector<HTMLInputElement>('input[aria-label="Message size"]')?.value).toBe('22')
 await act(async()=>customer().querySelector<HTMLButtonElement>('[aria-label="Reset Message size"]')!.click())
 expect(customer().querySelector<HTMLInputElement>('input[aria-label="Message size"]')?.value).toBe('20')
 expect(customer().querySelector<HTMLIFrameElement>('iframe')!.srcdoc).toContain('font-size:20px')
})
it('starts a different document as a new local editing session',async()=>{
 const a=createExperienceDocument(); const b=structuredClone(a);b.source.definition.id='other';b.source.definition.name='Other template';b.content.title='Other title'
 await act(async()=>root.render(<TemplateWorkspace initialDocument={a} />))
 await act(async()=>root.render(<TemplateWorkspace initialDocument={b} />))
 expect(container.querySelector('[data-template-workspace-mode="design"] h1')?.textContent).toBe('Other template')
 expect(container.querySelector<HTMLIFrameElement>('[data-template-workspace-mode="design"] iframe')!.srcdoc).toContain('Other title')
})
