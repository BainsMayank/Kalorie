import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipeableRow } from './SwipeableRow';

/**
 * A fake one-finger touch event, moved from `fromX` to `x`, in the shape React Native's
 * PanResponder reads.
 */
function touchAt(x: number, time: number, fromX = 0) {
  return {
    nativeEvent: { touches: [], changedTouches: [], pageX: x, pageY: 0, timestamp: time },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: 0,
          currentTimeStamp: time,
          previousPageX: fromX,
          previousPageY: 0,
          previousTimeStamp: 0,
        },
      ],
    },
  };
}

/**
 * Drags the row sideways from x = 0 to `dx`. The gesture handlers are called directly: the
 * testing library only sends touch events to views that want the touch from its start, and a
 * swipe row waits for a sideways move instead.
 */
async function drag(dx: number) {
  const handlers = screen.getByText('Mixed dal').parent!.props;
  await act(async () => {
    // The first 10 px sideways: the row asks for the touch and gets it…
    const start = touchAt(-10, 1);
    handlers.onMoveShouldSetResponderCapture(start);
    expect(handlers.onMoveShouldSetResponder(start)).toBe(true);
    handlers.onResponderGrant(start);
    // …then the finger moves on by dx and lets go.
    handlers.onResponderMove(touchAt(-10 + dx, 2, -10));
    handlers.onResponderRelease(touchAt(-10 + dx, 3, -10 + dx));
  });
}

async function renderRow() {
  const onAction = jest.fn();
  const onSwipeChange = jest.fn();
  await render(
    <SwipeableRow actionLabel="Delete" onAction={onAction} onSwipeChange={onSwipeChange}>
      <Text>Mixed dal</Text>
    </SwipeableRow>,
  );
  return { onAction, onSwipeChange };
}

describe('SwipeableRow', () => {
  it('hides the Delete button until the row is swiped', async () => {
    await renderRow();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('opens on a swipe left and deletes when Delete is tapped', async () => {
    const { onAction, onSwipeChange } = await renderRow();
    await drag(-80);

    expect(onSwipeChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipeChange).toHaveBeenLastCalledWith(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('ignores an up-and-down drag, so the list can scroll', async () => {
    await renderRow();
    const handlers = screen.getByText('Mixed dal').parent!.props;
    const vertical = touchAt(10, 1);
    vertical.touchHistory.touchBank[0].currentPageY = 60;
    handlers.onMoveShouldSetResponderCapture(vertical);
    expect(handlers.onMoveShouldSetResponder(vertical)).toBe(false);
  });

  it('springs back after a short swipe', async () => {
    const { onAction } = await renderRow();
    await drag(-30);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });
});
