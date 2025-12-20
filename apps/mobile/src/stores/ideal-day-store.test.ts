import { act } from 'react-test-renderer';
import { useIdealDayStore } from './ideal-day-store';
import { IdealDayCategory } from './ideal-day-store';

// Mock AsyncStorage as it's used by zustand/middleware/persist
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Helper to reset store state before each test
const initialState = useIdealDayStore.getState();

beforeEach(() => {
  act(() => {
    useIdealDayStore.setState(initialState, true); // Reset to initial state
    useIdealDayStore.setState({ _hasHydrated: true }); // Ensure store is hydrated for tests
  });
});

describe('ideal-day-store', () => {
  it('should initialize with default categories', () => {
    const state = useIdealDayStore.getState();
    expect(state.categoriesByType.weekdays.length).toBeGreaterThan(0);
    expect(state.categoriesByType.saturday.length).toBeGreaterThan(0);
    expect(state.categoriesByType.sunday.length).toBeGreaterThan(0);
  });

  it('should set the day type', () => {
    act(() => {
      useIdealDayStore.getState().setDayType('saturday');
    });
    expect(useIdealDayStore.getState().dayType).toBe('saturday');
  });

  it('should add a new category with 0 hours by default', () => {
    const { addCategory, dayType, categoriesByType } = useIdealDayStore.getState();
    const initialCategories = categoriesByType[dayType];
    const initialTotalHours = initialCategories.reduce((sum, cat) => sum + cat.hours, 0);

    act(() => {
      addCategory('New Activity', '#CCCCCC');
    });

    const updatedCategories = useIdealDayStore.getState().categoriesByType[dayType];
    const newCategory = updatedCategories[updatedCategories.length - 1];

    expect(updatedCategories.length).toBe(initialCategories.length + 1);
    expect(newCategory.name).toBe('New Activity');
    expect(newCategory.hours).toBe(0); // This is the core fix check
    
    const newTotalHours = updatedCategories.reduce((sum, cat) => sum + cat.hours, 0);
    // Total hours should be the initial total + 0 for the new category
    expect(newTotalHours).toBe(initialTotalHours);
  });

  it('should not exceed 24 total hours when adding a new category to a full day', () => {
    const { setHours, addCategory, dayType } = useIdealDayStore.getState();

    act(() => {
      // Set all existing categories to sum up to 24 hours
      useIdealDayStore.getState().categoriesByType[dayType].forEach((cat: IdealDayCategory) => {
        setHours(cat.id, cat.maxHours); // Max out each category
      });
      // Now manually set some to reach exactly 24
      const categories = useIdealDayStore.getState().categoriesByType[dayType];
      let currentTotal = 0;
      for (let i = 0; i < categories.length; i++) {
        const remaining = 24 - currentTotal;
        if (remaining <= 0) {
          setHours(categories[i].id, 0);
        } else if (categories[i].maxHours <= remaining) {
          setHours(categories[i].id, categories[i].maxHours);
          currentTotal += categories[i].maxHours;
        } else {
          setHours(categories[i].id, remaining);
          currentTotal += remaining;
        }
      }
    });

    const totalHoursBeforeAdd = useIdealDayStore.getState().categoriesByType[dayType].reduce((sum, cat) => sum + cat.hours, 0);
    // Ensure it's not over 24
    expect(totalHoursBeforeAdd).toBeLessThanOrEqual(24); 

    // Add a new category
    act(() => {
      addCategory('Overflow Activity', '#FF0000');
    });

    const updatedCategories = useIdealDayStore.getState().categoriesByType[dayType];
    const newCategory = updatedCategories[updatedCategories.length - 1];
    const finalTotalHours = updatedCategories.reduce((sum, cat) => sum + cat.hours, 0);

    expect(newCategory.hours).toBe(0); // New category must have 0 hours
    expect(finalTotalHours).toBe(totalHoursBeforeAdd); // Total hours should not change
    expect(finalTotalHours).toBeLessThanOrEqual(24); // Final total hours must not exceed 24
  });

  it('should correctly clamp hours when setting hours for an existing category', () => {
    const { setHours, dayType, categoriesByType } = useIdealDayStore.getState();
    const categories = categoriesByType[dayType];
    const firstCategoryId = categories[0].id;
    const initialHoursFirstCategory = categories[0].hours;

    act(() => {
      // Set total to 23 hours
      categories.forEach((cat, index) => {
        if (index === 0) setHours(cat.id, 1); // Set first to 1
        else setHours(cat.id, 4); // Set others to 4
      });
    });

    let currentTotal = useIdealDayStore.getState().categoriesByType[dayType].reduce((sum, cat) => sum + cat.hours, 0);
    // Now try to set the first category to a value that would exceed 24
    act(() => {
      // Try to add 24 to current total
      setHours(firstCategoryId, 24); 
    });

    const finalTotal = useIdealDayStore.getState().categoriesByType[dayType].reduce((sum, cat) => sum + cat.hours, 0);
    expect(finalTotal).toBeLessThanOrEqual(24);
    // Check if the first category's hours are clamped correctly
    const firstCategory = useIdealDayStore.getState().categoriesByType[dayType].find(c => c.id === firstCategoryId);
    expect(firstCategory?.hours).toBeLessThanOrEqual(24 - (currentTotal - initialHoursFirstCategory));
  });

  // Test for deleteCategory
  it('should delete a category', () => {
    const { deleteCategory, dayType, categoriesByType } = useIdealDayStore.getState();
    const initialCategories = categoriesByType[dayType];
    const categoryToDelete = initialCategories[0];

    act(() => {
      deleteCategory(categoryToDelete.id);
    });

    const updatedCategories = useIdealDayStore.getState().categoriesByType[dayType];
    expect(updatedCategories.length).toBe(initialCategories.length - 1);
    expect(updatedCategories).not.toContainEqual(categoryToDelete);
  });
});