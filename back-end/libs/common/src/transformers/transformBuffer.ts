import { Transform } from 'class-transformer';

import { decode } from '../utils';

export const TransformBuffer = () => Transform(({ value }) => (value ? decode(value) : null));
