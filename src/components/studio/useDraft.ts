import { useCallback, useReducer, type SetStateAction } from "react";
type State<T> = { draft: T; saved: string };
type Action<T> =
  | { type: "edit"; update: SetStateAction<T> }
  | { type: "load"; value: T }
  | { type: "saved"; value: T };
export function draftReducer<T>(state: State<T>, action: Action<T>): State<T> {
  if (action.type === "edit")
    return {
      ...state,
      draft:
        typeof action.update === "function"
          ? (action.update as (current: T) => T)(state.draft)
          : action.update,
    };
  if (action.type === "load") return { draft: action.value, saved: JSON.stringify(action.value) };
  return { ...state, saved: JSON.stringify(action.value) };
}
export function useDraft<T>(initial: T) {
  const [state, dispatch] = useReducer(draftReducer<T>, {
    draft: initial,
    saved: JSON.stringify(initial),
  });
  const edit = useCallback((update: SetStateAction<T>) => dispatch({ type: "edit", update }), []);
  const load = useCallback((value: T) => dispatch({ type: "load", value }), []);
  const saved = useCallback((value: T) => dispatch({ type: "saved", value }), []);
  return {
    draft: state.draft,
    dirty: JSON.stringify(state.draft) !== state.saved,
    edit,
    load,
    saved,
  };
}
