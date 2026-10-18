/**
 * Buxme native mobile design system — re-exports shared chrome.
 * Prefer these over one-off sticky footers or nested web cards on iOS.
 *
 * Page chrome: IosPageHeader, NativeIosChrome, IosScreen
 * Metrics: IosHeroMetric, IosCard, IosSection
 * Lists: IosList, IosListRow (accounts / budgets / bills)
 * Sheets: IosBottomSheet (+ footer), Modal (+ footer), NativeEditorActions
 * Actions: IosPrimaryButton, NativeDestructiveButton, IosTextButton
 * States: IosEmptyState, IosSkeletonScreen, IosBanner
 */

export { IosPageHeader } from "@/components/native/ios/IosPageHeader";
export { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
export {
  NativeDestructiveButton,
  NativeEditorActions,
} from "@/components/native/NativeEditorActions";
export {
  IosAvatar,
  IosBanner,
  IosCard,
  IosDetailLine,
  IosEmptyState,
  IosHeroMetric,
  IosIconButton,
  IosList,
  IosListRow,
  IosPrimaryButton,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSegmentedControl,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
