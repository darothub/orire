#!/usr/bin/env node
import {readFileSync} from "node:fs";
import {attest,deployedValues} from "./lib/config-consistency.mjs";
const file=process.argv[2];
if(!file){console.error("Usage: node scripts/config-attestation.mjs <merged-env-file>");process.exit(2)}
try{
  // Only prints the domain-separated HMAC token; never env contents.
  console.log(attest(deployedValues(readFileSync(file,"utf8"),"production")));
}catch{
  console.error("Cannot attest central-config: check AUTH_SECRET and decrypted bundle.");
  process.exit(1);
}
