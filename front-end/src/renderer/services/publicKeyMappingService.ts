import { commonIPCHandler } from '@renderer/utils';

/* Public Key Mapping Service */

/* Get stored public keys */
export const getPublicKeys = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.publicKeyMapping.getPublicKeys();
  }, 'Failed to fetch stored public keys');

/* Get a single public key */
export const getPublicKey = async (publicKey: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.publicKeyMapping.getPublicKey(publicKey);
  }, 'Failed to find the public key');

/* Store public key mapping*/
export const addPublicKey = async (publicKey: string, nickname: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.publicKeyMapping.addPublicKey(publicKey, nickname);
  }, 'Failed to store public key');

/* Edit public key nickname */
export const editPublicKeyNickname = async (id: string, newNickname: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.publicKeyMapping.updatePublicKeyNickname(id, newNickname);
  }, "Failed to edit public key's nickname");

/* Delete public key mapping */
export const deletePublicKey = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.publicKeyMapping.deletePublicKey(id);
  }, 'Failed to delete public key');
