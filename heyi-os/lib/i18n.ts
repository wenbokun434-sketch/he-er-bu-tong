import dictionary from './translations-en.json' with {type:'json'};
export type Language = 'zh' | 'en';
const entries = Object.entries(dictionary);
const escape = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates = entries.filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>({pattern:new RegExp('^'+key.split(/\{\d+\}/).map(escape).join('(.*?)')+'$','s'),value}));
const fragments = entries.filter(([key])=>!key.includes('{')&&key.trim().length>=2).sort((a,b)=>b[0].length-a[0].length);
// Only known application copy and fictional samples are localized. Free-form text stays in its authored language.
export function translateText(text:string,language:Language):string {
 if(language==='zh'||!/[\u3400-\u9fff]/.test(text))return text;
 const direct=(dictionary as Record<string,string>)[text];if(direct!==undefined)return direct;
 const trimmed=text.trim(),simple=(dictionary as Record<string,string>)[trimmed];if(simple!==undefined)return text.slice(0,text.indexOf(trimmed))+simple+text.slice(text.indexOf(trimmed)+trimmed.length);
 for(const {pattern,value} of templates){const match=trimmed.match(pattern);if(match)return value.replace(/\{(\d+)\}/g,(_,i)=>translateText(match[Number(i)+1]??'',language));}
 let result='',offset=0;
 while(offset<text.length){const entry=fragments.find(([key])=>text.startsWith(key,offset));if(entry){result+=entry[1];offset+=entry[0].length;if(/[A-Za-z]$/.test(result)&&/[\u3400-\u9fff]/.test(text[offset]??''))result+=' ';}else result+=text[offset++];}
 return /[\u3400-\u9fff]/.test(result)?text:result;
}
export function localizeData<T>(value:T,language:Language):T {
 if(typeof value==='string')return translateText(value,language) as T;
 if(Array.isArray(value))return value.map(v=>localizeData(v,language)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localizeData(v,language)])) as T;
 return value;
}
