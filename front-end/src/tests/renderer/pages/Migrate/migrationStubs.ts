/** Shared stubs for the Migrate wizard component specs. */
export const buttonStub = {
  props: ['disabled', 'loading', 'loadingText', 'color'],
  emits: ['click'],
  template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
};

export const inputStub = {
  props: ['modelValue', 'filled'],
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
