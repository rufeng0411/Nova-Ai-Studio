/** ES9 Case3 — four-format NIO ES9 deliverable goal (PDF/Word/PPT/Markdown). */
export const ES9_FOUR_FORMAT_VAP_GOAL = [
  "为【蔚来 ES9】撰写万里越雄关复盘报告，须使用官方或权威配图。",
  "根据上述主题做四格式交付包，两步一次做完，存系统分配的任务目录。",
  "1. 写中文调研报告 → report.md。",
  "2. 用 export_document 依次导出 PDF、Word、可编辑 PPT 到同目录。",
  "禁止 read_file skills/；每步 write_file 落盘后再进下一步。",
  "直接开始做，做完告诉我各文件路径。",
  "",
  "标准成果清单：",
  "1. report.md",
  "2. report.pdf",
  "3. report.docx",
  "4. report.pptx",
].join("\n");

export const ES9_FOUR_FORMAT_TASK_DIR = "artifacts/nio-es9-review";

export const ES9_FOUR_FORMAT_REPORT_MD = `${ES9_FOUR_FORMAT_TASK_DIR}/report.md`;
