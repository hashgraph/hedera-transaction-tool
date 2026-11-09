<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import { createHighlighterCore, type HighlighterCore, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import solidity from 'shiki/langs/solidity.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

// Created once and shared: building a highlighter is the expensive part.
let highlighterPromise: Promise<HighlighterCore> | null = null;
const getHighlighter = () =>
  (highlighterPromise ??= createHighlighterCore({
    langs: [solidity],
    themes: [githubLight],
    engine: createJavaScriptRegexEngine(),
  }));

/* Props */
const props = defineProps<{
  contractName: string;
  sources: { path: string; content: string }[];
}>();

/* State */
const selectedPath = ref('');
const highlighter = shallowRef<HighlighterCore | null>(null);

/* Computed */
const selected = computed(() => props.sources.find(s => s.path === selectedPath.value) ?? null);
// Tokens are rendered as plain text spans (never v-html) because the source comes from a third
// party. Falls back to unstyled lines until the highlighter loads or if highlighting fails.
const lines = computed<ThemedToken[][]>(() => {
  const content = selected.value?.content;
  if (content === undefined) return [];

  const plain = () => content.split('\n').map(line => [{ content: line, offset: 0 }]);
  if (!highlighter.value) return plain();

  try {
    return highlighter.value.codeToTokensBase(content, { lang: 'solidity', theme: 'github-light' });
  } catch {
    return plain();
  }
});

/* Hooks */
onMounted(async () => {
  try {
    highlighter.value = await getHighlighter();
  } catch {
    // keep the plain-text fallback
  }
});

/* Watchers */
watch(
  () => props.sources,
  sources => {
    // Land on the contract's own file rather than whichever import happens to be listed first.
    const main = sources.find(s => s.path.endsWith(`/${props.contractName}.sol`)) ?? sources[0];
    selectedPath.value = main?.path ?? '';
  },
  { immediate: true },
);
</script>
<template>
  <div class="d-flex flex-column border rounded overflow-hidden" style="min-height: 0">
    <div class="d-flex align-items-center gap-3 p-3 border-bottom flex-shrink-0">
      <span class="text-small text-secondary flex-shrink-0">Source file</span>
      <select
        v-model="selectedPath"
        class="form-select form-select-sm"
        data-testid="select-contract-source-file"
      >
        <option v-for="source in sources" :key="source.path" :value="source.path">
          {{ source.path }}
        </option>
      </select>
    </div>
    <div
      class="flex-grow-1 overflow-auto"
      style="min-height: 0; background-color: rgba(0, 0, 0, 0.04)"
    >
      <table class="m-0 text-small" style="font-family: monospace; border-collapse: collapse">
        <tbody>
          <tr v-for="(line, index) in lines" :key="index">
            <td
              class="text-secondary text-end user-select-none ps-3 pe-3 align-top"
              style="width: 1%; white-space: nowrap"
            >
              {{ index + 1 }}
            </td>
            <td class="pe-3" style="white-space: pre">
              <span
                v-for="(token, tokenIndex) in line"
                :key="tokenIndex"
                :style="{ color: token.color }"
                >{{ token.content }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
