<script setup lang="ts">
import { NotificationType } from '@shared/interfaces';

import useNotificationsStore from '@renderer/stores/storeNotifications';

import useRedirectOnOnlyOrganization from '@renderer/composables/useRedirectOnOnlyOrganization';

import AppSwitch from '@renderer/components/ui/AppSwitch.vue';

/* Stores */
const notifications = useNotificationsStore();

/* Composable */
useRedirectOnOnlyOrganization();

/* Handlers */
const handlePreferenceChange = (type: NotificationType, email: boolean) => {
  notifications.updatePreferences({ type, email });
};
</script>

<template>
  <div>
    <div class="fill-remaining border border-2 rounded-3 p-4">
      <p>Email notifications</p>
      <p class="text-small text-secondary ms-1 mb-3">
        Get emails about transactions you're involved in for:
      </p>

      <!-- Indented options -->
      <div class="ms-3">

        <!-- Ready to execute -->
        <div class="mt-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="me-3">
              <div class="fs-6">Ready to execute</div>
            </div>
            <div class="notification-toggle">
              <AppSwitch
                :checked="
                  notifications.notificationsPreferences[
                    NotificationType.TRANSACTION_READY_FOR_EXECUTION
                  ]
                "
                @update:checked="
                  handlePreferenceChange(
                    NotificationType.TRANSACTION_READY_FOR_EXECUTION,
                    $event
                  )
                "
                name="threshold-reached"
                aria-label="Email me when a transaction is ready to execute"
              />
            </div>
          </div>
          <p class="text-small text-secondary mt-1">
            The transaction has enough signatures and can be executed.
          </p>
        </div>

        <!-- Signature required -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center">
            <div class="me-3">
              <div class="fs-6">Signature required</div>
            </div>
            <div class="notification-toggle">
              <AppSwitch
                :checked="
                  notifications.notificationsPreferences[
                    NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES
                  ]
                "
                @update:checked="
                  handlePreferenceChange(
                    NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
                    $event
                  )
                "
                name="required-signatures"
                aria-label="Email me when my signature is required"
              />
            </div>
          </div>
          <p class="text-small text-secondary mt-1">
            A new transaction needs your signature.
          </p>
        </div>

        <!-- Cancelled -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center">
            <div class="me-3">
              <div class="fs-6">Cancelled</div>
            </div>
            <div class="notification-toggle">
              <AppSwitch
                :checked="
                  notifications.notificationsPreferences[
                    NotificationType.TRANSACTION_CANCELLED
                  ]
                "
                @update:checked="
                  handlePreferenceChange(
                    NotificationType.TRANSACTION_CANCELLED,
                    $event
                  )
                "
                name="transaction-cancelled"
                aria-label="Email me when a transaction is cancelled"
              />
            </div>
          </div>
          <p class="text-small text-secondary mt-1">
            The transaction is cancelled and will not be executed.
          </p>
        </div>

        <!-- Executed -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center">
            <div class="me-3">
              <div class="fs-6">Executed</div>
            </div>
            <div class="notification-toggle">
              <AppSwitch
                :checked="
                  notifications.notificationsPreferences[
                    NotificationType.TRANSACTION_EXECUTED
                  ]
                "
                @update:checked="
                  handlePreferenceChange(
                    NotificationType.TRANSACTION_EXECUTED,
                    $event
                  )
                "
                name="transaction-executed"
                aria-label="Email me when a transaction is executed"
              />
            </div>
          </div>
          <p class="text-small text-secondary mt-1">
            The transaction has been executed successfully.
          </p>
        </div>

        <!-- Expired -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center">
            <div class="me-3">
              <div class="fs-6">Expired</div>
            </div>
            <div class="notification-toggle">
              <AppSwitch
                :checked="
                  notifications.notificationsPreferences[
                    NotificationType.TRANSACTION_EXPIRED
                  ]
                "
                @update:checked="
                  handlePreferenceChange(
                    NotificationType.TRANSACTION_EXPIRED,
                    $event
                  )
                "
                name="transaction-expired"
                aria-label="Email me when a transaction expires"
              />
            </div>
          </div>
          <p class="text-small text-secondary mt-1">
            The transaction has expired and can no longer be executed.
          </p>
        </div>

      </div>
    </div>
  </div>
</template>
