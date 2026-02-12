/**
 * Tests for location-labels.ts cache isolation fix
 * 
 * Bug #1: Edit propagation - When editing one location, changes propagate to
 * other UI components because they all share the same cached object reference.
 * 
 * Fix: getLocationLabels() now returns a deep clone via JSON.parse/stringify
 * to ensure each caller gets an independent copy.
 */

import { getLocationLabels, invalidateLocationLabelCache } from '../location-labels';

// Mock supabase client
jest.mock('../../client', () => ({
  supabase: {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            not: () => ({
              // Return mock data
              then: (resolve: (result: { data: Array<{ geohash7: string; label: string; category?: string }> }) => void) => 
                resolve({
                  data: [
                    { geohash7: '9v6kj3q', label: 'Home', category: 'home' },
                    { geohash7: '9v6kj4r', label: 'Work', category: 'work' },
                    { geohash7: '9v6kj5s', label: 'Gym', category: 'fitness' },
                  ]
                })
            })
          })
        })
      })
    })
  }
}));

// Mock __DEV__ global
declare const global: { __DEV__: boolean };
global.__DEV__ = false;

describe('getLocationLabels', () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateLocationLabelCache();
  });

  it('should return new object references on each call (no shared state)', async () => {
    const userId = 'test-user-123';
    
    // Get labels twice
    const labels1 = await getLocationLabels(userId);
    const labels2 = await getLocationLabels(userId);
    
    // Should be equal in value
    expect(labels1).toEqual(labels2);
    
    // But NOT the same reference (this is the key fix!)
    expect(labels1).not.toBe(labels2);
    
    // Nested objects should also not be the same reference
    expect(labels1['9v6kj3q']).not.toBe(labels2['9v6kj3q']);
  });

  it('should prevent mutation propagation between callers', async () => {
    const userId = 'test-user-123';
    
    // Get labels in two "components"
    const labelsForComponent1 = await getLocationLabels(userId);
    const labelsForComponent2 = await getLocationLabels(userId);
    
    // Verify both have the same initial value
    expect(labelsForComponent1['9v6kj3q'].label).toBe('Home');
    expect(labelsForComponent2['9v6kj3q'].label).toBe('Home');
    
    // Component 1 mutates its copy (simulating edit modal)
    labelsForComponent1['9v6kj3q'].label = 'MUTATED BY COMPONENT 1';
    
    // Component 2's copy should NOT be affected (this was the bug!)
    expect(labelsForComponent2['9v6kj3q'].label).toBe('Home');
    expect(labelsForComponent2['9v6kj3q'].label).not.toBe('MUTATED BY COMPONENT 1');
  });

  it('should isolate mutations from the cache itself', async () => {
    const userId = 'test-user-123';
    
    // Get labels and mutate
    const labels = await getLocationLabels(userId);
    labels['9v6kj3q'].label = 'MUTATED';
    
    // Get labels again - should have original value, not mutation
    const freshLabels = await getLocationLabels(userId);
    expect(freshLabels['9v6kj3q'].label).toBe('Home');
  });
});
