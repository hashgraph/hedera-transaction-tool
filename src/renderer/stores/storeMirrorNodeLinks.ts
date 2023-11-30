import { computed, onMounted, ref } from 'vue';
import {
  getInitialMirrorNodeLinks,
  getMirrorNodeConfig,
  setMirrorNodeLink,
} from '../services/configurationService';
import { defineStore } from 'pinia';

const useMirrorNodeLinksStore = defineStore('mirrorNodeLinks', () => {
  const mirrorNodeLinks = ref(getInitialMirrorNodeLinks());

  const mainnet = computed(() => mirrorNodeLinks.value.mainnetLink);
  const testnet = computed(() => mirrorNodeLinks.value.testnetLink);
  const previewnet = computed(() => mirrorNodeLinks.value.previewnetLink);

  async function refetch() {
    mirrorNodeLinks.value = await getMirrorNodeConfig();
  }

  async function setMirroNodeLink(
    node: 'mainnetLink' | 'testnetLink' | 'previewnetLink',
    link: string,
  ) {
    await setMirrorNodeLink(node, link);
    mirrorNodeLinks.value[node] = link;
  }

  onMounted(async () => {
    const links = await getMirrorNodeConfig();
    mirrorNodeLinks.value = links;
  });

  return { mirrorNodeLinks, mainnet, testnet, previewnet, setMirroNodeLink, refetch };
});

export default useMirrorNodeLinksStore;
