import { expect, it } from 'vitest'
import cases from '../../scripts/fixtures/presentation-styles.v1.json'
import { presentationStyle } from './settings'
for (const sample of cases) it(`portable ${sample.property}: ${sample.value}`,()=>{
 const field={id:'setting',label:'Setting',schema:{type:'string' as const},defaultValue:sample.value,exposed:true,unit:sample.unit as 'px'|undefined,targets:[{nodeId:'node',property:sample.property}]}
 if(sample.invalid) expect(()=>presentationStyle(field,sample.value)).toThrow()
 else expect(presentationStyle(field,sample.value)).toBe(sample.output)
})
