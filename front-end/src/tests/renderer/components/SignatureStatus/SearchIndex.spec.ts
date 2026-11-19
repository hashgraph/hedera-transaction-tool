// @vitest-environment happy-dom

import { ref } from "vue";
import { SearchIndex } from '@renderer/components/SignatureStatus/SearchIndex.ts';

describe('SearchIndex.ts', () => {

  test('', () => {
    // 1) creates search index => no candidate, no match
    const searchText = ref<string>('');
    const searchIndex = new SearchIndex(searchText);
    expect(searchIndex.candidates.value.size).toBe(0);
    expect(searchIndex.matches.value).toStrictEqual([]);

    // 2) adds a candidate  => no match
    const candidate1 = 'candidate 1';
    const element1 = document.createElement('p');
    searchIndex.pushCandidate(candidate1, element1);
    expect(searchIndex.candidates.value.size).toBe(1);
    expect(searchIndex.candidates.value.get(candidate1)).toStrictEqual([element1]);
    expect(searchIndex.matches.value).toStrictEqual([]);

    // 3) adds another candidate => no match
    const candidate2 = 'candidate 2';
    const element2 = document.createElement('p');
    searchIndex.pushCandidate(candidate2, element2);
    expect(searchIndex.candidates.value.size).toBe(2);
    expect(searchIndex.candidates.value.get(candidate2)).toStrictEqual([element2]);
    expect(searchIndex.matches.value).toStrictEqual([]);

    // 5) sets non matching search => no match
    searchText.value = 'some non matching text';
    expect(searchIndex.matches.value).toStrictEqual([]);

    // 4) sets matching search text => match
    searchText.value = 'candidate 1';
    expect(searchIndex.matches.value).toStrictEqual([element1]);

    // 5) removes matching candidate => no match
    searchIndex.removeCandidate(candidate1);
    expect(searchIndex.candidates.value.size).toBe(1);
    expect(searchIndex.matches.value).toStrictEqual([]);

    // 6) sets matching search text => match
    searchText.value = 'candidate 2';
    expect(searchIndex.matches.value).toStrictEqual([element2]);

    // 7) clears search text => no match
    searchText.value = '';
    expect(searchIndex.matches.value).toStrictEqual([]);
  })
})
