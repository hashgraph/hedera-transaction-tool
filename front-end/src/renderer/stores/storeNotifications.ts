import { ref } from 'vue';
import { defineStore } from 'pinia';

const userNotificationsStore = defineStore('notifications', () => {
  /* State */
  const notifications = ref({
    email: {
      'threshhold-reached': true,
      'required-signatures': true,
    },
  });

  return {
    notifications,
  };
});

export default userNotificationsStore;
