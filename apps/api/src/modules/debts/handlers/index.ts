import { create } from './create.handler';
import { get } from './get.handler';
import { list } from './list.handler';
import { update } from './update.handler';
import { remove } from './remove.handler';
import { cancel } from './cancel.handler';
import { confirm } from './confirm.handler';
import { complete } from './complete.handler';
import { suggest } from './suggest.handler';
import { respondSuggestion } from './respond-suggestion.handler';
import { qr } from './qr.handler';
import { batchRemove } from './batch-remove.handler';
import { removeAll } from './remove-all.handler';
import { debtProof } from './proof.handler';

export const debt = {
  create,
  get,
  list,
  update,
  remove,
  cancel,
  confirm,
  complete,
  suggest,
  respondSuggestion,
  qr,
  batchRemove,
  removeAll,
  proof: debtProof
};

export { create, get, list, update, remove, cancel, confirm, complete, suggest, respondSuggestion, qr, batchRemove, removeAll, debtProof };
