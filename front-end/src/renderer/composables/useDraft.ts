import { useRoute } from 'vue-router';

import { deleteDraft, getDraft } from '@renderer/services/transactionDraftsService';

export default function useDraft() {
  /* Composables */
  const route = useRoute();

  /* Actions */
  async function deleteIfNotTemplate() {
    if (route.query.draftId) {
      try {
        const draft = await getDraft(route.query.draftId.toString());
        if (!draft.isTemplate) await deleteDraft(route.query.draftId.toString());
      } catch (error) {
        console.log(error);
      }
    }
  }

  return { deleteIfNotTemplate };
}
