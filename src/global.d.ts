// React 19 moved the JSX namespace under React and no longer declares a global
// one. We use `JSX.Element` as a return type throughout, so alias it back.
declare global {
  namespace JSX {
    type Element = import('react').JSX.Element
  }
}
export {}
