<script setup lang="ts">
const FAQs = [1, 2, 3, 4];
</script>
<template>
  <div class="w-100 d-flex flex-column justify-content-center align-items-center gap-4">
    <div class="col-12 col-md-10 col-xxl-8">
      <h1 class="mt-3 text-huge text-bold text-center">F.A.Q.</h1>
      <p class="mt-5 text-center">
        The 24-word recovery phrase is a private key used to regain access to your Key Pair. Store
        it somewhere save and in the exact same order
      </p>
      <div class="mt-8">
        <div class="accordion border-0">
          <template v-for="item in FAQs" :key="item">
            <div class="accordion-item border-0 border-bottom">
              <h2 class="accordion-header">
                <button
                  class="accordion-button collapsed bg-transparent shadow-none text-bold"
                  type="button"
                  data-bs-toggle="collapse"
                  :data-bs-target="`#collapse${item}`"
                  aria-expanded="false"
                  :aria-controls="`collapse${item}`"
                >
                  Frequently Asked Question {{ item }}
                </button>
              </h2>
              <div :id="`collapse${item}`" class="accordion-collapse collapse">
                <div class="accordion-body pt-0 mt-n2">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
