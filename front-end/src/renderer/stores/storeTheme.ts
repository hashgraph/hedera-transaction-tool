import { defineStore } from 'pinia';
import { ref } from 'vue';

const useThemeStore = defineStore('theme', () => {
  const isDark = ref<boolean>(false);

  /* Actions */
  function changeThemeDark(dark: boolean) {
    isDark.value = dark;
  }

  return {
    isDark,
    changeThemeDark,
  };
});

export default useThemeStore;
