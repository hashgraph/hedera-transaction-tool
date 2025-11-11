<script setup lang="ts">
// import { useToast } from 'vue-toast-notification';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
// const $toast = useToast();

// $toast.open({
//   message: 'This is a success toast',
//   position: 'bottom-right',
//   dismissible: true,
//   duration: 0,
// });

// $toast.open({
//   message: 'This is a error toast',
//   type: 'error',
//   position: 'bottom-right',
//   dismissible: true,
//   duration: 0,
// });
</script>

<template>
  <div class="p-5">
    <div class="flex-column-100">
      <h1 class="text-title text-bold">Style Guide</h1>

      <div class="fill-remaining">
        <h2 class="text-display mt-10">Colors</h2>
        <hr class="mt-3 mb-6" />

        <h3 class="text-headline mb-4">Main</h3>

        <div class="row mb-4">
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-primary text-white text-center"
            >
              Primary
            </div>
          </div>
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-secondary text-white text-center"
            >
              Secondary
            </div>
          </div>
        </div>

        <h3 class="text-headline mb-4">System</h3>

        <div class="row mb-4">
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-success text-white text-center"
            >
              Success
            </div>
          </div>
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-danger text-white text-center"
            >
              Danger
            </div>
          </div>
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-warning text-white text-center"
            >
              Warning
            </div>
          </div>
          <div class="col-12 col-md-2">
            <div
              :style="{ height: '64px', lineHeight: '64px', borderRadius: '2px' }"
              class="mb-2 bg-info text-white text-center"
            >
              Info
            </div>
          </div>
        </div>

        <h2 class="text-display mt-10">Typography</h2>
        <hr class="mt-3 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-huge</code>
              <h3 class="text-huge mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </h3>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-display</code>
              <h3 class="text-display mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </h3>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-headline</code>
              <h4 class="text-headline mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </h4>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-title</code>
              <h5 class="text-title mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </h5>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-subheader</code>
              <h6 class="text-subheader mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </h6>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-main</code>
              <p class="text-main mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </p>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-small</code>
              <p class="text-small mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </p>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-micro</code>
              <p class="text-micro mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </p>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-8">
              <code>.text-footnote</code>
              <p class="text-footnote mt-3">
                <span class="text-bold">The quick brown</span> fox jumps over the lazy dog
              </p>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-6">
              <code>.link-primary</code>
              <p class="text-main mt-3">
                <a href="#test" class="link-primary">
                  The quick brown fox jumps over the lazy dog
                </a>
              </p>
            </div>
          </div>
        </div>

        <hr class="mt-6 mb-6" />

        <div class="mb-4">
          <div class="row">
            <div class="col-md-6">
              <code>.link-secondary</code>
              <p class="text-main mt-3">
                <a href="#test" class="link-secondary">
                  The quick brown fox jumps over the lazy dog
                </a>
              </p>
            </div>
          </div>
        </div>

        <h2 class="text-display mt-10">UI Elements</h2>
        <hr class="mt-3 mb-6" />

        <h3 class="text-headline mb-4">Buttons</h3>

        <div class="row mb-4">
          <div class="col-12 mb-4">
            <AppButton color="primary" size="small" class="me-3">Primary small</AppButton>
            <AppButton color="secondary" size="small" class="me-3">Secondary small</AppButton>
            <AppButton color="borderless" size="small" class="me-3">Borderless small</AppButton>
            <AppButton color="danger" size="small" class="me-3">Danger small</AppButton>
          </div>
          <div class="col-12 mb-4">
            <AppButton color="primary" class="me-3">Primary</AppButton>
            <AppButton color="secondary" class="me-3">Secondary</AppButton>
            <AppButton color="borderless" class="me-3">Borderless</AppButton>
            <AppButton color="danger" class="me-3">Danger</AppButton>
          </div>
          <div class="col-12 mb-4">
            <AppButton :disabled="true" color="primary" class="me-3">Primary Disabled</AppButton>
            <AppButton :disabled="true" color="secondary" class="me-3"
              >Secondary Disabled</AppButton
            >
            <AppButton :disabled="true" color="borderless" class="me-3"
              >Borderless Disabled</AppButton
            >
            <AppButton :disabled="true" color="danger" class="me-3">Danger Disabled</AppButton>
          </div>
        </div>

        <!-- <div class="mb-4 d-flex align-items-center">
      <ButtonSelector type="border" selectorText="Select token" />
    </div>

    <div class="mb-4 d-flex align-items-center">
      <div class="btn-selector">
        <span class="text-small">Select token</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>
      <div class="btn-selector with-background ms-3">
        <span class="text-small">Select token</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>
      <div class="btn-selector with-border ms-3">
        <span class="text-small">Select token</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>
    </div>

    <div class="mb-4 d-flex align-items-center">
      <div class="btn-selector">
        <IconToken symbol="ETH" class="me-3" />
        <span class="text-small">ETH</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>

      <div class="btn-selector with-background ms-3">
        <IconToken symbol="HBAR" class="me-3" />
        <span class="text-small">HBAR</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>

      <div class="btn-selector with-border ms-3">
        <IconToken symbol="HBAR" class="me-3" />
        <span class="text-small">HBAR</span>
        <Icon name="chevron-down" class="ms-2" />
      </div>
    </div>-->

        <h3 class="text-headline mb-4">Forms</h3>

        <div class="row mb-4">
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input</label>
              <p class="text-small text-secondary mb-3">Text secondary</p>
              <AppInput type="email" placeholder="name@example.com" />
            </div>
          </div>
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input invalid</label>
              <AppInput type="email" class="is-invalid" placeholder="name@example.com" />
              <div class="invalid-feedback">Invalid e-mail.</div>
            </div>
          </div>
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input disabled</label>
              <AppInput type="email" disabled placeholder="name@example.com" />
            </div>
          </div>
        </div>

        <div class="row mb-4">
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input</label>
              <AppInput :filled="true" type="email" placeholder="name@example.com" />
            </div>
          </div>
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input invalid</label>
              <AppInput
                :filled="true"
                type="email"
                class="is-invalid"
                placeholder="name@example.com"
              />
              <div class="invalid-feedback">Invalid e-mail.</div>
            </div>
          </div>
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Default input disabled</label>
              <AppInput :filled="true" type="email" disabled placeholder="name@example.com" />
            </div>
          </div>
        </div>

        <div class="row mb-4">
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Custom select</label>
              <div class="custom-select-wrapper">
                <select class="form-select">
                  <option value="1">Option 1</option>
                  <option value="2">Option 2</option>
                  <option value="3">Option 3</option>
                  <option value="4">Option 4</option>
                </select>
              </div>
            </div>
          </div>
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label class="form-label">Custom select invalid</label>
              <div class="custom-select-wrapper">
                <select class="form-select is-invalid">
                  <option value="1">Option 1</option>
                  <option value="2">Option 2</option>
                  <option value="3">Option 3</option>
                  <option value="4">Option 4</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="row mb-4">
          <div class="col-lg-3">
            <div class="form-group mb-5">
              <label for="fileUpload" class="form-label">
                <span for="fileUpload" class="btn btn-primary">File upload</span>
              </label>
              <AppInput type="file" id="fileUpload" />
            </div>
          </div>
        </div>

        <!--
    <h3 class="text-headline mb-4">Modals</h3>
      <div class="row mb-6">
        <div class="col-lg-6">
          <AppButton color="secondary" @click="handleModalOpen">
            Show modal
          </AppButton>

          {showModal ? (
            <Modal show={showModal} closeModal={() => handleModalClose()}>
              <ModalContent modalTitle="Modal title" closeModal={() => handleModalClose()} />
            </Modal>
          ) : null}
        </div>
      </div>

      <h3 class="text-headline mb-4">Toasts</h3>
      <div class="row mb-6">
        <div class="col-lg-8">
          <Button size="small" onClick={() => toast('Default')} type="primary">
            Open toast
          </Button>
          <Button
            size="small"
            class="ms-3"
            onClick={() => toast.success('Success', successToastOptions)}
            type="primary"
          >
            Open toast success
          </Button>
          <Button
            size="small"
            class="ms-3"
            onClick={() => toast.error('Danger')}
            type="primary"
          >
            Open toast danger
          </Button>
        </div>
      </div>

    <ToasterWrapper />

    <h3 class="text-headline mb-4">Alerts</h3>

    <div class="row mb-6">
      <div class="col-lg-6">
        <div class="alert alert-success alert-dismissible fade show" role="alert">
          <strong>Holy guacamole!</strong> You should check in on some of those fields below.
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
          ></button>
        </div>

        <div class="alert alert-info alert-dismissible fade show mt-5" role="alert">
          <strong>Holy guacamole!</strong> You should check in on some of those fields below.
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
          ></button>
        </div>

        <div class="alert alert-warning alert-dismissible fade show mt-5" role="alert">
          <strong>Holy guacamole!</strong> You should check in on some of those fields below.
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
          ></button>
        </div>

        <div class="alert alert-danger alert-dismissible fade show mt-5" role="alert">
          <strong>Holy guacamole!</strong> You should check in on some of those fields below.
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
          ></button>
        </div>
      </div>
    </div>

    <h3 class="text-headline mb-4">Lists</h3>

    <div class="row mb-4">
      <div class="col-lg-6">
        <ul class="list-icon">
          <li class="mb-4">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora quis maiores,
            voluptatibus sapiente quo ullam sint quam, nobis officiis incidunt impedit totam animi
            dignissimos ad, voluptate debitis! Sed, reprehenderit neque.
          </li>
          <li class="mb-4">
            Anim pariatur cliche reprehenderit, enim eiusmod high life accusamus terry richardson ad
            squid. 3 wolf moon officia aute, non cupidatat skateboard dolor brunch.
          </li>
          <li class="mb-4">
            Food truck quinoa nesciunt laborum eiusmod. Brunch 3 wolf moon tempor, sunt aliqua put a
            bird on it squid single-origin coffee nulla assumenda shoreditch et.{' '}
          </li>
        </ul>
      </div>
    </div>

    <h3 class="text-headline mb-4 mt-5">Pagination</h3>

    <div class="row mb-4">
      <div class="col-lg-6">
        <nav aria-label="Page navigation example">
          <ul class="pagination">
            <li class="page-item">
              <a class="page-link" href="#test"> Previous </a>
            </li>
            <li class="page-item">
              <a class="page-link" href="#test"> 1 </a>
            </li>
            <li class="page-item">
              <a class="page-link" href="#test"> 2 </a>
            </li>
            <li class="page-item">
              <a class="page-link" href="#test"> 3 </a>
            </li>
            <li class="page-item">
              <a class="page-link" href="#test"> Next </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <Link class="link-primary" to="/"> Back to home </Link> -->
      </div>
    </div>
  </div>
</template>
