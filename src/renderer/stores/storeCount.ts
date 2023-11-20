import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useCounterStore = defineStore('counter', () => {
  //State
  const count = ref(0);

  //Getters
  const doubleCount = computed(() => count.value * 2);

  //Actions
  function increment() {
    count.value++;
  }

  return { count, name, doubleCount, increment };
});
