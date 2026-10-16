// Explicit opt-in only: app/linked credentials are never fallback test targets.
export function planningLocalConfig(api:string|undefined,publicKey:string|undefined,serviceKey:string|undefined){
 if(!api&&!publicKey&&!serviceKey)return {api,publicKey,serviceKey,enabled:false};
 if(!api||!publicKey||!serviceKey)throw new Error("Supply all disposable local test credentials.");
 const url=new URL(api);
 if(url.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||!["54321","55321","56321"].includes(url.port)||url.pathname!=="/"||url.search||url.hash||url.username||url.password)throw new Error("Tests require a dedicated disposable loopback instance.");
 return {api,publicKey,serviceKey,enabled:true};
}
