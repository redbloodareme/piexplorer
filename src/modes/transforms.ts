export const PALETTE=['#000000','#172B8F','#5C7BC7','#4FA3D1','#00D95A','#FFE500','#FFB900','#F28C00','#F0180D','#F020E8'] as const;
export function toLetters(digits:string):string {let out='';for(let i=0;i+1<digits.length;i+=2){const n=Number(digits.slice(i,i+2));out+=n===0?' ':String.fromCharCode(65+(n-1)%26);}return out;}
export function twoColor(digit:string):string{return Number(digit)<5?'#000000':'#ffffff';}
