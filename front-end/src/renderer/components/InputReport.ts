import type { InputStatus } from '@renderer/components/InputStatus.ts';

export interface InputReport<T> {
  status: InputStatus;
  value: T | null;
}
