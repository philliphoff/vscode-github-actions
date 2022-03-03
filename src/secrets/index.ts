import sodium = require("tweetsodium");
import util = require("util");
import { atob, btoa } from "abab";
import { GitHubRepoContext } from "../git/repository";

function decode(encoded: string): Uint8Array {
  const bytes = atob(encoded)!
    .split("")
    .map((x: string) => x.charCodeAt(0));
  return Uint8Array.from(bytes);
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(bytes)))!;
}

export function encodeSecret(key: string, value: string): string {
  const encoder = new util.TextEncoder();
  // Convert the message and key to Uint8Array's
  const messageBytes = encoder.encode(value);
  const keyBytes = decode(key);

  // Encrypt using LibSodium.
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);

  // Base64 the encrypted secret
  return encode(encryptedBytes);
}

export async function setSecret(gitHubContext: GitHubRepoContext, name: string, value: string): Promise<void> {
  const keyResponse =
    await gitHubContext.client.actions.getRepoPublicKey({
      owner: gitHubContext.owner,
      repo: gitHubContext.name,
    });

  const key_id = keyResponse.data.key_id;
  const key = keyResponse.data.key;

  await gitHubContext.client.actions.createOrUpdateRepoSecret({
    owner: gitHubContext.owner,
    repo: gitHubContext.name,
    secret_name: name,
    key_id: key_id,
    encrypted_value: encodeSecret(key, value),
  });
}