import { SchemaProperties } from '../../main/modules/store';

export const getMirrorNodeConfig = async () => window.electronAPI.config.mirrorNodeLinks.getLinks();

export const setMirrorNodeLink = (key: keyof SchemaProperties['mirrorNodeLinks'], link: string) =>
  window.electronAPI.config.mirrorNodeLinks.setLink(key, link);
