# Design Document

## Overview

This design addresses three critical runtime bugs in the NFT Generator application that prevent proper functionality. The fixes target: (1) incorrect default provider fallback pointing to non-functional Gemini instead of working Procedural provider, (2) broken batch optimizer result mapping due to missing access to uniqueRequests array causing trait misalignment, and (3) verification of ProceduralProvider integration with existing trait generation functions.

## Architecture

The NFT Generator follows a provider-based architecture where different services can generate NFT traits. The system includes:

- **Provider Management**: Handles selection and validation of active providers
- **Batch Processing**: Optimizes multiple requests through deduplication and parallel processing  
- **Trait Generation**: Creates individual NFT components using procedural algorithms
- **Cost Estimation**: Calculates generation costs based on active provider

The bugs occur at critical integration points between these components.

## Components and Interfaces

### Provider Fallback System (app.js)
- **Location**: `initializeCostEstimator` function around line 4959
- **Current Issue**: Defaults to 'gemini' provider which throws NOT_IMPLEMENTED errors
- **Interface**: Provider validation and fallback logic
- **Dependencies**: `apiManager.getActiveProviderName()`, `providerCosts` object

### Batch Optimizer (batch-optimizer.js)
- **Location**: `mapResultsToOriginalOrder` method (lines 227-249)
- **Current Issue**: Cannot access `originalIndex` property from `uniqueRequests` array
- **Interface**: `generateBatch(requests)` → `finalResults`
- **Dependencies**: `deduplicateRequests`, `processRequestsInParallel`

### ProceduralProvider (api-providers.js)
- **Location**: `generateImage` method (lines 562-596) and `_generateProceduralTraitInternal` (lines 598-639)
- **Dependencies**: Global functions from app.js including `parseColorSeed`, `seedManager`, trait generation functions
- **Interface**: `generateImage(prompt, options)` → Promise<dataURL>

## Data Models

### Request Structure
```javascript
{
  originalIndex: number,    // Position in original request array
  category: string,         // 'background', 'body', 'eyes', 'mouth', 'hat'
  complexity: number,       // 1-10 complexity level
  colorSeed: string,        // Color seed for generation
  index: number            // NFT index for seed calculation
}
```

### Duplicate Map Structure
```javascript
Map {
  uniqueIndex_0 => [originalIndex_5, originalIndex_8],  // duplicates of unique request 0
  uniqueIndex_2 => [originalIndex_3, originalIndex_7]   // duplicates of unique request 2
}
```

### Provider Cost Structure
```javascript
{
  procedural: { cost: 0, available: true },
  gemini: { cost: 0.002, available: false }  // NOT_IMPLEMENTED
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*
### Property 1: Provider fallback reliability
*For any* invalid or missing provider name, the system should always default to the 'procedural' provider
**Validates: Requirements 1.1, 1.2**

### Property 2: Cost estimator initialization safety
*For any* system state, the cost estimator initialization should never fail due to provider NOT_IMPLEMENTED errors
**Validates: Requirements 1.3**

### Property 3: Batch result mapping correctness
*For any* array of requests with duplicates, the batch optimizer should return results in the exact same order as the original requests
**Validates: Requirements 2.1, 2.5**

### Property 4: Deduplication index preservation
*For any* set of requests, the deduplication process should preserve the originalIndex property for all unique requests
**Validates: Requirements 2.2, 2.3**

### Property 5: Duplicate result cloning
*For any* duplicate requests, modifying one result should not affect other duplicate results (no reference sharing)
**Validates: Requirements 2.4**

### Property 6: ProceduralProvider dependency access
*For any* ProceduralProvider execution, all required global dependencies (parseColorSeed, seedManager, trait functions) should be accessible
**Validates: Requirements 3.1, 3.2**

### Property 7: ProceduralProvider error handling
*For any* invalid input parameters, the ProceduralProvider should handle errors gracefully and return appropriate error responses
**Validates: Requirements 3.3**

### Property 8: Canvas operations reliability
*For any* trait generation request, canvas creation and drawing operations should complete without errors
**Validates: Requirements 3.4, 3.5**

## Error Handling

### Provider Fallback Errors
- Invalid provider names should trigger fallback to 'procedural'
- Missing provider configuration should not cause system failure
- NOT_IMPLEMENTED errors should be prevented by proper fallback logic

### Batch Processing Errors
- Index mapping failures should be caught and reported
- Result array length mismatches should be detected
- Undefined array positions should be prevented

### ProceduralProvider Errors
- Missing global dependencies should throw ValidationError
- Invalid parameters should be validated before processing
- Canvas operation failures should be wrapped in ProviderError

## Testing Strategy

### Unit Testing Approach
- Test provider fallback logic with various invalid inputs
- Test batch optimizer mapping with known duplicate patterns
- Test ProceduralProvider with mock global dependencies
- Test error conditions for each component

### Property-Based Testing Approach
- Use **fast-check** library for JavaScript property-based testing
- Configure each property test to run minimum 100 iterations
- Generate random request arrays with varying duplicate patterns
- Generate random provider states and invalid configurations
- Test canvas operations with random valid parameters

**Property-Based Testing Requirements:**
- Each property test must run minimum 100 iterations for thorough coverage
- Tests must be tagged with comments referencing design document properties
- Tag format: `**Feature: nft-generator-bug-fixes, Property {number}: {property_text}**`
- Each correctness property must be implemented by a single property-based test
- Property tests should be placed close to implementation for early error detection

### Integration Testing
- Test complete NFT generation workflow with fixed bugs
- Verify provider switching works correctly
- Test batch processing with real duplicate scenarios
- Validate ProceduralProvider integration with actual trait functions

## Implementation Approach

### Phase 1: Provider Fallback Fix
1. Locate `initializeCostEstimator` function in app.js around line 4959
2. Change `activeProvider = 'gemini';` to `activeProvider = 'procedural';`
3. Update comment to reflect safe default choice
4. Test provider validation logic

### Phase 2: Batch Optimizer Fix
1. Modify `generateBatch` method to pass `uniqueRequests` to mapping function
2. Update `mapResultsToOriginalOrder` signature to accept `uniqueRequests` parameter
3. Rewrite mapping logic to use `uniqueRequests[uniqueIndex].originalIndex`
4. Implement proper result cloning for duplicates
5. Test with various duplicate patterns

### Phase 3: ProceduralProvider Verification
1. Verify all global dependencies are accessible
2. Test trait generation function calls with correct parameters
3. Validate error handling for missing dependencies
4. Confirm canvas operations work correctly
5. Test complete integration with existing codebase

## Dependencies

### External Dependencies
- Canvas API for procedural trait generation
- Global functions from app.js (parseColorSeed, seedManager, trait generators)
- Provider management system
- Batch processing infrastructure

### Internal Dependencies
- ValidationError and ProviderError classes
- API manager for provider name resolution
- Cost calculation system
- Seed management for deterministic generation

## Performance Considerations

- Provider fallback should be instantaneous
- Batch optimizer fixes should not impact processing speed
- ProceduralProvider should maintain current generation performance
- Memory usage should not increase due to result cloning

## Security Considerations

- Provider fallback should not expose sensitive configuration
- Batch processing should not leak data between requests
- ProceduralProvider should validate all inputs to prevent injection
- Error messages should not reveal internal system details