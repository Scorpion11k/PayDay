export type FlowLayoutDirection = 'auto' | 'horizontal' | 'vertical';

export interface FlowPosition {
  x: number;
  y: number;
}

interface PositionedFlowState {
  positionX?: number | null;
  positionY?: number | null;
  isStart?: boolean;
}

interface FlowLayoutOptions<TState extends PositionedFlowState, TTransition> {
  states: TState[];
  transitions: TTransition[];
  direction: FlowLayoutDirection;
  getStateId: (state: TState) => string;
  getTransitionSourceId: (transition: TTransition) => string;
  getTransitionTargetId: (transition: TTransition) => string;
}

type ResolvedFlowLayoutDirection = Exclude<FlowLayoutDirection, 'auto'>;
type StoredOrientation = ResolvedFlowLayoutDirection | 'neutral' | 'none';

const HORIZONTAL_START = { x: 100, y: 120 };
const VERTICAL_START = { x: 160, y: 100 };
const HORIZONTAL_GAP = 260;
const VERTICAL_GAP = 220;
const ORIENTATION_THRESHOLD = 1.25;

interface ValidPosition {
  positionX: number;
  positionY: number;
}

function hasStoredPosition<T extends PositionedFlowState>(state: T): state is T & ValidPosition {
  return typeof state.positionX === 'number' && typeof state.positionY === 'number';
}

function collectStoredPositions<TState extends PositionedFlowState>(
  states: TState[],
  getStateId: (state: TState) => string
): Map<string, FlowPosition> | null {
  const positionedStates = states.filter(hasStoredPosition);
  if (positionedStates.length !== states.length) {
    return null;
  }

  return new Map(
    positionedStates.map((state) => [
      getStateId(state),
      {
        x: state.positionX,
        y: state.positionY,
      },
    ])
  );
}

function detectStoredOrientation<TState extends PositionedFlowState>(states: TState[]): StoredOrientation {
  const positionedStates = states.filter(hasStoredPosition);
  if (positionedStates.length !== states.length || positionedStates.length === 0) {
    return 'none';
  }

  const xValues = positionedStates.map((state) => state.positionX);
  const yValues = positionedStates.map((state) => state.positionY);
  const spanX = Math.max(...xValues) - Math.min(...xValues);
  const spanY = Math.max(...yValues) - Math.min(...yValues);

  if (spanX > spanY * ORIENTATION_THRESHOLD) {
    return 'horizontal';
  }

  if (spanY > spanX * ORIENTATION_THRESHOLD) {
    return 'vertical';
  }

  return 'neutral';
}

function transposeStoredPositions<TState extends PositionedFlowState>(
  states: TState[],
  getStateId: (state: TState) => string,
  direction: ResolvedFlowLayoutDirection
): Map<string, FlowPosition> {
  const positionedStates = states.filter(hasStoredPosition);
  if (positionedStates.length === 0) {
    return new Map();
  }

  const xValues = positionedStates.map((state) => state.positionX);
  const yValues = positionedStates.map((state) => state.positionY);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const base = direction === 'vertical' ? VERTICAL_START : HORIZONTAL_START;

  return new Map(
    positionedStates.map((state) => [
      getStateId(state),
      {
        x: base.x + (state.positionY - minY),
        y: base.y + (state.positionX - minX),
      },
    ])
  );
}

function buildTraversalOrder<TState extends PositionedFlowState, TTransition>(
  states: TState[],
  transitions: TTransition[],
  getStateId: (state: TState) => string,
  getTransitionSourceId: (transition: TTransition) => string,
  getTransitionTargetId: (transition: TTransition) => string
): string[] {
  const stateIds = states.map(getStateId);
  const stateIdSet = new Set(stateIds);
  const stateOrder = new Map(stateIds.map((id, index) => [id, index]));
  const adjacency = new Map<string, string[]>(stateIds.map((id) => [id, []]));
  const incoming = new Set<string>();

  transitions.forEach((transition) => {
    const sourceId = getTransitionSourceId(transition);
    const targetId = getTransitionTargetId(transition);

    if (!stateIdSet.has(sourceId) || !stateIdSet.has(targetId)) {
      return;
    }

    adjacency.get(sourceId)?.push(targetId);
    incoming.add(targetId);
  });

  adjacency.forEach((targets) => {
    targets.sort((left, right) => (stateOrder.get(left) ?? 0) - (stateOrder.get(right) ?? 0));
  });

  const rootIds = states
    .filter((state) => state.isStart)
    .map(getStateId);
  const queue =
    rootIds.length > 0
      ? [...rootIds]
      : stateIds.filter((id) => !incoming.has(id));

  if (queue.length === 0 && stateIds.length > 0) {
    queue.push(stateIds[0]);
  }

  const visited = new Set<string>();
  const order: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    order.push(currentId);

    (adjacency.get(currentId) ?? []).forEach((targetId) => {
      if (!visited.has(targetId)) {
        queue.push(targetId);
      }
    });
  }

  stateIds.forEach((stateId) => {
    if (!visited.has(stateId)) {
      order.push(stateId);
    }
  });

  return order;
}

function buildStackedPositions<TState extends PositionedFlowState, TTransition>(
  states: TState[],
  transitions: TTransition[],
  direction: ResolvedFlowLayoutDirection,
  getStateId: (state: TState) => string,
  getTransitionSourceId: (transition: TTransition) => string,
  getTransitionTargetId: (transition: TTransition) => string
): Map<string, FlowPosition> {
  const order = buildTraversalOrder(states, transitions, getStateId, getTransitionSourceId, getTransitionTargetId);
  const base = direction === 'vertical' ? VERTICAL_START : HORIZONTAL_START;

  return new Map(
    order.map((stateId, index) => [
      stateId,
      direction === 'vertical'
        ? {
            x: base.x,
            y: base.y + index * VERTICAL_GAP,
          }
        : {
            x: base.x + index * HORIZONTAL_GAP,
            y: base.y,
          },
    ])
  );
}

export function getFlowLayout<TState extends PositionedFlowState, TTransition>({
  states,
  transitions,
  direction,
  getStateId,
  getTransitionSourceId,
  getTransitionTargetId,
}: FlowLayoutOptions<TState, TTransition>): {
  direction: ResolvedFlowLayoutDirection;
  positions: Map<string, FlowPosition>;
} {
  const storedPositions = collectStoredPositions(states, getStateId);
  const storedOrientation = detectStoredOrientation(states);

  if (direction === 'auto') {
    return {
      direction: storedOrientation === 'vertical' ? 'vertical' : 'horizontal',
      positions:
        storedPositions ??
        buildStackedPositions(states, transitions, 'horizontal', getStateId, getTransitionSourceId, getTransitionTargetId),
    };
  }

  if (storedPositions && storedOrientation === direction) {
    return {
      direction,
      positions: storedPositions,
    };
  }

  if (
    storedPositions &&
    ((storedOrientation === 'horizontal' && direction === 'vertical') ||
      (storedOrientation === 'vertical' && direction === 'horizontal'))
  ) {
    return {
      direction,
      positions: transposeStoredPositions(states, getStateId, direction),
    };
  }

  return {
    direction,
    positions: buildStackedPositions(states, transitions, direction, getStateId, getTransitionSourceId, getTransitionTargetId),
  };
}
