// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createExperienceDocument } from './demo-documents'
import { GroupVariantWorkspace } from './variant-workspace'
import { materializeFamilyDocument } from './catalog'
import type { GroupVariantDocument } from './types'
let root:Root, container:HTMLDivElement
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(node=>!node.closest('[hidden]')&&(node.textContent?.trim()===label||node.getAttribute('aria-label')===label))!
const raw=():GroupVariantDocument=>({format:'template-document',schemaVersion:1,target:'document',source:{mode:'group-variant',group:{id:'family',revision:1},overrides:{}}})
it('selects a variation in the inspector and preserves an invalid buffer while switching points',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'weight',label:'Message weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string',minLength:4}},{id:'name',label:'Message label',kind:'node-property',nodeId:'personal_message',property:'name',schema:{type:'string'}}]
 const onDraftChange=vi.fn(),onExport=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace familyDocument={family} effectiveDocument={family} initialDocument={raw()} onDraftChange={onDraftChange} onExport={onExport}/>))
 await act(async()=>button('Variation points').click())
 expect(button('Edit variation Message weight')).toBeDefined()
 const input=container.querySelector<HTMLInputElement>('[aria-label="Template inspector"] input[aria-label="Message weight"]')!;expect(input).not.toBeNull()
 await changeScalar(input,'x')
 await act(async()=>button('Edit variation Message label').click())
 expect(input.closest('[hidden]')).not.toBeNull()
 expect(button('Edit variation Message weight').textContent).toContain('Needs attention')
 await act(async()=>button('Export variant').click());expect(onExport).not.toHaveBeenCalled()
 await act(async()=>button('Edit variation Message weight').click())
 expect(input.closest('[hidden]')).toBeNull();expect(input.value).toBe('x');expect(input.getAttribute('aria-invalid')).toBe('true')
 await changeScalar(input,'bold')
 expect(button('Edit variation Message weight').textContent).not.toContain('Needs attention')
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.weight).toEqual({kind:'node-style',value:'bold'})
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.name).toBeUndefined()
 await act(async()=>button('Export variant').click());expect(onExport).toHaveBeenCalledOnce()
})
it('reveals and focuses an invalid retained variation from readiness after switching points and tools',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'weight',label:'Message weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string',minLength:4}},{id:'name',label:'Footer label',kind:'node-property',nodeId:'terms_text',property:'name',schema:{type:'string'}}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace familyDocument={family} effectiveDocument={family} initialDocument={raw()} onDraftChange={onDraftChange}/>))
 const input=container.querySelector<HTMLInputElement>('[aria-label="Template inspector"] input[aria-label="Message weight"]')!
 await changeScalar(input,'x')
 await act(async()=>button('Edit variation Footer label').click())
 expect(input.closest('[hidden]')).not.toBeNull()
 await act(async()=>button('Content').click())
 await act(async()=>button('1 field needs attention').click())
 await vi.waitFor(()=>expect(input.closest('[hidden], [inert]')).toBeNull())
 await vi.waitFor(()=>expect(document.activeElement).toBe(input))
 expect(button('Edit variation Message weight').getAttribute('aria-pressed')).toBe('true')
 expect(container.querySelector('[aria-label="Template inspector"]')?.textContent).toContain('Message weight')
 expect(input.value).toBe('x');expect(input.getAttribute('aria-invalid')).toBe('true')
 expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({})
})
it('edits complete structured text parts with the existing JSON commit control',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'footer-parts',label:'Footer parts',kind:'node-property',nodeId:'terms_text',property:'parts',schema:{type:'array',items:{type:'object',properties:{value:{type:'object',properties:{source:{type:'string',enum:['literal']},value:{type:'string'}},required:['source','value'],additionalProperties:false},format:{type:'string'},currency:{type:'string'}},required:['value','format','currency'],additionalProperties:false}}}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 const input=container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Footer parts"]')!
 expect(input).not.toBeNull()
 const parts=[{value:{source:'literal',value:'Variant terms'},format:'text',currency:'EUR'},{value:{source:'literal',value:' — Added part'},format:'text',currency:'EUR'}]
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,JSON.stringify(parts));input.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations['footer-parts'].value).toEqual(parts)
 expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!.srcdoc).toContain('Added part')
})
it('uses the existing creator for declared structural regions and persists only the structural delta',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'sections',label:'Additional sections',kind:'children',target:{kind:'roots'},minItems:1,maxItems:4,requiredIds:['voucher'],allowedKinds:['element','text']}]
 const initialDocument=raw();const onDraftChange=vi.fn()
 await act(async()=>root.render(<GroupVariantWorkspace familyDocument={family} effectiveDocument={family} initialDocument={initialDocument} onDraftChange={onDraftChange}/>))
 expect(button('Structure')).toBeDefined()
 await act(async()=>button('Structure').click())
 await act(async()=>button('Add section').click())
 const saved=onDraftChange.mock.lastCall?.[0] as GroupVariantDocument
 expect(saved.source.overrides.variations?.sections).toMatchObject({kind:'children',order:['voucher',expect.any(String)]})
 expect(saved).not.toHaveProperty('source.definition');expect(family.source.definition.roots).toEqual(['voucher'])
 await act(async()=>button('Undo').click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})
