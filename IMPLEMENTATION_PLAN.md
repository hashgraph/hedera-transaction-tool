# Implementation Plan: Global Minimum Supported Frontend Version Guard

**Issue**: [#2126](https://github.com/hashgraph/hedera-transaction-tool/issues/2126)  
**Status**: In Progress  
**Created**: 2025-12-18

## Overview

Implement a global mechanism to enforce a **minimum supported frontend version** across all API and WebSocket interactions. This ensures outdated frontend clients cannot communicate with backend services past the supported threshold.

The frontend must include its version in all requests, and backend services will validate this version against an environment variable `MINIMUM_SUPPORTED_FRONTEND_VERSION`. If the version is below the minimum, the request or connection should be rejected gracefully with a clear response (e.g., `426 Upgrade Required`).

---

## Phase 1: Backend - HTTP API Version Guard

### 1.1 Create Frontend Version Guard

- [x] **File**: `back-end/apps/api/src/guards/frontend-version.guard.ts`
- [x] **Purpose**: Guard to validate `x-frontend-version` header against `MINIMUM_SUPPORTED_FRONTEND_VERSION`
- [x] **Implementation Details**:
  - [x] Implement `CanActivate` interface
  - [x] Read `x-frontend-version` from request headers
  - [x] Compare with `MINIMUM_SUPPORTED_FRONTEND_VERSION` using semver (existing utility)
  - [x] If version < minimum: throw `HttpException` with status `426 Upgrade Required`
  - [x] Log violations with client IP and version
  - [x] Handle missing header (reject with 426 for strict enforcement)
  - [x] Use `ConfigService` to access `MINIMUM_SUPPORTED_FRONTEND_VERSION`
  - [x] Export guard from `back-end/apps/api/src/guards/index.ts`

### 1.2 Register Guard Globally

- [x] **File**: `back-end/apps/api/src/api.module.ts`
- [x] **Action**: Add `FrontendVersionGuard` to `APP_GUARD` providers
- [x] **Note**: Order matters - should run before other guards (especially auth guards)
- [x] **Implementation**: Added `FrontendVersionGuard` before `IpThrottlerGuard` in providers array

### 1.3 Add Environment Variable to Notifications Service

- [x] **File**: `back-end/apps/notifications/src/notifications.module.ts`
- [x] **Action**: Add `MINIMUM_SUPPORTED_FRONTEND_VERSION: Joi.string().required()` to Joi validation schema
- [x] **Reason**: WebSocket middleware needs access via `ConfigService` (NestJS ConfigModule schema acts as whitelist)
- [x] **Implementation**: Added to Joi schema and example.env file

---

## Phase 2: Backend - WebSocket Version Validation

### 2.1 Create WebSocket Version Middleware

- [x] **File**: `back-end/apps/notifications/src/websocket/middlewares/frontend-version-websocket.middleware.ts`
- [x] **Purpose**: Validate frontend version during WebSocket handshake
- [x] **Implementation Details**:
  - [x] Similar pattern to `AuthWebsocketMiddleware`
  - [x] Read version from `socket.handshake.headers['x-frontend-version']` or `socket.handshake.auth.version`
  - [x] Compare with `MINIMUM_SUPPORTED_FRONTEND_VERSION` using semver
  - [x] If version < minimum: call `next(new Error(...))` and disconnect
  - [x] Log violations with client IP and version
  - [x] Should run **before** `AuthWebsocketMiddleware` in the chain
  - [x] Takes minimum version as parameter (from `ConfigService`)

### 2.2 Integrate Middleware into WebSocket Gateway

- [ ] **File**: `back-end/apps/notifications/src/websocket/websocket.gateway.ts`
- [ ] **Action**: Register middleware in `afterInit()` method before auth middleware
- [ ] **Note**: Need to inject `ConfigService` (already injected) to pass to middleware

---

## Phase 3: Frontend - HTTP Request Version Header

### 3.1 Create Version Utility

- [ ] **File**: `front-end/src/renderer/utils/version.ts` (new file)
- [ ] **Purpose**: Export current frontend version from `package.json`
- [ ] **Implementation Details**:
  - Read version from `package.json` or import from a generated constant
  - Export as `FRONTEND_VERSION` constant
  - Consider: import from `package.json` directly or create a build-time constant

### 3.2 Add Version Header to Axios Requests

- [ ] **File**: `front-end/src/renderer/utils/axios.ts`
- [ ] **Action**: Modify `getConfigWithAuthHeader()` function to include `x-frontend-version` header
- [ ] **Implementation Details**:
  - Import `FRONTEND_VERSION` from version utility
  - Add `'x-frontend-version': FRONTEND_VERSION` to headers object
  - Ensure it's included in all HTTP requests (get, post, patch, delete)

---

## Phase 4: Frontend - WebSocket Version Header

### 4.1 Add Version to WebSocket Connection

- [ ] **File**: `front-end/src/renderer/stores/storeWebsocketConnection.ts`
- [ ] **Action**: Include version in WebSocket auth/handshake
- [ ] **Implementation Details**:
  - Import `FRONTEND_VERSION` from version utility
  - Add `version: FRONTEND_VERSION` to `auth` callback in `io()` call
  - Alternative: Add as header using `extraHeaders: { 'x-frontend-version': FRONTEND_VERSION }`
  - Test both approaches - prefer `extraHeaders` for consistency with HTTP

---

## Phase 5: Error Handling and User Experience

### 5.1 Handle 426 Status in Frontend

- [ ] **File**: `front-end/src/renderer/utils/axios.ts`
- [ ] **Action**: Handle `426 Upgrade Required` status in `commonRequestHandler()`
- [ ] **Implementation Details**:
  - Detect status `426` in error handling
  - Show user-friendly message prompting upgrade
  - Optionally redirect to update/download page
  - Consider showing toast notification or modal

### 5.2 Handle WebSocket Version Errors

- [ ] **File**: `front-end/src/renderer/stores/storeWebsocketConnection.ts`
- [ ] **Action**: Handle version-related connection errors
- [ ] **Implementation Details**:
  - Listen for `connect_error` with version-related messages
  - Show user-friendly error message
  - Prevent reconnection attempts if version is too old
  - Consider showing upgrade prompt

---

## Phase 6: Testing

### 6.1 Backend Unit Tests - HTTP Guard

- [ ] **File**: `back-end/apps/api/src/guards/frontend-version.guard.spec.ts`
- [ ] **Test Cases**:
  - [ ] Version >= minimum (allowed)
  - [ ] Version < minimum (rejected with 426)
  - [ ] Version equal to minimum (allowed)
  - [ ] Missing header (decide: allow or reject)
  - [ ] Invalid version format
  - [ ] Logging verification

### 6.2 Backend Unit Tests - WebSocket Middleware

- [ ] **File**: `back-end/apps/notifications/src/websocket/middlewares/frontend-version-websocket.middleware.spec.ts`
- [ ] **Test Cases**:
  - [ ] Version >= minimum (connection allowed)
  - [ ] Version < minimum (connection rejected)
  - [ ] Version equal to minimum (connection allowed)
  - [ ] Missing version (connection rejected)
  - [ ] Invalid version format
  - [ ] Logging verification

### 6.3 Integration Tests

- [ ] **File**: Create integration test file
- [ ] **Test Cases**:
  - [ ] HTTP endpoints with various versions
  - [ ] WebSocket connections with various versions
  - [ ] Error responses and logging
  - [ ] End-to-end flow

---

## Phase 7: Documentation and Configuration

### 7.1 Update Example Environment Files

- [ ] **File**: `back-end/apps/api/example.env`
  - [ ] Already has `MINIMUM_SUPPORTED_FRONTEND_VERSION` - verify it's correct
- [ ] **File**: `back-end/apps/notifications/example.env`
  - [ ] Add `MINIMUM_SUPPORTED_FRONTEND_VERSION=0.21.0` (or appropriate version)

### 7.2 Update Documentation

- [ ] **File**: `back-end/README.md` or relevant docs
  - [ ] Document the new environment variable
  - [ ] Explain version enforcement behavior
  - [ ] Document frontend requirements

---

## Technical Decisions

### ✅ Decided

1. **Version Comparison**: Use existing `semver` package (already in `back-end/libs/common/src/utils/semver/index.ts`)
2. **HTTP Status Code**: `426 Upgrade Required` (as specified in requirements)
3. **Header Name**: `x-frontend-version` (as specified in requirements)
4. **Guard Order**: Run early, before auth guards
5. **WebSocket**: Validate during handshake, before auth

### ⚠️ To Decide

1. **Missing Header Behavior**:
   - **Option A**: Reject (strict enforcement)
   - **Option B**: Allow (backward compatibility)
   - **Recommendation**: Start with Option B, add flag to make strict later

2. **Version Source in Frontend**:
   - **Option A**: Import directly from `package.json`
   - **Option B**: Build-time constant
   - **Recommendation**: Option A (simpler, works with Vite)

3. **WebSocket Version Transport**:
   - **Option A**: `socket.handshake.auth.version`
   - **Option B**: `socket.handshake.headers['x-frontend-version']`
   - **Recommendation**: Option B (consistent with HTTP)

---

## File Structure Summary

### New Files

- [ ] `back-end/apps/api/src/guards/frontend-version.guard.ts`
- [ ] `back-end/apps/api/src/guards/frontend-version.guard.spec.ts`
- [ ] `back-end/apps/notifications/src/websocket/middlewares/frontend-version-websocket.middleware.ts`
- [ ] `back-end/apps/notifications/src/websocket/middlewares/frontend-version-websocket.middleware.spec.ts`
- [ ] `front-end/src/renderer/utils/version.ts`

### Modified Files

- [ ] `back-end/apps/api/src/api.module.ts` (register guard)
- [ ] `back-end/apps/api/src/guards/index.ts` (export guard)
- [ ] `back-end/apps/notifications/src/notifications.module.ts` (add env var)
- [ ] `back-end/apps/notifications/src/websocket/websocket.gateway.ts` (register middleware)
- [ ] `front-end/src/renderer/utils/axios.ts` (add version header)
- [ ] `front-end/src/renderer/stores/storeWebsocketConnection.ts` (add version to WebSocket)
- [ ] `back-end/apps/notifications/example.env` (add env var)

---

## Implementation Order

1. ✅ **Phase 1**: Backend HTTP Guard (Foundation)
2. ✅ **Phase 2**: Backend WebSocket Middleware (Complete backend)
3. ✅ **Phase 3**: Frontend HTTP Header (Complete HTTP flow)
4. ✅ **Phase 4**: Frontend WebSocket Header (Complete WebSocket flow)
5. ✅ **Phase 5**: Error Handling (User experience)
6. ✅ **Phase 6**: Testing (Quality assurance)
7. ✅ **Phase 7**: Documentation (Completeness)

---

## Acceptance Criteria Checklist

- [ ] Requests with versions >= `MINIMUM_SUPPORTED_FRONTEND_VERSION` are allowed
- [ ] Requests with versions < `MINIMUM_SUPPORTED_FRONTEND_VERSION` are rejected with appropriate status and message
- [ ] All WebSocket connections validate version prior to or during authorization
- [ ] Backend logs include details when a client version is below the minimum
- [ ] Tests cover scenarios:
  - [ ] Version above minimum (allowed)
  - [ ] Version equal to minimum (allowed)
  - [ ] Version below minimum (rejected)

---

## Notes

- The solution should not depend on the version-check endpoint; it must run globally
- Environment variable `MINIMUM_SUPPORTED_FRONTEND_VERSION` already exists in API service config schema
- Existing semver utility available at `back-end/libs/common/src/utils/semver/index.ts`
- Frontend version is in `front-end/package.json` (currently `0.21.0`)

---

## Progress Tracking

**Last Updated**: 2025-12-18  
**Current Phase**: Planning  
**Blockers**: None  
**Next Steps**: Begin Phase 1.1 - Create Frontend Version Guard
