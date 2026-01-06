import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ComprehensiveCalendarTemplate } from './ComprehensiveCalendarTemplate';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/comprehensive-calendar',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../molecules/DateNavigator', () => ({
  DateNavigator: () => 'DateNavigator',
}));

jest.mock('../atoms/FloatingActionButton', () => ({
  FloatingActionButton: () => 'FloatingActionButton',
}));

jest.mock('../organisms/BottomToolbar', () => ({
  BottomToolbar: () => 'BottomToolbar',
}));

describe.skip('ComprehensiveCalendarTemplate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <ComprehensiveCalendarTemplate
          selectedDate={new Date()}
          plannedEvents={[]}
          actualEvents={[]}
          onPrevDay={() => {}}
          onNextDay={() => {}}
          onAddEvent={() => {}}
          onUpdatePlannedEvent={() => {}}
          onDeletePlannedEvent={() => {}}
          onUpdateActualEvent={() => {}}
          onDeleteActualEvent={() => {}}
        />
      );
    });

    expect(tree).toBeTruthy();

    // Flush any queued timers/effects that might schedule state updates.
    act(() => {
      jest.runOnlyPendingTimers();
    });

    act(() => {
      tree.unmount();
    });
  });
});