it('locks inherited structure, uses its allowed style in both previews, and resets the raw override',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'weight',label:'Message weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string',enum:['normal','bold']}}]
 const initialDocument=raw();initialDocument.source.overrides.variations={weight:{kind:'node-style',value:'bold'}}
 await act(async()=>root.render(<GroupVariantWorkspace familyDocument={family} effectiveDocument={materializeFamilyDocument(family,initialDocument.source.overrides)} initialDocument={initialDocument}/>))
 await act(async()=>button('Structure').click())
 expect(button('Add section').disabled).toBe(true)
 expect(container.querySelector<HTMLInputElement>('[data-variant-mode="staff"] input[type="file"]')?.disabled).toBe(true)
 expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!.srcdoc).toContain('font-weight:bold')
 await act(async()=>button('Variation points').click())
 await act(async()=>button('Reset variation Message weight').click())
 expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!.srcdoc).not.toContain('font-weight:bold')
 await act(async()=>button('Customer preview').click())
 expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="customer"] iframe')!.srcdoc).not.toContain('font-weight:bold')
})

async function changeScalar(input: HTMLInputElement, value: string) { await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}))); }
it('marks a rejected variation field invalid and blocks export',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'weight',label:'Message weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string',minLength:4}}];
 const onExport=vi.fn();const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange} onExport={onExport}/>));
 await act(async()=>button('Variation points').click());
 const input=container.querySelector<HTMLInputElement>('input[aria-label="Message weight"]')!; await changeScalar(input,'x');
  expect(input.getAttribute('aria-invalid')).toBe('true');
 await act(async()=>button('Export variant').click());expect(onExport).not.toHaveBeenCalled();
 await changeScalar(input,'bold');expect(input.getAttribute('aria-invalid')).toBe('false');await act(async()=>button('Export variant').click());expect(onExport).toHaveBeenCalledOnce();
});
it('can set a declared block property that inherits the registered block default',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json'); const family=structuredClone(fixture.default.base) as import('./types').BindingDocument;family.variationPoints=family.variationPoints!.filter(point=>point.kind==='block-property');
 const block=family.source.definition.blocks.find(block=>block.id==='card')!;block.propertyMetadata={caption:{label:'Caption',description:'',defaultValue:'DEFAULT CAPTION'}};const card=family.source.definition.nodes.card;if(card.kind==='block')card.props={};
 materializeFamilyDocument(family,{});
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>));
 await act(async()=>button('Variation points').click());
 const input=container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Static text"]')!;
 expect(input.value).toBe('DEFAULT CAPTION');expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({});
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Local caption');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.caption).toMatchObject({kind:'block-property',value:{source:'literal',value:'Local caption'}});
 await act(async()=>button('Reset variation Caption').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined();expect(input.value).toBe('DEFAULT CAPTION');
});
it('retains deliberate family-equivalent override until Reset',async()=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'title-name',label:'Title name',kind:'node-property',nodeId:'personal_message',property:'name',schema:{type:'string'}}];
 const original=family.source.definition.nodes.personal_message.name;
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>));
 await act(async()=>button('Variation points').click());const input=container.querySelector<HTMLInputElement>('input[aria-label="Title name"]')!;
 await changeScalar(input,'Local name');expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.['title-name']).toBeTruthy();
 await changeScalar(input,original);
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.['title-name']).toEqual({kind:'node-property',value:original});expect(button('Reset variation Title name').disabled).toBe(false);
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.['title-name'].value).toBe('Local name')
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
 await act(async()=>button('Redo').click());await act(async()=>button('Redo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.['title-name']).toEqual({kind:'node-property',value:original})
});
it('adds, reorders and removes block-slot children through canonical creator history',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 family.variationPoints=family.variationPoints!.filter(point=>point.kind==='children'&&point.target.kind==='block-slot')
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 expect(button('Add text to Card body')).toBeDefined()
 await act(async()=>button('Add text to Card body').click());await act(async()=>button('Add text to Card body').click())
 const saved=onDraftChange.mock.lastCall?.[0] as GroupVariantDocument;const patch=saved.source.overrides.variations!.body
 expect(patch.kind).toBe('children');if(patch.kind!=='children')throw new Error('Expected ordered slot children')
 const [first,second]=patch.order;expect(patch.order).toHaveLength(2);expect(patch.nodes?.[first].kind).toBe('text')
 await act(async()=>button('Move Card body item 2 up').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.body.order).toEqual([second,first])
 await act(async()=>button('Remove Card body item 1').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.body.order).toEqual([first])
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.body.order).toEqual([second,first])
 await act(async()=>button('Reset variation Card body').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
 expect(materializeFamilyDocument(family,saved.source.overrides).source.definition.nodes.card).toMatchObject({slots:{body:[first,second]}})
})
it('replaces an approved placement kind and block identity while retaining its canonical id',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 family.variationPoints=[{id:'replacement',label:'Footer replacement',kind:'placement',nodeId:'footer',allowedKinds:['element','text','block'],allowedBlocks:[{id:'card',version:1}]}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 expect(button('Replace Footer replacement with text')).toBeDefined()
 await act(async()=>button('Replace Footer replacement with text').click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.replacement.node).toMatchObject({id:'footer',kind:'text'})
 await act(async()=>button('Replace Footer replacement with Card v1').click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.replacement.node).toMatchObject({id:'footer',kind:'block',blockId:'card',version:1})
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.replacement.node.kind).toBe('text')
 await act(async()=>button('Reset variation Footer replacement').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})
