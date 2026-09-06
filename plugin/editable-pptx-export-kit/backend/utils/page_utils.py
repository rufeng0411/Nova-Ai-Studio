"""
Page utilities - shared helpers for parsing page_ids and fetching pages
"""
import logging
import os
from typing import List, Optional, Union
from flask import Request

logger = logging.getLogger(__name__)


def parse_page_ids_from_query(request: Request) -> List[str]:
    """
    Parse page_ids from query parameters (comma-separated string).
    
    Args:
        request: Flask request object
        
    Returns:
        List of page ID strings (empty list if none provided)
    """
    page_ids_param = request.args.get('page_ids', '')
    if not page_ids_param:
        return []
    return [pid.strip() for pid in page_ids_param.split(',') if pid.strip()]


def parse_page_ids_from_body(data: dict) -> List[str]:
    """
    Parse page_ids from request body (array of IDs).
    
    Args:
        data: Request JSON data dict
        
    Returns:
        List of page ID strings (empty list if invalid or none provided)
    """
    page_ids = data.get('page_ids', [])
    if not isinstance(page_ids, list):
        return []
    return page_ids


def get_filtered_pages(project_id: str, page_ids: Optional[List[str]] = None):
    """
    Fetch pages for a project, optionally filtered by page IDs.
    
    Args:
        project_id: Project ID
        page_ids: Optional list of page IDs to filter by
        
    Returns:
        List of Page objects ordered by order_index
    """
    from models import Page
    
    if page_ids:
        return Page.query.filter(
            Page.project_id == project_id,
            Page.id.in_(page_ids)
        ).order_by(Page.order_index).all()
    else:
        return Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()


def resolve_export_page_image_abs_path(page, file_service) -> Optional[str]:
    """
    导出用幻灯片图片绝对路径：优先正式出图路径，其次缓存缩略图；
    若首选路径文件不存在则尝试下一候选。
    """
    rel_candidates: List[str] = []
    gen = (getattr(page, 'generated_image_path', None) or '').strip()
    cached = (getattr(page, 'cached_image_path', None) or '').strip()
    if gen:
        rel_candidates.append(gen)
    if cached and cached not in rel_candidates:
        rel_candidates.append(cached)
    for rel in rel_candidates:
        abs_path = file_service.get_absolute_path(rel)
        if os.path.isfile(abs_path):
            return abs_path
    if rel_candidates:
        logger.warning(
            '[export] skip missing image for page %s tried=%s',
            getattr(page, 'id', '?'),
            rel_candidates,
        )
    return None


def collect_export_page_image_paths(pages, file_service) -> List[str]:
    """Collect absolute image paths for export, preserving page order."""
    paths: List[str] = []
    for page in pages:
        abs_path = resolve_export_page_image_abs_path(page, file_service)
        if abs_path:
            paths.append(abs_path)
    return paths

