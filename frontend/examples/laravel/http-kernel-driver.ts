import { createInterface } from 'node:readline'
import assert from 'node:assert/strict'
import { compileFamilyVariant, hydrateTemplateDraft, recompileTemplateDocument, TemplateNodeSchema, type GroupVariantDocument, type StandaloneTemplateDraft, type TemplateSourceDocument } from '@nicolasvlachos/voucher-builder/template-renderer'
import { createLaravelTemplateRepository, TemplateRequestError } from './repository'
import { createTemplateSession } from './session'
import type { EditorBootstrap } from './contracts'
import { resolveReusableContent } from './resources'

const config = JSON.parse(process.argv[2]) as { templateId:string; variantId:string; groupId:string; otherGroupId:string; familyResourceId:string; resourceId:string }
const pending = new Map<number, { resolve:(r:Response)=>void }>(); let serial=0
createInterface({input:process.stdin}).on('line', line => {
 const value=JSON.parse(line); pending.get(value.id)?.resolve(new Response(value.body,{status:value.status,headers:{'Content-Type':'application/json'}}));pending.delete(value.id)
})
const request:typeof fetch=async(input,init)=>new Promise<Response>(resolve=>{
 const id=++serial;pending.set(id,{resolve});process.stdout.write(JSON.stringify({type:'request',id,url:String(input),method:init?.method??'GET',body:init?.body})+'\n')
})
const repository=createLaravelTemplateRepository('http://localhost/api/templates',request)
try {
 const compile=(source:TemplateSourceDocument,_caps:unknown,bootstrap:EditorBootstrap)=>source.source.mode==='standalone'?recompileTemplateDocument(hydrateTemplateDraft(source as StandaloneTemplateDraft),source.source.definition):compileFamilyVariant(bootstrap.family!.source??bootstrap.family!.document,source as GroupVariantDocument,{id:bootstrap.document!.source.definition.id,name:bootstrap.template.name})
 const session=createTemplateSession({repository,compile})
 await session.load(config.templateId)
 assert.equal(session.getState().source?.source.mode,'standalone')
 const source=structuredClone(session.getState().source!) as StandaloneTemplateDraft
 if(source.source.mode!=='standalone')throw new Error('Expected standalone')
 source.source.definition.fields.push({id:'headline',path:'content.headline',label:'Heading',schema:{type:'string'},required:true,editable:false,description:'',defaultValue:'Fallback'})
 source.source.definition.nodes.heading=TemplateNodeSchema.parse({id:'heading',kind:'text',name:'Heading',parts:[{value:{source:'field',fieldId:'headline'}}]})
 source.source.definition.roots.push('heading')
 source.content.headline={kind:'content',id:config.resourceId,revision:1,path:'heading'}
 const resources=await repository.listResources(config.templateId)
 assert.equal(resources.find(r=>r.id===config.resourceId)?.document && true,true)
 const previewContent=await resolveReusableContent(config.templateId,source.content,repository)
 assert.equal(previewContent.headline,'PINNED CONTENT')
 const asset=await repository.importAsset({name:'Logo',source:'fixtures',key:'logo.png'})
 assert.match(asset.previewUrl,/\/assets\/.*\/content$/)
 source.managedAssets={logo:asset.id}
 source.source.definition.assets.push({id:'logo',name:'Logo',kind:'image',mimeType:asset.mimeType,url:asset.previewUrl})
 source.source.definition.nodes.logo=TemplateNodeSchema.parse({id:'logo',name:'Logo',kind:'element',tag:'img',attributeBindings:{src:{source:'asset',assetId:'logo'}}})
 source.source.definition.roots.push('logo')
 source.inputDefaults.message='Saved through real adapter'
 session.change(source)
 await session.save()
 assert.equal(session.getState().dirty,false)
 let loaded=await repository.load(config.templateId)
 assert.equal(loaded.version,2)
 assert.equal(loaded.source?.source.mode,'standalone')
 assert.equal((loaded.source as typeof source).artifacts,undefined)
 assert.equal((loaded.source as typeof source).content.headline && typeof (loaded.source as typeof source).content.headline,'object')
 const preview=await session.preview({facts:{code:'PREVIEW'}})
 assert.match(preview!.html,/PINNED CONTENT/)
 const release=await session.publish();assert.ok(release?.id)
 const prepared=await repository.preparePublished(release.id,{owner:{id:'allowed'}})
 assert.equal((prepared.data.facts as Record<string,unknown>).code,'BACKEND FACT')
 assert.equal(prepared.previewAssets.logo,asset.previewUrl)
 const result=await repository.render(release.id,{owner:{id:'allowed'},inputs:{message:'Rendered customer value'}})
 assert.match(result.html,/BACKEND FACT/);assert.match(result.html,/Rendered customer value/);assert.match(result.html,/PINNED CONTENT/);assert.match(result.html,/data:image\/png;base64/)
 await assert.rejects(repository.saveDraft(config.templateId,source,1),(error:unknown)=>error instanceof TemplateRequestError&&error.status===409)
 loaded=await repository.load(config.templateId);assert.equal(loaded.version,3)
 const family=await repository.loadGroupRevision(config.groupId,1);assert.equal(family.revision,1)
 const variant=createTemplateSession({repository,compile});await variant.load(config.variantId)
 const grouped=structuredClone(variant.getState().source!)
 assert.equal(grouped.source.mode,'group-variant')
 if(grouped.source.mode!=='group-variant')throw new Error('Expected variant')
 grouped.source.overrides.settingsDefaults={textSize:20};grouped.source.overrides.variations={weight:{kind:'node-style',value:'bold'}};variant.change(grouped)
 await variant.save(); const groupedRelease=await variant.publish();assert.ok(groupedRelease?.id)
 const groupedLoad=await repository.load(config.variantId)
 assert.equal(groupedLoad.source?.source.mode,'group-variant');assert.equal(groupedLoad.family?.revision,1)
 assert.ok(groupedLoad.family?.source)
 assert.equal(typeof groupedLoad.family.source.content.retained,'object')
 assert.equal((await resolveReusableContent(config.variantId,groupedLoad.family.source.content,repository)).retained,'Family resource')
 const groupedResult=await repository.render(groupedRelease.id,{owner:{id:'allowed'}})
 assert.ok(groupedResult.html.includes(`<title>${groupedLoad.template.name}</title>`))
 assert.match(groupedResult.html,/font-size:20px/);assert.match(groupedResult.html,/font-weight:bold/)
 // A family publication creates a persisted, reviewable upgrade without changing old releases.
 const familySource=structuredClone(family.source??family.document)
 const message=familySource.source.definition.nodes.message
 if(message.kind!=='element')throw new Error('Expected message element')
 message.style['font-weight']='normal'
 const familyTwo=recompileTemplateDocument(hydrateTemplateDraft(familySource),familySource.source.definition)
 await repository.publishGroup(config.groupId,familyTwo,1)
 const automatic=await repository.listFamilyChanges(config.variantId)
 const upgrade=automatic.find(item=>item.operation==='upgrade'&&item.targetRevision===2)!
 assert.ok(upgrade?.id);assert.ok(upgrade.conflicts.some(item=>item.id==='variations.weight'))
 const beforeUpgrade=await repository.load(config.variantId)
 const resolutions=Object.fromEntries(upgrade.conflicts.map(item=>[item.id,item.localAllowed?'local':'family'])) as Record<string,'local'|'family'>
 const reviewed=await repository.reviewFamilyChange(config.variantId,upgrade.id,{resolutions,expectedVersion:beforeUpgrade.version,sourceChecksum:beforeUpgrade.sourceChecksum!})
 assert.equal((reviewed.source as GroupVariantDocument).source.overrides.variations?.weight.kind,'node-style')
 await repository.applyFamilyChange(config.variantId,upgrade.id,{resolutions,expectedVersion:beforeUpgrade.version,sourceChecksum:beforeUpgrade.sourceChecksum!})
 let changed=await repository.load(config.variantId)
 assert.equal(changed.template.groupId,config.groupId);assert.equal(changed.family?.revision,2)
 await variant.load(config.variantId);await variant.publish()
 // Explicit rebase uses the requested revision, even when other candidates exist.
 familyTwo.inputDefaults.message='Family revision three'
 await repository.publishGroup(config.groupId,recompileTemplateDocument(familyTwo,familyTwo.source.definition),2)
 changed=await repository.load(config.variantId)
 const rebase=await repository.prepareFamilyChange(config.variantId,{operation:'rebase',target:{groupId:config.groupId,revision:3},expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 await repository.applyFamilyChange(config.variantId,rebase.id,{resolutions:Object.fromEntries(rebase.conflicts.map(item=>[item.id,item.localAllowed?'local':'family'])) as Record<string,'local'|'family'>,expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 await variant.load(config.variantId);await variant.publish()
 // Detach copies group-private closure into template scope, retaining active membership until publish.
 changed=await repository.load(config.variantId)
 const detach=await repository.prepareFamilyChange(config.variantId,{operation:'detach',expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 assert.equal(detach.conflicts.length,0)
 await repository.applyFamilyChange(config.variantId,detach.id,{resolutions:{},expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 changed=await repository.load(config.variantId)
 assert.equal(changed.source?.source.mode,'standalone');assert.equal(changed.template.groupId,config.groupId);assert.equal(changed.proposedGroupId,null)
 const copied=await repository.listResources(config.variantId)
 assert.ok(copied.some(item=>item.scope==='template'&&item.name==='Family retained copy'))
 assert.ok(!copied.some(item=>item.id===config.familyResourceId))
 await variant.load(config.variantId);await variant.publish()
 changed=await repository.load(config.variantId);assert.equal(changed.template.groupId,null)
 const oldAfterDetach=await repository.render(groupedRelease.id,{owner:{id:'allowed'}})
 assert.equal(oldAfterDetach.html,groupedResult.html)
 // Regroup requires explicit adoption where the target family cannot represent the old graph/sidecars.
 const regroup=await repository.prepareFamilyChange(config.variantId,{operation:'regroup',target:{groupId:config.otherGroupId,revision:1},expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 await repository.applyFamilyChange(config.variantId,regroup.id,{resolutions:Object.fromEntries(regroup.conflicts.map(item=>[item.id,'family'])) as Record<string,'family'>,expectedVersion:changed.version,sourceChecksum:changed.sourceChecksum!})
 changed=await repository.load(config.variantId);assert.equal(changed.template.groupId,null);assert.equal(changed.family?.id,config.otherGroupId)
 await variant.load(config.variantId);await variant.publish()
 changed=await repository.load(config.variantId);assert.equal(changed.template.groupId,config.otherGroupId)
 assert.equal((await repository.render(groupedRelease.id,{owner:{id:'allowed'}})).html,groupedResult.html)
 process.stdout.write(JSON.stringify({type:'done',requests:serial})+'\n');process.exit(0)
}catch(error){process.stdout.write(JSON.stringify({type:'failed',message:error instanceof Error?error.stack+' '+JSON.stringify((error as {issues?:unknown}).issues):String(error)})+'\n');process.exit(1)}