it('enforces slot cardinality and required placements before a guarded history change',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 const child=structuredClone(family.source.definition.nodes.first);child.id='slotcopy';family.source.definition.nodes.slotcopy=child
 const card=family.source.definition.nodes.card;if(card.kind==='block')card.slots.body=['slotcopy']
 family.variationPoints=[{id:'body',label:'Card body',kind:'children',target:{kind:'block-slot',nodeId:'card',slot:'body'},minItems:1,maxItems:2,requiredIds:['slotcopy'],allowedKinds:['text']}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click());expect(button('Remove Card body item 1').disabled).toBe(true)
 await act(async()=>button('Add text to Card body').click());expect(button('Add text to Card body').disabled).toBe(true)
 expect(button('Remove Card body item 1').disabled).toBe(true);expect(button('Remove Card body item 2').disabled).toBe(false)
 await act(async()=>button('Remove Card body item 2').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
 expect(button('Undo').disabled).toBe(false);expect(button('Remove Card body item 1').disabled).toBe(true)
})
it('offers only registered blocks approved by a placement declaration',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 const blocked={...structuredClone(family.source.definition.blocks[0]),id:'unapproved',name:'Unapproved card'};family.source.definition.blocks.push(blocked)
 family.variationPoints=[{id:'replacement',label:'Footer replacement',kind:'placement',nodeId:'footer',allowedKinds:['element','block'],allowedBlocks:[{id:'card',version:1}]}]
 await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family}/>))
 await act(async()=>button('Variation points').click());expect(button('Replace Footer replacement with Card v1')).toBeDefined();expect(button('Replace Footer replacement with Unapproved card v1')).toBeUndefined()
})
it('lets a block property select an approved registered asset source',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 family.source.definition.assets=[{id:'logo',name:'Logo',kind:'image',mimeType:'image/png',url:'https://example.com/logo.png'}]
 family.variationPoints=[{id:'caption',label:'Card caption',kind:'block-property',nodeId:'card',property:'caption',allowedSources:['literal','asset']}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 const source=container.querySelector<HTMLElement>('[aria-label="Value source"]')!;await act(async()=>source.click())
 const asset=[...document.querySelectorAll<HTMLElement>('[role=option]')].find(node=>node.textContent?.trim()==='Asset')
 expect(asset).toBeDefined();await act(async()=>asset!.click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.caption.value).toEqual({source:'asset',assetId:'logo'})
})
it('retains an explicitly emptied block slot and resets it to inherited fallback',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 family.variationPoints=family.variationPoints!.filter(point=>point.kind==='children'&&point.target.kind==='block-slot')
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click());await act(async()=>button('Add text to Card body').click());await act(async()=>button('Remove Card body item 1').click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations?.body).toEqual({kind:'children',order:[]})
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.body.order).toHaveLength(1)
 await act(async()=>button('Reset variation Card body').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})
