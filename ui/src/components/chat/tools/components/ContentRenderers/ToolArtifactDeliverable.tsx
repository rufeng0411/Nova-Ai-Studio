import React, { useMemo } from 'react';
import type { Project } from '../../../../../types/app';
import {
 extractDeliverablePath,
 resolveDeliverableApiPath,
} from '../../../../../shared/artifactPaths';
import DeliverableCard from '../../../deliverables/DeliverableCard';

interface ToolArtifactDeliverableProps {
 filePath?: string;
 result?: unknown;
 toolInput?: unknown;
 selectedProject?: Project | null;
 onFileOpen?: (filePath: string) => void;
 title?: string;
 showInlineHtmlPreview?: boolean;
}

export const ToolArtifactDeliverable: React.FC<ToolArtifactDeliverableProps> = ({
 filePath: filePathProp,
 result,
 toolInput,
 selectedProject,
 onFileOpen,
 title = '已生成文件',
 showInlineHtmlPreview = true,
}) => {
 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const displayPath = filePathProp || extractDeliverablePath(result, toolInput);
 const apiPath = useMemo(
 () => resolveDeliverableApiPath(result, toolInput, projectRoot) || resolveDeliverableApiPath({ writtenFilePath: displayPath }, toolInput, projectRoot),
 [displayPath, projectRoot, result, toolInput],
 );

 if (!displayPath && !apiPath) {
 return null;
 }

 return (
 <DeliverableCard
 path={displayPath || apiPath}
 apiPath={apiPath || undefined}
 selectedProject={selectedProject}
 onFileOpen={onFileOpen}
 title={title}
 showInlineHtmlPreview={showInlineHtmlPreview}
 showInlineImagePreview
 />
 );
};
