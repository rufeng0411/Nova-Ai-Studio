// PD-SAAS-FORK: workbench beta 1.1 public entry
export { default as WorkbenchBetaShell } from './WorkbenchBetaShell';
export { default as WorkbenchBetaRoutes } from './WorkbenchBetaRoutes';
export { WORKBENCH_BETA_PREFIX, isWorkbenchBetaPath, stripWorkbenchBetaPrefix } from './betaRoute';
export { isWorkbenchBeta11Enabled } from './flags/workbenchBetaFlags';
export { useWorkbenchBetaSurface, WorkbenchBetaSurfaceProvider } from './surface/WorkbenchBetaSurface';
export { default as TurnUsageFooter } from './chat/TurnUsageFooter';
export { default as PostDeliverableNextChips } from './chat/PostDeliverableNextChips';
export { default as BetaChatHost } from './chat/BetaChatHost';
export { suggestPostDeliverableActions } from './chat/suggestPostDeliverableActions';