it('sets a bounded numeric block property from raw omission with a typed buffered input',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 const block=family.source.definition.blocks.find(item=>item.id==='card')!;block.props.caption={type:'number',minimum:2};block.requiredProps=[]
 const card=family.source.definition.nodes.card;if(card.kind==='block')card.props={}
 family.variationPoints=[{id:'caption',label:'Card count',kind:'block-property',nodeId:'card',property:'caption',allowedSources:['literal']}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 const input=container.querySelector<HTMLInputElement>('input[aria-label="Static value"]')!;expect(input).not.toBeNull()
 await changeScalar(input,'1');expect(input.getAttribute('aria-invalid')).toBe('true');expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({})
 await changeScalar(input,'3');expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.caption.value).toEqual({source:'literal',value:3})
 await act(async()=>button('Reset variation Card count').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})
it('allows a constrained block binding to switch to a literal without committing an invalid placeholder',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 const block=family.source.definition.blocks.find(item=>item.id==='card')!;block.props.caption={type:'string',minLength:2}
 family.source.definition.fields=[{id:'caption',path:'content.caption',label:'Caption',description:'',schema:{type:'string',minLength:2},required:true,editable:false,defaultValue:'Inherited'}];family.content={caption:'Inherited'};family.dataSchema.properties.content={type:'object',properties:{caption:{type:'string',minLength:2}},required:['caption'],additionalProperties:false}
 const card=family.source.definition.nodes.card;if(card.kind==='block')card.props.caption={source:'field',fieldId:'caption'}
 family.variationPoints=[{id:'caption',label:'Card caption',kind:'block-property',nodeId:'card',property:'caption',allowedSources:['field','literal']}]
 const onDraftChange=vi.fn();const onExport=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange} onExport={onExport}/>))
 await act(async()=>button('Variation points').click());await act(async()=>container.querySelector<HTMLElement>('[aria-label="Value source"]')!.click())
 const option=[...document.querySelectorAll<HTMLElement>('[role=option]')].find(node=>node.textContent?.trim()==='Static value')!;await act(async()=>option.click())
 const input=container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Static text"]')!;expect(input).not.toBeNull();expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({})
 await act(async()=>button('Export variant').click());expect(onExport).not.toHaveBeenCalled()
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Local caption');input.dispatchEvent(new Event('input',{bubbles:true}))});await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.caption.value).toEqual({source:'literal',value:'Local caption'})
 await act(async()=>button('Export variant').click());expect(onExport).toHaveBeenCalledOnce()
})

