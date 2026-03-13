import * as v from 'valibot';
import { phoneSchema } from './auth';

export const profileSchema = v.strictObject({
  phoneNumber: phoneSchema
});
