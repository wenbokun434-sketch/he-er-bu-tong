"use client";
import {createContext,useContext,useEffect,useSyncExternalStore,cloneElement,isValidElement,type ReactNode,type ReactElement} from 'react';
import {translateText,type Language} from './i18n';
const LanguageContext=createContext<{language:Language;setLanguage:(language:Language)=>void}>({language:'zh',setLanguage:()=>{}});
let currentLanguage:Language|null=null;
const languageListeners=new Set<()=>void>();
function languageSnapshot():Language {
 if(currentLanguage)return currentLanguage;
 const query=new URL(window.location.href).searchParams.get('lang');let saved:string|null=null;
 try{saved=localStorage.getItem('heyi-language');}catch{}
 currentLanguage=query==='en'||query==='zh'?query:saved==='en'?'en':'zh';return currentLanguage;
}
function subscribeLanguage(listener:()=>void){languageListeners.add(listener);return ()=>{languageListeners.delete(listener);};}
export function LanguageProvider({children}:{children:ReactNode}){
 const language=useSyncExternalStore(subscribeLanguage,languageSnapshot,()=> 'zh' as Language);
 useEffect(()=>{document.documentElement.lang=language==='en'?'en':'zh-CN';document.title=language==='en'?'HeYi Agreement · HeYi OS':'和议书 · HeYi OS';},[language]);
 function setLanguage(next:Language){currentLanguage=next;try{localStorage.setItem('heyi-language',next);}catch{}const url=new URL(window.location.href);url.searchParams.set('lang',next);window.history.replaceState({},'',url);languageListeners.forEach(listener=>listener());}
 return <LanguageContext.Provider value={{language,setLanguage}}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){const context=useContext(LanguageContext);return {...context,t:(text:string)=>translateText(text,context.language)};}
export function LanguageSwitcher(){const {language,setLanguage}=useLanguage();return <div className="language-switch" role="group" aria-label="Language / 语言"><button type="button" lang="zh-CN" aria-pressed={language==='zh'} onClick={()=>setLanguage('zh')}>中文</button><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div>;}
// Translate React output without touching event handlers, IDs, option values or controlled drafts.
// Every view subscribes to the context; changing language never remounts the workflow.
export function localizeTree(node:ReactNode,language:Language):ReactNode {
 if(typeof node==='string')return translateText(node,language);
 if(Array.isArray(node))return node.map(n=>localizeTree(n,language));
 if(!isValidElement(node))return node;
 const element=node as ReactElement<Record<string,unknown>>,props=element.props,translated:Record<string,unknown>={};
 if(typeof element.type==='string'){
  for(const key of ['aria-label','placeholder','title','alt'])if(typeof props[key]==='string')translated[key]=translateText(props[key] as string,language);
  if(element.type==='option'&&props.value===undefined&&typeof props.children==='string')translated.value=props.children;
  if(element.type==='input'&&props.type==='date')translated.lang=language==='en'?'en':'zh-CN';
 }
 if(props.children!==undefined&&!props['data-verbatim'])translated.children=localizeTree(props.children as ReactNode,language);
 return cloneElement(element,translated);
}