it.each(['children','placement'] as const)('blocks %s block creation while staged buffered properties are invalid',async kind=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 family.source.definition.blocks[0].props.caption={type:'string',minLength:2}
 family.variationPoints=kind==='children'?[{id:'region',label:'Content',kind:'children',target:{kind:'children',nodeId:'region'},minItems:0,maxItems:4,allowedKinds:['text','block']}]:[{id:'replacement',label:'Footer replacement',kind:'placement',nodeId:'footer',allowedKinds:['element','block'],allowedBlocks:[{id:'card',version:1}]}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click())
 const input=container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Static text"]')!
 const change=async(value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))});await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))}
 await change('x');expect(input.getAttribute('aria-invalid')).toBe('true')
 const action=()=>button(kind==='children'?'Add Card v1 to Content':'Replace Footer replacement with Card v1')
 await act(async()=>action().click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({});expect(button('Undo').disabled).toBe(true)
 await change('Valid card');await act(async()=>action().click())
 const patch=onDraftChange.mock.lastCall?.[0].source.overrides.variations[kind==='children'?'region':'replacement']
 const node=kind==='children'?patch.nodes[patch.order.at(-1)]:patch.node
 expect(node).toMatchObject({kind:'block',props:{caption:{source:'literal',value:'Valid card'}}})
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})

it('can insert a block with an omitted typed metadata default after correcting its staged input',async()=>{
 const fixture=await import('../../scripts/fixtures/family-structure.v1.json');const family=structuredClone(fixture.default.base) as import('./types').BindingDocument
 const block=family.source.definition.blocks[0];block.props.caption={type:'number',minimum:2};block.propertyMetadata={caption:{label:'Count',description:'',defaultValue:2}}
 const card=family.source.definition.nodes.card;if(card.kind==='block')card.props={}
 family.variationPoints=[{id:'region',label:'Content',kind:'children',target:{kind:'children',nodeId:'region'},minItems:0,maxItems:4,allowedKinds:['text','block']}]
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={raw()} effectiveDocument={family} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click());const input=container.querySelector<HTMLInputElement>('input[aria-label="Static value"]')!;expect(input.value).toBe('2')
 await changeScalar(input,'1');await act(async()=>button('Add Card v1 to Content').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({})
 await changeScalar(input,'4');await act(async()=>button('Add Card v1 to Content').click())
 const patch=onDraftChange.mock.lastCall?.[0].source.overrides.variations.region;expect(patch.nodes[patch.order.at(-1)]).toMatchObject({kind:'block',props:{caption:{source:'literal',value:4}}})
})

it.each([false,true])('restores raw property authority through Undo, Redo and Reset (initially explicit: %s)',async initiallyExplicit=>{
 const family=createExperienceDocument();family.variationPoints=[{id:'name',label:'Title name',kind:'node-property',nodeId:'personal_message',property:'name',schema:{type:'string'}}]
 const original=family.source.definition.nodes.personal_message.name;const initialDocument=raw()
 if(initiallyExplicit)initialDocument.source.overrides.variations={name:{kind:'node-property',value:original}}
 const onDraftChange=vi.fn();await act(async()=>root.render(<GroupVariantWorkspace initialDocument={initialDocument} effectiveDocument={materializeFamilyDocument(family,initialDocument.source.overrides)} familyDocument={family} onDraftChange={onDraftChange}/>))
 await act(async()=>button('Variation points').click());const input=container.querySelector<HTMLInputElement>('input[aria-label="Title name"]')!
 await changeScalar(input,'Local name');await act(async()=>button('Undo').click())
 expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toEqual(initiallyExplicit?{name:{kind:'node-property',value:original}}:undefined)
 await act(async()=>button('Redo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.name.value).toBe('Local name')
 await act(async()=>button('Reset variation Title name').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
 await act(async()=>button('Undo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations.name.value).toBe('Local name')
 await act(async()=>button('Redo').click());expect(onDraftChange.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
})
