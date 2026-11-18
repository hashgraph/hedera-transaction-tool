import { inject, provide, ref, type Ref } from 'vue';

export class SearchIndex {
  public static readonly injectKey = Symbol();
  public readonly candidates: Ref<Map<string, HTMLElement[]>> = ref(new Map());
  public readonly highlightElement: Ref<HTMLElement | null> = ref(null);

  //
  // Public (static)
  //

  public pushCandidate(candidate: string, element: HTMLElement) {
    const elements = this.candidates.value.get(candidate);
    if (elements === undefined) {
      this.candidates.value.set(candidate, [element]);
    } else {
      elements.push(element);
    }
  }

  public removeCandidate(candidate: string) {
    this.candidates.value.delete(candidate);
  }

  //
  // Public (static)
  //

  public static provide(index: SearchIndex): void {
    provide(SearchIndex.injectKey, index);
  }

  public static inject(): SearchIndex {
    return inject<SearchIndex>(SearchIndex.injectKey, new SearchIndex());
  }
}
