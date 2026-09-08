import { describe,it,expect } from 'vitest';
import { ChudnovskyEngine } from '../src/pi/Chudnovsky';
import { findText,findGrid } from '../src/search/search';
import { PALETTE,toLetters,twoColor } from '../src/modes/transforms';
describe('Chudnovsky engine',()=>{it('returns known Pi prefix using BigInt integer arithmetic',()=>expect(new ChudnovskyEngine().calculate(30).digits).toBe('3141592653589793238462643383279'));});
describe('number and text search',()=>{it('finds overlapping sequences',()=>expect(findText('1111','11').map(x=>x.index)).toEqual([0,1,2]));it('reports no match',()=>expect(findText('123','9')).toEqual([]));});
describe('letter and palettes',()=>{it('maps pair values with space and wrap',()=>expect(toLetters('010226272800')).toBe('ABZAB '));it('maps all fixed colors',()=>expect(PALETTE).toEqual(['#000000','#172B8F','#5C7BC7','#4FA3D1','#00D95A','#FFE500','#FFB900','#F28C00','#F0180D','#F020E8']));it('maps binary ranges',()=>{expect('01234'.split('').every(d=>twoColor(d)==='#000000')).toBe(true);expect('56789'.split('').every(d=>twoColor(d)==='#ffffff')).toBe(true);});});
describe('grid pattern searches',()=>{it('finds exact and overlapping binary grid matches with coordinates',()=>expect(findGrid('595959595',3,['11','11'],true).map(m=>[m.x,m.y])).toEqual([[0,0],[1,0],[0,1],[1,1]]));it('handles an exact digit grid and no match',()=>{expect(findGrid('12341234',4,['23']).map(m=>m.x)).toEqual([1,1]);expect(findGrid('1234',2,['99'])).toEqual([]);});});
