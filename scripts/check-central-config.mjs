#!/usr/bin/env node
/**
 * Local production preflight (never CI without separate secured SOPS/Vercel access).
 * Verifies merged central-config presence, Vercel variable names and attestation.
 * Vercel Secret values cannot be read back: this proves latest successful managed
 * sync matched the current central-config, NOT the current values of Secrets.
 */
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {attest,deployedValues,drift,metadataNames,parseEnv,ATTESTATION_KEY} from "./lib/config-consistency.mjs";

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const cfg=process.env.CENTRAL_CONFIG_DIR||path.resolve(repo,"../central-config");
const project=process.env.PROJECT||"orire";
const env=process.env.SOPS_ENV||"prod";
const target="production";
const run=(cmd,args,cwd)=>{
 const p=spawnSync(cmd,args,{cwd,encoding:"utf8",maxBuffer:16*1024*1024});
 if(p.error||p.status!==0)throw new Error(`${cmd} failed; check local authentication, linked Vercel project and SOPS access. No secret output shown.`);
 return p.stdout;
};
let tmp;
try{
 if(!existsSync(path.join(repo,".vercel/project.json")))throw new Error("Link the correct Orire Vercel project with vercel link first.");
 if(!existsSync(path.join(cfg,"scripts/pull.sh")))throw new Error("central-config checkout not found; set CENTRAL_CONFIG_DIR.");
 const values=deployedValues(run("sh",[path.join(cfg,"scripts/pull.sh"),project,env],cfg),target);
 if(!values.has("OPENAI_API_KEY")&&!values.has("ANTHROPIC_API_KEY"))throw new Error("Neither managed AI provider key is configured in the merged bundle.");
 // Fail before contacting Vercel if local secrets cannot produce an attestation.
 attest(values);
 const names=metadataNames(JSON.parse(run("vercel",["env","ls",target,"--format","json"],repo)));
 tmp=mkdtempSync(path.join(tmpdir(),"orire-config-check-"));
 const exported=path.join(tmp,"vercel.env");
 run("vercel",["env","pull",exported,"--environment=production","--yes"],repo);
 // Only the nonsecret Config attestation is read. The Secret values are not
 // retrieved by Vercel. Never log the pulled env file or its contents.
 const recorded=parseEnv(readFileSync(exported,"utf8")).get(ATTESTATION_KEY)||"";
 const result=drift(values,names,recorded);
 if(result.missing.length||!result.attestationMatches){
   console.error("FAIL: Production central-config consistency check");
   if(result.missing.length)console.error("Missing Vercel variable names:",result.missing.join(", "));
   if(!result.attestationMatches)console.error("Sync attestation missing or stale. Run npm run vercel:env and repeat this check.");
   process.exitCode=1;
 }else{
   console.log(`PASS: ${values.size} managed environment variable names present; sync attestation matches central-config.`);
   console.log("Note: Vercel Secret values are unreadable; manual secret edits and deployed runtime freshness cannot be verified by this check.");
 }
}catch(error){
 console.error("FAIL: Orire production config preflight:",error instanceof Error?error.message:"Unexpected error");
 process.exitCode=1;
}finally{
 if(tmp)rmSync(tmp,{recursive:true,force:true});
}
