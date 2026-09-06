/**
 * PD-SAAS-FORK: 排队期间重复目标 / 纯状态催问幂等
 */

const STATUS_INQUIRY_RE =
  /^[\s?？!！。、,，]{1,12}$|^(?:进度|在哪|文件在哪|图在哪|好了吗|完成了吗|怎么样了|还要多久|继续吗)/i;

/**
 * @param {string} command
 */
export function isQueueStatusInquiry(command) {
  const text = String(command ?? '').trim();
  if (!text) return false;
  return STATUS_INQUIRY_RE.test(text);
}

/**
 * @param {string} command
 */
export function normalizeGoalForDedupe(command) {
  return String(command ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} command
 * @param {string | null | undefined} anchorGoal
 */
export function isDuplicateQueuedGoal(command, anchorGoal) {
  const anchor = normalizeGoalForDedupe(anchorGoal ?? '');
  const next = normalizeGoalForDedupe(command);
  if (!anchor || !next) return false;
  return anchor === next;
}

/**
 * @param {string} command
 * @param {number} position
 */
export function buildQueueStatusReplyText(command, position) {
  if (isQueueStatusInquiry(command)) {
    return `您的任务仍在排队中（第 ${position} 位），开始后会在对话中显示进度。`;
  }
  return `已收到，与当前排队任务相同，将按原顺序继续处理（第 ${position} 位）。`;
}
