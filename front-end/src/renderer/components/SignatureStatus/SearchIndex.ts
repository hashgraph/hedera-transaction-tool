import { computed, inject, provide, ref, type Ref } from 'vue';

export class SearchIndex {
  public static readonly injectKey = Symbol();
  public readonly candidates: Ref<Map<string, HTMLElement[]>> = ref(new Map());

  //
  // Public
  //

  public constructor(public readonly searchText: Ref<string>) {}

  public pushCandidate(candidate: string, element: HTMLElement) {
    const elements = this.candidates.value.get(candidate);
    if (elements === undefined) {
      this.candidates.value.set(candidate, [element]);
    } else {
      elements.push(element);
    }
  }

  public removeCandidate(candidate: string, element: HTMLElement) {
    const elements = this.candidates.value.get(candidate);
    if (elements !== undefined) {
      const elementIndex = elements.indexOf(element);
      if (elementIndex !== -1) {
        elements.splice(elementIndex, 1);
      }
      if (elements.length == 0) {
        this.candidates.value.delete(candidate);
      }
    }
  }

  public readonly matches = computed<HTMLElement[]>(() => {
    const result: HTMLElement[] = [];
    if (this.trimmedSearchText.value.length > 0) {
      for (const [candidate, elements] of this.candidates.value) {
        if (candidate == this.trimmedSearchText.value) {
          elements.forEach(e => result.push(e));
        }
      }
      result.sort((a, b) => {
        if (a === b) return 0;
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a comes before b
        }
        if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1; // a comes after b
        }
        return 0;
      });
    }
    return result;
  });

  //
  // Public (static)
  //

  public static provide(index: SearchIndex): void {
    provide(SearchIndex.injectKey, index);
  }

  public static inject(): SearchIndex {
    return inject<SearchIndex>(SearchIndex.injectKey, new SearchIndex(ref('')));
  }

  //
  // Private
  //

  private readonly trimmedSearchText = computed(() => this.searchText.value.trim());
}
