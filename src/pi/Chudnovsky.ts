import type { PiEngine, PiProgress, PiResult } from './types';
const C3_OVER_24=10939058860032000n;
function isqrt(n:bigint):bigint{let x=n;if(n<2n)return n;let y=(x+1n)>>1n;while(y<x){x=y;y=(x+n/x)>>1n;}return x;}
interface Split{p:bigint;q:bigint;t:bigint}
/** Exact integer binary-splitting Chudnovsky calculation (about 14.18 digits/term). */
export class ChudnovskyEngine implements PiEngine{
 calculate(decimalDigits:number,onProgress?:(p:PiProgress)=>void):PiResult{if(!Number.isSafeInteger(decimalDigits)||decimalDigits<1)throw new Error('Digits must be a positive integer.');const began=performance.now(),terms=Math.ceil((decimalDigits+12)/14.181647462725477);let completed=0;
 const split=(a:number,b:number):Split=>{if(b-a===1){if(a===0)return{p:1n,q:1n,t:13591409n};const A=BigInt(a),p=(6n*A-5n)*(2n*A-1n)*(6n*A-1n),q=A*A*A*C3_OVER_24,t=p*(13591409n+545140134n*A);completed++;onProgress?.({iteration:completed,totalIterations:terms,elapsedMs:performance.now()-began});return{p,q,t:a&1?-t:t};}const m=(a+b)>>1,l=split(a,m),r=split(m,b);return{p:l.p*r.p,q:l.q*r.q,t:l.t*r.q+l.p*r.t};};
 const s=split(0,terms),scale=10n**BigInt(decimalDigits+12),pi=(426880n*isqrt(10005n*scale*scale)*s.q)/s.t,raw=pi.toString().padStart(decimalDigits+13,'0');return{digits:raw.slice(0,1)+raw.slice(1,decimalDigits+1),iterations:terms,elapsedMs:performance.now()-began};}
}
