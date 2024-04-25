import { Ref, provide, readonly } from 'vue';

import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';

export const USER_PASSWORD_MODAL_KEY = 'userPasswordModalRef';
export type USER_PASSWORD_MODAL_TYPE = Ref<InstanceType<typeof UserPasswordModal> | null>;

export const provideUserModalRef = (value: USER_PASSWORD_MODAL_TYPE) => {
  provide(USER_PASSWORD_MODAL_KEY, readonly(value));
};
