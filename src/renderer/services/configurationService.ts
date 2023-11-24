import { SchemaProperties } from '../../main/modules/store';

export const getMirrorNodeConfig = async () =>
  window.electronAPI.configuration.mirrorNodeLinks.getMirrorNodeLinks();

export const setMirrorNodeLink = (key: keyof SchemaProperties['mirrorNodeLinks'], link: string) =>
  window.electronAPI.configuration.mirrorNodeLinks.setMirrorNodeLink(key, link);
