// PD-SAAS-FORK VAP: G700 canary frozen disk audit paths (regression anchor, not scope limit).

export type G700CanaryDiskCase = {
  id: string;
  label: string;
  taskArtifactDir: string;
  htmlRelPath?: string;
  galleryRelPath?: string;
  slideManifestRelPath?: string;
  minOfficialAssets: number;
  forbidCrossTaskRawRefs: boolean;
  forbidGenerateImageInManifest: boolean;
};

export const G700_CANARY_DISK_CASES: G700CanaryDiskCase[] = [
  {
    id: "hero-official-81ff36e6",
    label: "Hero 官网 — manifest 有官图、HTML 可预览",
    taskArtifactDir: "artifacts/task-20260719-81ff36e6",
    htmlRelPath: "artifacts/task-20260719-81ff36e6/index.html",
    minOfficialAssets: 1,
    forbidCrossTaskRawRefs: true,
    forbidGenerateImageInManifest: false,
  },
  {
    id: "html-demo-c682b032",
    label: "HTML 8 页 — src 须在盘且可预览",
    taskArtifactDir: "artifacts/task-20260719-c682b032",
    htmlRelPath: "artifacts/task-20260719-c682b032/index.html",
    minOfficialAssets: 1,
    forbidCrossTaskRawRefs: true,
    forbidGenerateImageInManifest: false,
  },
  {
    id: "nova-slides-8e3ba35c",
    label: "Nova 8 页 — 禁 generate_image 充数",
    taskArtifactDir: "artifacts/task-20260719-8e3ba35c",
    slideManifestRelPath: "artifacts/task-20260719-8e3ba35c/slide-manifest.json",
    minOfficialAssets: 1,
    forbidCrossTaskRawRefs: true,
    forbidGenerateImageInManifest: true,
  },
  {
    id: "camouflage-e0475c50",
    label: "迷彩改图 — 无跨 task ../assets/raw",
    taskArtifactDir: "artifacts/g700-camouflage",
    galleryRelPath: "artifacts/g700-camouflage/gallery.html",
    minOfficialAssets: 0,
    forbidCrossTaskRawRefs: true,
    forbidGenerateImageInManifest: false,
  },
];
