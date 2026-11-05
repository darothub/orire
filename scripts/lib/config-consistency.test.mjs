import {test} from "node:test";
import assert from "node:assert/strict";
import {parseEnv,deployedValues,attest,equalAttestation,metadataNames,drift,ATTESTATION_KEY} from "./config-consistency.mjs";

const source=`AUTH_SECRET=very-long-random-strong-secret-12345
OPENAI_API_KEY="sk-example-A"
ANTHROPIC_API_KEY=sk-example-B
NEXT_PUBLIC_PASSWORD_AUTH=true
MAIL_SMTP_USER=local-only
EMPTY_KEY=
`;
test("merged config ignores empty and excluded production values",()=>{
 const e=deployedValues(source);
 assert.equal(e.size,4);
 assert.equal(e.has("EMPTY_KEY"),false);
 assert.equal(e.has("MAIL_SMTP_USER"),false);
 assert.equal(e.get("OPENAI_API_KEY"),"sk-example-A");
});
test("attestation is stable across input order and detects rotated credentials",()=>{
 const one=deployedValues(source);
 const reordered=deployedValues(source.split("\n").reverse().join("\n"));
 assert.equal(attest(one),attest(reordered));
 assert.equal(equalAttestation(attest(one),attest(reordered)),true);
 const changed=new Map(one);
 changed.set("OPENAI_API_KEY","sk-example-rotated");
 assert.equal(equalAttestation(attest(one),attest(changed)),false);
 assert.doesNotMatch(attest(one),/sk-example|very-long-random/);
});
test("metadata includes names only, including Secrets whose values cannot be read",()=>{
 const names=metadataNames({envs:[{key:"AUTH_SECRET",type:"secret"},{key:"OPENAI_API_KEY",type:"secret"},{key:ATTESTATION_KEY,type:"config"}]});
 assert.equal(names.has("OPENAI_API_KEY"),true);
 assert.throws(()=>metadataNames({}),/Unsupported Vercel/);
});
test("preflight refuses a stale marker or missing keys",()=>{
 const desired=deployedValues(source);
 const valid=new Set([...desired.keys(),ATTESTATION_KEY]);
 assert.deepEqual(drift(desired,valid,attest(desired)),{missing:[],attestationMatches:true});
 const partial=new Set(["AUTH_SECRET",ATTESTATION_KEY]);
 const state=drift(desired,partial,"v1:stale");
 assert.equal(state.attestationMatches,false);
 assert.deepEqual(state.missing,["ANTHROPIC_API_KEY","NEXT_PUBLIC_PASSWORD_AUTH","OPENAI_API_KEY"].sort());
});
test("dotenv parsing handles equals in values and safely rejects invalid names",()=>{
 const parsed=parseEnv('AUTH_SECRET="abc=xyz"\nINVALID-NAME=value\nOPENAI_API_KEY=sk-abc\n');
 assert.equal(parsed.get("AUTH_SECRET"),"abc=xyz");
 assert.equal(parsed.has("INVALID-NAME"),false);
});
