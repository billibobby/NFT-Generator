# Implementation Plan

- [ ] 1. Fix Provider Fallback Logic
  - Locate `initializeCostEstimator` function in app.js around line 4959
  - Change default provider from 'gemini' to 'procedural' 
  - Update comment to reflect safe default choice
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 1.1 Write property test for provider fallback reliability
  - **Property 1: Provider fallback reliability**
  - **Validates: Requirements 1.1, 1.2**

- [ ] 1.2 Write property test for cost estimator initialization safety
  - **Property 2: Cost estimator initialization safety**
  - **Validates: Requirements 1.3**

- [ ] 2. Fix Batch Optimizer Index Mapping
  - Modify `generateBatch` method in batch-optimizer.js line 50 to pass `uniqueRequests` parameter
  - Update `mapResultsToOriginalOrder` method signature to accept `uniqueRequests` parameter
  - Rewrite mapping logic to use `uniqueRequests[uniqueIndex].originalIndex` for correct positioning
  - Implement proper result cloning for duplicate positions to prevent reference sharing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.1 Write property test for batch result mapping correctness
  - **Property 3: Batch result mapping correctness**
  - **Validates: Requirements 2.1, 2.5**

- [ ] 2.2 Write property test for deduplication index preservation
  - **Property 4: Deduplication index preservation**
  - **Validates: Requirements 2.2, 2.3**

- [ ] 2.3 Write property test for duplicate result cloning
  - **Property 5: Duplicate result cloning**
  - **Validates: Requirements 2.4**

- [ ] 3. Verify ProceduralProvider Integration
  - Verify all global dependencies are accessible (parseColorSeed, seedManager, trait generation functions)
  - Test trait generation function calls with correct parameters
  - Validate error handling for missing dependencies and invalid inputs
  - Confirm canvas operations work correctly in ProceduralProvider context
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3.1 Write property test for ProceduralProvider dependency access
  - **Property 6: ProceduralProvider dependency access**
  - **Validates: Requirements 3.1, 3.2**

- [ ] 3.2 Write property test for ProceduralProvider error handling
  - **Property 7: ProceduralProvider error handling**
  - **Validates: Requirements 3.3**

- [ ] 3.3 Write property test for canvas operations reliability
  - **Property 8: Canvas operations reliability**
  - **Validates: Requirements 3.4, 3.5**

- [ ] 4. Integration Testing and Validation
  - Test complete NFT generation workflow with all fixes applied
  - Verify provider switching works correctly after fallback fix
  - Test batch processing with real duplicate scenarios using fixed mapping logic
  - Validate ProceduralProvider generates traits correctly for all categories
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.