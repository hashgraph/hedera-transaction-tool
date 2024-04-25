import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface GroupItem {
  transactionBytes: string;
  type: string;
  accountId: string;
}

const useTransactionGroupStore = defineStore('transactionGroup', () => {
  /* State */
  const groupItems = ref<GroupItem[]>([]);

  /* Actions */
  function addGroupItem(groupItem: GroupItem) {
    groupItems.value.push(groupItem);
  }
  function removeGroupItem(index: number) {
    groupItems.value.splice(index, 1);
  }
  function duplicateGroupItem(index: number) {
    const newGroupItems = new Array<GroupItem>();
    groupItems.value.forEach((groupItem, i) => {
      if (i == index + 1) {
        newGroupItems.push(groupItems.value[index]);
      }
      newGroupItems.push(groupItem);
    });
    groupItems.value = newGroupItems;
  }
  return { addGroupItem, removeGroupItem, duplicateGroupItem, groupItems };
});

export default useTransactionGroupStore;
