import {createHmac, timingSafeEqual} from "node:crypto";

export const ATTESTATION_KEY="ORIRE_CONFIG_ATTESTATION";

/** Match the existing sync script's first-equals split and surrounding quote handling. */
export function parseEnv(text){
  const values=new Map();
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()||line.startsWith("#"))continue;
    const pos=line.indexOf("=");
    if(pos<=0)continue;
    const key=line.slice(0,pos).replaceAll(" ","");
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))continue;
    let value=line.slice(pos+1);
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    values.set(key,value);
  }
  return values;
}

export function deployedValues(text,target="production"){
  const out=new Map();
  for(const [key,value] of parseEnv(text)){
    if(key===ATTESTATION_KEY||!value)continue;
    if(target==="production"&&key.startsWith("MAIL_SMTP_"))continue;
    out.set(key,value);
  }
  return out;
}

export function attest(values){
  const secret=values.get("AUTH_SECRET");
  if(!secret||secret.length<20)throw new Error("AUTH_SECRET must be populated and sufficiently strong to attest configuration.");
  const payload=JSON.stringify([...values.entries()].sort(([a],[b])=>a.localeCompare(b)));
  // Domain-separated HMAC; no raw or unhashed secret values are ever printed or stored.
  return "v1:"+createHmac("sha256",secret).update("orire-central-config-v1\0").update(payload).digest("hex");
}

export function equalAttestation(a,b){
  const left=Buffer.from(a||"","utf8"),right=Buffer.from(b||"","utf8");
  return left.length===right.length&&timingSafeEqual(left,right);
}

/** Vercel JSON metadata can be an array or an object containing envs/items. */
export function metadataNames(json){
  const items=Array.isArray(json)?json:Array.isArray(json?.envs)?json.envs:Array.isArray(json?.items)?json.items:null;
  if(!items)throw new Error("Unsupported Vercel environment metadata shape.");
  const names=new Set();
  for(const item of items){
    const key=item?.key??item?.name;
    if(typeof key==="string")names.add(key);
  }
  return names;
}

export function drift(expected,actualNames,recorded){
 const missing=[...expected.keys()].filter(key=>!actualNames.has(key)).sort();
 if(!actualNames.has(ATTESTATION_KEY))missing.push(ATTESTATION_KEY);
 return {missing,attestationMatches:equalAttestation(attest(expected),recorded)};
}
